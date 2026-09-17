import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import { generateOtp, generateToken, newId, sha256 } from '../common/crypto';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_MS = 30 * 1000;
const ACCESS_TTL = '15m';
const REFRESH_DAYS = 30;
const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  normalizePhone(raw: string): string {
    const parsed = parsePhoneNumberFromString(raw, 'ZW');
    if (!parsed || !parsed.isValid()) {
      throw Errors.validation('Enter a valid phone number.');
    }
    return parsed.number;
  }

  async requestOtp(phoneNumberRaw: string) {
    const phoneNumber = this.normalizePhone(phoneNumberRaw);
    await this.enforceRequestLimit(phoneNumber);

    const now = new Date();
    const latest = await this.prisma.otpChallenge.findFirst({
      where: { phoneNumber, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && latest.resendAvailableAt > now) {
      throw Errors.rateLimited('Please wait before requesting another code.');
    }

    const code =
      phoneNumber === this.config.get('DEV_PHONE')
        ? this.config.get('DEV_OTP_CODE', '123456')
        : generateOtp();
    const pepper = this.config.getOrThrow('OTP_PEPPER');
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        id: newId('otp_ch'),
        phoneNumber,
        codeHash: sha256(`${pepper}:${code}`),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        resendAvailableAt: new Date(now.getTime() + RESEND_MS),
      },
    });

    this.logger.log(`OTP issued for ${this.maskPhone(phoneNumber)}`);
    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(`DEV OTP for ${phoneNumber}: ${code}`);
    }

    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: challenge.resendAvailableAt.toISOString(),
    };
  }

  async verifyOtp(challengeId: string, otp: string) {
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { id: challengeId },
    });
    if (!challenge) {
      throw Errors.validation('This verification code is no longer valid.');
    }
    if (challenge.consumedAt) {
      throw Errors.validation('This verification code has already been used.');
    }
    if (challenge.expiresAt < new Date()) {
      throw Errors.validation('This verification code has expired.');
    }
    if (challenge.attemptCount >= MAX_VERIFY_ATTEMPTS) {
      throw Errors.rateLimited();
    }

    const pepper = this.config.getOrThrow('OTP_PEPPER');
    const valid = sha256(`${pepper}:${otp}`) === challenge.codeHash;
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });
    if (!valid) {
      throw Errors.validation('That code is incorrect. Please try again.');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    let person = await this.prisma.person.findUnique({
      where: { phoneNumber: challenge.phoneNumber },
    });
    if (!person) {
      person = await this.prisma.person.create({
        data: {
          id: newId('person'),
          phoneNumber: challenge.phoneNumber,
          accountState: 'NEW',
        },
      });
    }

    const session = await this.issueSession(person.id, 'iPhone');
    return {
      session,
      person: this.publicPerson(person),
      accountState: person.accountState,
    };
  }

  async refresh(refreshToken: string) {
    const hash = sha256(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash, revokedAt: null },
      include: { person: true },
    });
    if (!session || session.expiresAt < new Date()) {
      throw Errors.unauthenticated('Your session has expired. Please sign in again.');
    }
    const tokens = await this.signTokens(session.personId, session.id);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });
    return {
      session: {
        id: session.id,
        accessToken: tokens.accessToken,
        refreshToken,
        expiresAt: tokens.accessExpiresAt,
      },
      person: this.publicPerson(session.person),
      accountState: session.person.accountState,
    };
  }

  async logout(sessionId: string, personId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, personId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async listSessions(personId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { personId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
    });
    return {
      items: sessions.map((session) => ({
        id: session.id,
        deviceLabel: session.deviceLabel,
        lastActiveAt: session.lastActiveAt.toISOString(),
        current: session.id === currentSessionId,
      })),
    };
  }

  async revokeSession(personId: string, sessionId: string) {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, personId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw Errors.notFound('Session not found.');
    }
    return { ok: true };
  }

  private async issueSession(personId: string, deviceLabel: string) {
    const sessionId = newId('session');
    const refreshToken = generateToken();
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.session.create({
      data: {
        id: sessionId,
        personId,
        refreshTokenHash: sha256(refreshToken),
        deviceLabel,
        expiresAt,
      },
    });
    const tokens = await this.signTokens(personId, sessionId);
    return {
      id: sessionId,
      accessToken: tokens.accessToken,
      refreshToken,
      expiresAt: tokens.accessExpiresAt,
    };
  }

  private async signTokens(personId: string, sessionId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: personId, sid: sessionId },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: ACCESS_TTL },
    );
    const decoded = this.jwt.decode(accessToken) as { exp: number };
    return {
      accessToken,
      accessExpiresAt: new Date(decoded.exp * 1000).toISOString(),
    };
  }

  private async enforceRequestLimit(phoneNumber: string) {
    const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);
    const record = await this.prisma.otpRateLimit.upsert({
      where: { phoneNumber_windowStart: { phoneNumber, windowStart } },
      update: { requestCount: { increment: 1 } },
      create: {
        id: newId('otp_rl'),
        phoneNumber,
        windowStart,
        requestCount: 1,
      },
    });
    if (record.requestCount > MAX_REQUESTS_PER_WINDOW) {
      throw Errors.rateLimited();
    }
  }

  private maskPhone(phone: string): string {
    return phone.replace(/(\+\d{3})\d+(\d{4})/, '$1 *** $2');
  }

  private publicPerson(person: {
    id: string;
    displayName: string | null;
    username: string | null;
  }) {
    return {
      id: person.id,
      name: person.displayName,
      username: person.username,
    };
  }
}
