import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';

@Injectable()
export class VerificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(
    personId: string,
    input: {
      registrationNumber: string;
      programmeId: string;
      facultyId: string;
      evidenceFileId?: string;
    },
  ) {
    const programme = await this.prisma.programme.findUnique({
      where: { id: input.programmeId },
    });
    if (!programme || programme.facultyId !== input.facultyId) {
      throw Errors.validation('Select a valid programme and faculty.');
    }
    if (input.evidenceFileId) {
      const file = await this.prisma.fileObject.findUnique({
        where: { id: input.evidenceFileId },
      });
      if (!file || file.uploaderId !== personId) {
        throw Errors.validation('Student ID evidence could not be verified.');
      }
    }

    const verification = await this.prisma.studentVerification.create({
      data: {
        id: newId('stuv'),
        personId,
        registrationNumber: input.registrationNumber.trim(),
        programmeId: input.programmeId,
        facultyId: input.facultyId,
        evidenceFileId: input.evidenceFileId,
        status: 'PENDING',
      },
    });

    await this.prisma.person.update({
      where: { id: personId },
      data: { accountState: 'STUDENT_VERIFICATION_PENDING' },
    });

    return {
      id: verification.id,
      status: verification.status,
    };
  }

  async mine(personId: string) {
    const latest = await this.prisma.studentVerification.findFirst({
      where: { personId },
      orderBy: { createdAt: 'desc' },
      include: { programme: true },
    });
    if (!latest) {
      return { status: 'NONE' };
    }
    return {
      id: latest.id,
      status: latest.status,
      programmeName: latest.programme.name,
      rejectionReason:
        latest.status === 'REJECTED'
          ? latest.rejectionReason ?? "We couldn't verify your information."
          : null,
    };
  }
}
