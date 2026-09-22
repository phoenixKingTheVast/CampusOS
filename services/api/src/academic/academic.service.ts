import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  programmes() {
    return this.prisma.programme.findMany({
      include: { faculty: true },
      orderBy: { name: 'asc' },
    }).then((items) => ({
      items: items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        facultyId: item.facultyId,
        facultyName: item.faculty.name,
      })),
    }));
  }

  async searchClasses(search?: string) {
    const items = await this.prisma.academicClass.findMany({
      where: search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        semester: true,
        memberships: { where: { status: 'ACTIVE', role: 'CLASS_REPRESENTATIVE' } },
      },
      take: 20,
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        yearOfStudy: item.yearOfStudy,
        facultyName: item.facultyName,
        semester: item.semester.label,
        representativeCount: item.memberships.length,
        canRequestMembership: item.memberships.length > 0,
      })),
    };
  }

  async requestClassMembership(personId: string, classId: string) {
    const academicClass = await this.prisma.academicClass.findUnique({
      where: { id: classId },
      include: {
        memberships: { where: { status: 'ACTIVE', role: 'CLASS_REPRESENTATIVE' } },
      },
    });
    if (!academicClass) {
      throw Errors.notFound('Class not found.');
    }
    if (academicClass.memberships.length === 0) {
      throw Errors.validation(
        'This class cannot currently process new membership requests. You can still use other CampusOS features.',
      );
    }

    const existing = await this.prisma.classMembership.findUnique({
      where: { classId_personId: { classId, personId } },
    });
    if (existing?.status === 'ACTIVE') {
      return existing;
    }
    const membership = await this.prisma.classMembership.upsert({
      where: { classId_personId: { classId, personId } },
      update: { status: 'PENDING' },
      create: {
        id: newId('cm'),
        classId,
        personId,
        status: 'PENDING',
      },
    });
    await this.prisma.person.update({
      where: { id: personId },
      data: { accountState: 'CLASS_VERIFICATION_PENDING' },
    });
    for (const representative of academicClass.memberships) {
      await this.notifications.emit({
        personId: representative.personId,
        type: 'CLASS_MEMBERSHIP',
        category: 'CLASS',
        title: 'New class membership request',
        body: 'A student has requested to join your class.',
        sourceType: 'CLASS_MEMBERSHIP',
        sourceId: membership.id,
        deepLink: '/app/onboarding/class-verification',
        sourceEventId: membership.id,
      });
    }
    return membership;
  }

  async pendingMemberships(actorId: string) {
    const reps = await this.prisma.classMembership.findMany({
      where: { personId: actorId, role: 'CLASS_REPRESENTATIVE', status: 'ACTIVE' },
    });
    if (reps.length === 0) {
      throw Errors.permissionDenied();
    }
    const items = await this.prisma.classMembership.findMany({
      where: {
        classId: { in: reps.map((item) => item.classId) },
        status: 'PENDING',
      },
      include: {
        person: true,
        class: true,
      },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        displayName: item.person.displayName,
        classCode: item.class.code,
        className: item.class.name,
      })),
    };
  }

  async approveMembership(actorId: string, membershipId: string) {
    const membership = await this.prisma.classMembership.findUnique({
      where: { id: membershipId },
      include: { class: true },
    });
    if (!membership) {
      throw Errors.notFound();
    }
    const actor = await this.prisma.classMembership.findUnique({
      where: { classId_personId: { classId: membership.classId, personId: actorId } },
    });
    if (!actor || actor.role !== 'CLASS_REPRESENTATIVE' || actor.status !== 'ACTIVE') {
      throw Errors.permissionDenied();
    }
    if (membership.status !== 'PENDING') {
      throw Errors.conflict('This membership request is no longer pending.');
    }
    const updated = await this.prisma.classMembership.update({
      where: { id: membershipId },
      data: { status: 'ACTIVE' },
    });
    await this.prisma.person.update({
      where: { id: membership.personId },
      data: { accountState: 'ACTIVE' },
    });
    await this.notifications.emit({
      personId: membership.personId,
      type: 'CLASS_MEMBERSHIP',
      category: 'CLASS',
      title: `You've been added to ${membership.class.code}.`,
      body: `${membership.class.name} is now available under Learn.`,
      sourceType: 'CLASS',
      sourceId: membership.classId,
      sourceEventId: `${membership.id}:approved`,
    });
    return updated;
  }

  async rejectMembership(actorId: string, membershipId: string) {
    const membership = await this.prisma.classMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership) {
      throw Errors.notFound();
    }
    const actor = await this.prisma.classMembership.findUnique({
      where: { classId_personId: { classId: membership.classId, personId: actorId } },
    });
    if (!actor || actor.role !== 'CLASS_REPRESENTATIVE' || actor.status !== 'ACTIVE') {
      throw Errors.permissionDenied();
    }
    return this.prisma.classMembership.update({
      where: { id: membershipId },
      data: { status: 'REJECTED' },
    });
  }

  async getOffering(personId: string, courseOfferingId: string) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context || !context.can('VIEW')) {
      throw Errors.permissionDenied("You don't have access to this course.");
    }
    const { offering } = context;
    const personnel = await this.prisma.coursePersonnel.findMany({
      where: { courseOfferingId },
      include: { person: true },
    });
    const nextActivities = await this.prisma.activity.findMany({
      where: {
        courseOfferingId,
        status: { in: ['SCHEDULED', 'ONGOING'] },
        endTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
      take: 3,
    });
    return {
      courseOffering: {
        courseOfferingId: offering.id,
        courseId: offering.courseId,
        code: offering.course.code,
        title: offering.course.title,
        semester: offering.semester.label,
        status: offering.status,
        department: offering.course.department,
        faculty: (await this.prisma.faculty.findUnique({
          where: { id: offering.course.facultyId },
        }))?.name,
        lecturers: personnel
          .filter((item) => item.role === 'LECTURER')
          .map((item) => ({
            id: item.person.id,
            name: item.person.displayName,
          })),
        nextActivity: nextActivities[0]
          ? {
              id: nextActivities[0].id,
              type: nextActivities[0].type,
              title: nextActivities[0].title,
              startTime: nextActivities[0].startTime.toISOString(),
              location: nextActivities[0].location,
            }
          : null,
      },
      overview: {
        description: offering.description,
        learningOutcomes: offering.learningOutcomes,
        outline: offering.outline,
        references: offering.references,
      },
      personnel: personnel.map((item) => ({
        id: item.person.id,
        name: item.person.displayName,
        role: item.role,
      })),
      nextActivities: nextActivities.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        startTime: item.startTime.toISOString(),
        endTime: item.endTime.toISOString(),
        location: item.location,
        status: item.status,
      })),
      permissions: [...context.permissions],
    };
  }

  async getClass(personId: string, classId: string) {
    const academicClass = await this.prisma.academicClass.findUnique({
      where: { id: classId },
      include: {
        semester: true,
        memberships: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          include: { person: true },
        },
        activities: {
          where: { status: { in: ['SCHEDULED', 'ONGOING'] }, endTime: { gte: new Date() } },
          orderBy: { startTime: 'asc' },
          take: 8,
        },
      },
    });
    if (!academicClass) {
      throw Errors.notFound('This class is no longer available.');
    }
    const mine = academicClass.memberships.find((item) => item.personId === personId);
    const isMember = mine?.status === 'ACTIVE';
    const representatives = academicClass.memberships.filter(
      (item) => item.status === 'ACTIVE' && item.role === 'CLASS_REPRESENTATIVE',
    );
    const announcementCount = isMember
      ? await this.prisma.announcement.count({
          where: {
            status: 'PUBLISHED',
            courseOffering: { enrollments: { some: { personId, status: 'ACTIVE' } } },
          },
        })
      : 0;
    return {
      id: academicClass.id,
      code: academicClass.code,
      name: academicClass.name,
      yearOfStudy: academicClass.yearOfStudy,
      facultyName: academicClass.facultyName,
      semester: academicClass.semester.label,
      membershipStatus: mine?.status ?? 'NONE',
      membershipRole: mine?.role ?? null,
      representativeCount: representatives.length,
      canRequestMembership: representatives.length > 0 && !isMember && mine?.status !== 'PENDING',
      announcementCount,
      upcomingCount: academicClass.activities.length,
      representatives: representatives.map((item) => ({
        id: item.person.id,
        name: item.person.displayName,
      })),
      members: isMember
        ? academicClass.memberships
            .filter((item) => item.status === 'ACTIVE')
            .map((item) => ({
              id: item.person.id,
              name: item.person.displayName,
              role: item.role,
            }))
        : [],
      activities: isMember
        ? academicClass.activities.map((item) => ({
            id: item.id,
            title: item.title,
            type: item.type,
            startTime: item.startTime.toISOString(),
            location: item.location,
            route: `/app/calendar/activity/${item.id}`,
          }))
        : [],
      route: `/app/class/${academicClass.id}`,
    };
  }

  async people(personId: string, courseOfferingId: string) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied("You don't have access to this course.");
    }
    const [personnel, enrollments] = await Promise.all([
      this.prisma.coursePersonnel.findMany({
        where: { courseOfferingId },
        include: { person: true },
      }),
      this.prisma.enrollment.findMany({
        where: { courseOfferingId, status: 'ACTIVE' },
        include: { person: true },
        take: 80,
      }),
    ]);
    return {
      teachingTeam: personnel.map((item) => ({
        id: item.person.id,
        name: item.person.displayName,
        role: item.role,
        route: `/app/profile/${item.person.id}`,
      })),
      students: enrollments.map((item) => ({
        id: item.person.id,
        name: item.person.displayName,
        role: 'STUDENT',
        route: `/app/profile/${item.person.id}`,
      })),
      permissions: [...context.permissions],
    };
  }
}
