import { Injectable } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async range(personId: string, start: string, end: string, timezone = 'Africa/Harare') {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const [enrollments, classMemberships, orgMemberships, studyMemberships, providerBookings] =
      await Promise.all([
        this.prisma.enrollment.findMany({ where: { personId, status: 'ACTIVE' } }),
        this.prisma.classMembership.findMany({ where: { personId, status: 'ACTIVE' } }),
        this.prisma.organizationMembership.findMany({ where: { personId, status: 'ACTIVE' } }),
        this.prisma.studyGroupMembership.findMany({ where: { personId, status: 'ACTIVE' } }),
        // A booking activity is owned by the customer, so the provider side is
        // pulled in through the bookings they own.
        this.prisma.booking.findMany({
          where: {
            provider: { personId },
            status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
            activityId: { not: null },
          },
          select: { activityId: true },
        }),
      ]);
    const providerActivityIds = providerBookings
      .map((item) => item.activityId)
      .filter((id): id is string => Boolean(id));

    const activities = await this.prisma.activity.findMany({
      where: {
        startTime: { lt: endDate },
        endTime: { gte: startDate },
        OR: [
          { ownerPersonId: personId },
          { courseOfferingId: { in: enrollments.map((item) => item.courseOfferingId) } },
          { classId: { in: classMemberships.map((item) => item.classId) } },
          { organizationId: { in: orgMemberships.map((item) => item.organizationId) } },
          { studyGroupId: { in: studyMemberships.map((item) => item.studyGroupId) } },
          { visibility: { in: ['PUBLIC', 'CAMPUS_ONLY'] }, sourceType: 'EVENT' },
          ...(providerActivityIds.length ? [{ id: { in: providerActivityIds } }] : []),
        ],
      },
      include: { event: true, courseOffering: { include: { course: true } } },
      orderBy: { startTime: 'asc' },
      take: 400,
    });

    return {
      timezone,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      activities: activities.map((item) => this.serialize(item)),
    };
  }

  async getActivity(personId: string, activityId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { event: true, courseOffering: { include: { course: true } } },
    });
    if (!activity) {
      throw Errors.notFound();
    }
    if (activity.ownerPersonId && activity.ownerPersonId !== personId) {
      throw Errors.permissionDenied();
    }
    return this.serialize(activity);
  }

  async createPersonal(
    personId: string,
    input: {
      title: string;
      startTime: string;
      endTime?: string;
      location?: string;
      description?: string;
      reminderOffsetMinutes?: number;
      recurrenceRule?: Prisma.InputJsonValue;
    },
  ) {
    const start = new Date(input.startTime);
    const end = input.endTime ? new Date(input.endTime) : start;
    if (end < start) {
      throw Errors.validation('End time must be after start time.');
    }
    const activity = await this.prisma.activity.create({
      data: {
        id: newId('activity'),
        type: 'PERSONAL_TASK',
        title: input.title.trim(),
        description: input.description,
        startTime: start,
        endTime: end,
        location: input.location,
        status: 'SCHEDULED',
        visibility: 'PRIVATE',
        ownerPersonId: personId,
        organizerType: 'PERSON',
        organizerId: personId,
        sourceType: null,
        sourceId: null,
        recurrenceRule: input.recurrenceRule,
        relevanceWeight: 20,
      },
    });
    if (input.reminderOffsetMinutes) {
      await this.prisma.activityReminder.create({
        data: {
          id: newId('arem'),
          activityId: activity.id,
          personId,
          offsetMinutes: input.reminderOffsetMinutes,
        },
      });
    }
    return this.serialize(activity);
  }

  async updatePersonal(personId: string, activityId: string, input: Prisma.ActivityUpdateInput) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity || activity.ownerPersonId !== personId) {
      throw Errors.permissionDenied();
    }
    if (activity.sourceType) {
      throw Errors.permissionDenied('Campus activities cannot be edited as personal items.');
    }
    const updated = await this.prisma.activity.update({
      where: { id: activityId },
      data: input,
    });
    return this.serialize(updated);
  }

  async cancelPersonal(personId: string, activityId: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity || activity.ownerPersonId !== personId) {
      throw Errors.permissionDenied();
    }
    return this.prisma.activity.update({
      where: { id: activityId },
      data: { status: 'CANCELLED' },
    });
  }

  async setReminder(personId: string, activityId: string, offsetMinutes: number) {
    await this.prisma.activityReminder.upsert({
      where: {
        activityId_personId_offsetMinutes: { activityId, personId, offsetMinutes },
      },
      update: {},
      create: { id: newId('arem'), activityId, personId, offsetMinutes },
    });
    return { ok: true };
  }

  private serialize(item: {
    id: string;
    type: ActivityType;
    title: string;
    description?: string | null;
    startTime: Date;
    endTime: Date;
    timezone?: string;
    location: string | null;
    status: string;
    sourceType: string | null;
    sourceId: string | null;
    visibility?: string;
    ownerPersonId?: string | null;
    event?: { id: string; status: string } | null;
    courseOffering?: { id: string; course: { code: string } } | null;
  }) {
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description ?? null,
      startTime: item.startTime.toISOString(),
      endTime: item.endTime.toISOString(),
      timezone: item.timezone ?? 'Africa/Harare',
      location: item.location,
      status: item.status,
      sourceObjectType: item.sourceType,
      sourceObjectId: item.sourceId,
      category: this.category(item.type),
      categoryLabel: this.categoryLabel(item.type),
      personal: Boolean(item.ownerPersonId) && !item.sourceType,
      route: this.route(item),
    };
  }

  private route(item: {
    sourceType: string | null;
    sourceId: string | null;
    event?: { id: string } | null;
    courseOffering?: { id: string } | null;
    id: string;
    ownerPersonId?: string | null;
  }) {
    if (item.sourceType === 'EVENT' && (item.event?.id || item.sourceId)) {
      return `/app/explore/event/${item.event?.id ?? item.sourceId}`;
    }
    if (item.sourceType === 'ASSESSMENT' && item.sourceId) {
      return `/app/learn/assignment/${item.sourceId}`;
    }
    if (item.sourceType === 'LABORATORY' && item.sourceId) {
      return `/app/learn/laboratory/${item.sourceId}`;
    }
    if (item.sourceType === 'BOOKING' && item.sourceId) {
      return `/app/services/bookings/${item.sourceId}`;
    }
    if (item.courseOffering?.id) {
      return `/app/learn/course/${item.courseOffering.id}`;
    }
    if (item.ownerPersonId) {
      return `/app/calendar/activity/${item.id}`;
    }
    return `/app/calendar/activity/${item.id}`;
  }

  private category(type: ActivityType) {
    if (['LECTURE', 'LABORATORY', 'TUTORIAL'].includes(type)) return 'ACADEMIC';
    if (['ASSIGNMENT_DEADLINE', 'TEST', 'EXAM'].includes(type)) return 'ASSESSMENT';
    if (['EVENT', 'ORGANIZATION_MEETING'].includes(type)) return 'ORGANIZATION';
    if (['SPORT_TRAINING', 'SPORT_MATCH'].includes(type)) return 'SPORT';
    if (type === 'SERVICE_BOOKING') return 'SERVICE';
    if (['PERSONAL_TASK', 'PERSONAL_REMINDER', 'PERSONAL_APPOINTMENT'].includes(type)) return 'PERSONAL';
    return 'SOCIAL';
  }

  private categoryLabel(type: ActivityType) {
    switch (this.category(type)) {
      case 'ACADEMIC':
        return 'Academic';
      case 'ASSESSMENT':
        return 'Assessment';
      case 'ORGANIZATION':
        return 'Organization';
      case 'SPORT':
        return 'Sport';
      case 'SERVICE':
        return 'Service';
      case 'PERSONAL':
        return 'Personal';
      default:
        return 'Social event';
    }
  }
}
