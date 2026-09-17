import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      actor?: { personId: string; sessionId: string };
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw Errors.unauthenticated();
    }
    const token = header.slice(7);
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      });
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw Errors.unauthenticated('Your session has expired. Please sign in again.');
      }
      request.actor = { personId: payload.sub, sessionId: payload.sid };
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() },
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'UNAUTHENTICATED') {
        throw error;
      }
      throw Errors.unauthenticated('Your session has expired. Please sign in again.');
    }
  }
}
