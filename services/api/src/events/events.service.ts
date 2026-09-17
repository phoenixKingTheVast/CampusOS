import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';

const RESPONSE_STATES = new Set(['NONE', 'INTERESTED', 'GOING', 'NOT_GOING', 'WAITLISTED']);

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(personId: string, query?: { type?: string; upcoming?: string }) {
    const items = await this.prisma.campusEvent.findMany({
      where: {
        status: { in: ['PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED'] },
        ...(query?.type ? { eventType: query.type } : {}),
        ...(query?.upcoming === 'true' ? { startsAt: { gte: new Date() } } : {}),
      },
      include: { organization: true, venue: true },
      orderBy: { startsAt: 'asc' },
      take: 50,
    });
    const visible = [];
    for (const item of items) {
      if (await this.canView(personId, item)) {
        visible.push(this.serialize(item, null, { going: 0, interested: 0 }));
      }
    }
    return { items: visible };
  }

  async get(personId: string, eventId: string) {
    const event = await this.prisma.campusEvent.findUnique({
      where: { id: eventId },
      include: { organization: true, venue: true, createdBy: true, activities: true },
    });
    if (!event) {
      throw Errors.notFound('This event is no longer available.');
    }
    if (!(await this.canView(personId, event))) {
      throw Errors.notFound('This event is no longer available.');
    }
    const [counts, mine, membership] = await Promise.all([
      this.responseCounts(event.id),
      this.prisma.eventResponse.findUnique({
        where: { eventId_personId: { eventId: event.id, personId } },
      }),
      event.organizationId
        ? this.prisma.organizationMembership.findUnique({
            where: { organizationId_personId: { organizationId: event.organizationId, personId } },
          })
        : null,
    ]);
    return {
      ...this.serialize(event, mine?.response ?? 'NONE', counts),
      description: event.description,
      timezone: event.timezone,
      participationPolicy: event.participationPolicy,
      capacity: event.capacity,
      registrationRequired: event.registrationRequired,
      externalRegistrationUrl: event.externalRegistrationUrl,
      contactInformation: event.contactInformation,
      venue: event.venue,
      activityId: event.activities[0]?.id ?? event.activityId,
      createdByName: event.createdBy?.displayName ?? null,
      organizerName: event.organization?.name ?? event.organizerType,
      permissions: this.permissions(event, membership),
      cancelled: event.status === 'CANCELLED',
      originalSchedule:
        event.status === 'CANCELLED'
          ? { startsAt: event.startsAt.toISOString(), location: event.location }
          : null,
    };
  }

  async create(
    personId: string,
    input: {
      title: string;
      description?: string;
      eventType?: string;
      organizerType: string;
      organizerId?: string;
      organizationId?: string;
      startsAt: string;
      endsAt?: string;
      timezone?: string;
      location?: string;
      venueId?: string;
      visibility?: string;
      participationPolicy?: string;
      capacity?: number;
      registrationRequired?: boolean;
      externalRegistrationUrl?: string;
      recurrenceRule?: Prisma.InputJsonValue;
      publish?: boolean;
    },
  ) {
    this.validateTimes(input.startsAt, input.endsAt);
    if (input.capacity != null && input.capacity < 1) {
      throw Errors.validation('Capacity must be at least 1.');
    }
    await this.assertCanCreate(personId, input);

    const status = input.publish === false ? 'DRAFT' : 'PUBLISHED';
    const event = await this.prisma.campusEvent.create({
      data: {
        id: newId('event'),
        title: input.title.trim(),
        description: input.description,
        eventType: input.eventType ?? 'ORGANIZATION',
        status,
        organizerType: input.organizerType,
        organizerId: input.organizerId ?? input.organizationId,
        organizationId: input.organizationId,
        createdById: personId,
        visibility: input.visibility ?? 'CAMPUS_ONLY',
        participationPolicy: input.participationPolicy ?? 'OPEN',
        capacity: input.capacity,
        venueId: input.venueId,
        location: input.location,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        timezone: input.timezone ?? 'Africa/Harare',
        registrationRequired: input.registrationRequired ?? false,
        externalRegistrationUrl: input.externalRegistrationUrl,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });

    const activity = await this.prisma.activity.create({
      data: {
        id: newId('activity'),
        type: 'EVENT',
        title: event.title,
        description: event.description,
        startTime: event.startsAt,
        endTime: event.endsAt ?? event.startsAt,
        timezone: event.timezone,
        location: event.location,
        status: 'SCHEDULED',
        relevanceWeight: 60,
        sourceType: 'EVENT',
        sourceId: event.id,
        organizerType: event.organizerType,
        organizerId: event.organizerId,
        visibility: event.visibility,
        recurrenceRule: input.recurrenceRule,
        organizationId: event.organizationId,
        eventId: event.id,
      },
    });
    await this.prisma.campusEvent.update({
      where: { id: event.id },
      data: { activityId: activity.id },
    });
    await this.audit(event.id, personId, 'EVENT_CREATED', null, event);
    return this.get(personId, event.id);
  }

  async publish(personId: string, eventId: string) {
    const event = await this.requireOrganizer(personId, eventId);
    if (event.status !== 'DRAFT' && event.status !== 'PENDING_APPROVAL') {
      throw Errors.conflict('This event cannot be published.');
    }
    const updated = await this.prisma.campusEvent.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED', publishedAt: new Date(), version: { increment: 1 } },
    });
    await this.audit(eventId, personId, 'EVENT_PUBLISHED', event, updated);
    return this.get(personId, eventId);
  }

  async reschedule(
    personId: string,
    eventId: string,
    input: { startsAt: string; endsAt?: string; location?: string; expectedVersion?: number },
  ) {
    const event = await this.requireOrganizer(personId, eventId);
    if (input.expectedVersion != null && input.expectedVersion !== event.version) {
      throw Errors.conflict();
    }
    this.validateTimes(input.startsAt, input.endsAt);
    const previous = { startsAt: event.startsAt, location: event.location };
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.campusEvent.update({
        where: { id: eventId },
        data: {
          startsAt: new Date(input.startsAt),
          endsAt: input.endsAt ? new Date(input.endsAt) : event.endsAt,
          location: input.location ?? event.location,
          version: { increment: 1 },
        },
      });
      await tx.activity.updateMany({
        where: { eventId },
        data: {
          startTime: next.startsAt,
          endTime: next.endsAt ?? next.startsAt,
          location: next.location,
          status: 'RESCHEDULED',
        },
      });
      return next;
    });
    await this.audit(eventId, personId, 'EVENT_RESCHEDULED', previous, updated);
    await this.notifyRespondents(
      eventId,
      updated.title,
      `Rescheduled to ${updated.startsAt.toISOString()}`,
    );
    return this.get(personId, eventId);
  }

  async cancel(personId: string, eventId: string, reason?: string) {
    const event = await this.requireOrganizer(personId, eventId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.campusEvent.update({
        where: { id: eventId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), version: { increment: 1 } },
      });
      await tx.activity.updateMany({
        where: { eventId },
        data: { status: 'CANCELLED' },
      });
      await tx.activityReminder.deleteMany({ where: { activity: { eventId } } });
      return next;
    });
    await this.audit(eventId, personId, 'EVENT_CANCELLED', event, { ...updated, reason });
    await this.notifyRespondents(eventId, updated.title, 'This event has been cancelled.');
    return this.get(personId, eventId);
  }

  async respond(personId: string, eventId: string, response: string) {
    if (!RESPONSE_STATES.has(response)) {
      throw Errors.validation('Choose a valid response.');
    }
    const event = await this.prisma.campusEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status === 'CANCELLED' || event.status === 'DRAFT') {
      throw Errors.notFound('This event is no longer available.');
    }
    if (!(await this.canParticipate(personId, event))) {
      throw Errors.permissionDenied();
    }
    if (response === 'NONE') {
      await this.prisma.eventResponse.deleteMany({ where: { eventId, personId } });
      return { response: 'NONE', confirmed: true };
    }

    let next = response;
    if (response === 'GOING' && event.capacity) {
      const going = await this.prisma.eventResponse.count({
        where: { eventId, response: 'GOING', NOT: { personId } },
      });
      if (going >= event.capacity) {
        next = 'WAITLISTED';
      }
    }

    await this.prisma.eventResponse.upsert({
      where: { eventId_personId: { eventId, personId } },
      update: { response: next },
      create: { id: newId('ersp'), eventId, personId, response: next },
    });
    return {
      response: next,
      confirmed: true,
      waitlisted: next === 'WAITLISTED',
      message:
        next === 'WAITLISTED'
          ? 'Your response could not be confirmed as Going. The event is currently full.'
          : null,
    };
  }

  async responses(personId: string, eventId: string) {
    const event = await this.get(personId, eventId);
    const counts = await this.responseCounts(eventId);
    if (event.participantVisibility === 'ORGANIZER_ONLY') {
      return { counts, items: [] };
    }
    if (event.participantVisibility === 'HIDDEN' || event.participantVisibility === 'COUNT_ONLY') {
      return { counts, items: [] };
    }
    const items = await this.prisma.eventResponse.findMany({
      where: { eventId, response: { in: ['GOING', 'INTERESTED'] } },
      include: { person: true },
    });
    return {
      counts,
      items: items.map((item) => ({
        personId: item.personId,
        name: item.person.displayName,
        response: item.response,
      })),
    };
  }

  async report(personId: string, eventId: string, reason: string, details?: string) {
    await this.prisma.moderationReport.create({
      data: {
        id: newId('rep'),
        reporterId: personId,
        targetType: 'EVENT',
        targetId: eventId,
        reason: reason as never,
        details,
      },
    });
    return { ok: true };
  }

  private validateTimes(start: string, end?: string) {
    const startsAt = new Date(start);
    if (Number.isNaN(startsAt.getTime())) {
      throw Errors.validation('Enter a valid start time.');
    }
    if (end) {
      const endsAt = new Date(end);
      if (endsAt <= startsAt) {
        throw Errors.validation('End time must be after start time.');
      }
    }
  }

  private async assertCanCreate(
    personId: string,
    input: { organizerType: string; organizationId?: string; organizerId?: string },
  ) {
    if (input.organizerType === 'PERSON') {
      return;
    }
    if (input.organizerType === 'ORGANIZATION') {
      const organizationId = input.organizationId ?? input.organizerId;
      if (!organizationId) {
        throw Errors.validation('Choose an organization.');
      }
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org || org.status !== 'ACTIVE') {
        throw Errors.permissionDenied('A suspended organization cannot create new events.');
      }
      const membership = await this.prisma.organizationMembership.findUnique({
        where: { organizationId_personId: { organizationId, personId } },
      });
      if (!membership || membership.status !== 'ACTIVE' || !['OFFICER', 'ADMIN'].includes(membership.role)) {
        throw Errors.permissionDenied();
      }
      return;
    }
    if (input.organizerType === 'COURSE') {
      const enrollment = await this.prisma.coursePersonnel.findFirst({
        where: { courseOfferingId: input.organizerId, personId },
      });
      if (!enrollment) {
        throw Errors.permissionDenied();
      }
    }
  }

  private async canView(
    personId: string,
    event: { status: string; visibility: string; organizationId: string | null; createdById: string | null },
  ) {
    if (event.status === 'DRAFT') {
      return event.createdById === personId;
    }
    if (event.visibility === 'PUBLIC' || event.visibility === 'CAMPUS_ONLY') {
      return true;
    }
    if (event.visibility === 'CONTEXT_ONLY' && event.organizationId) {
      const membership = await this.prisma.organizationMembership.findUnique({
        where: { organizationId_personId: { organizationId: event.organizationId, personId } },
      });
      return membership?.status === 'ACTIVE';
    }
    if (event.visibility === 'INVITE_ONLY') {
      const response = await this.prisma.eventResponse.findUnique({
        where: { eventId_personId: { eventId: (event as { id?: string }).id ?? '', personId } },
      });
      return Boolean(response) || event.createdById === personId;
    }
    return true;
  }

  private async canParticipate(personId: string, event: { participationPolicy: string; organizationId: string | null }) {
    if (event.participationPolicy === 'OPEN' || event.participationPolicy === 'NO_RESPONSE') {
      return event.participationPolicy === 'OPEN';
    }
    if (event.participationPolicy === 'MEMBERS_ONLY' && event.organizationId) {
      const membership = await this.prisma.organizationMembership.findUnique({
        where: { organizationId_personId: { organizationId: event.organizationId, personId } },
      });
      return membership?.status === 'ACTIVE';
    }
    return true;
  }

  private async requireOrganizer(personId: string, eventId: string) {
    const event = await this.prisma.campusEvent.findUnique({ where: { id: eventId } });
    if (!event) {
      throw Errors.notFound();
    }
    if (event.createdById === personId) {
      return event;
    }
    if (event.organizationId) {
      const membership = await this.prisma.organizationMembership.findUnique({
        where: { organizationId_personId: { organizationId: event.organizationId, personId } },
      });
      if (membership && ['OFFICER', 'ADMIN'].includes(membership.role) && membership.status === 'ACTIVE') {
        return event;
      }
    }
    throw Errors.permissionDenied();
  }

  private permissions(
    event: { status: string; createdById: string | null },
    membership: { role: string; status: string } | null,
  ) {
    const actions = ['VIEW', 'RESPOND', 'SHARE', 'ADD_REMINDER'];
    const organizer =
      membership?.status === 'ACTIVE' && ['OFFICER', 'ADMIN'].includes(membership.role);
    if (organizer || event.createdById) {
      if (event.status !== 'CANCELLED' && event.status !== 'COMPLETED') {
        actions.push('EDIT', 'CANCEL', 'RESCHEDULE', 'POST_UPDATE');
      }
    }
    return actions;
  }

  private async responseCounts(eventId: string) {
    const grouped = await this.prisma.eventResponse.groupBy({
      by: ['response'],
      where: { eventId },
      _count: { _all: true },
    });
    const counts = { going: 0, interested: 0, waitlisted: 0, notGoing: 0 };
    for (const row of grouped) {
      if (row.response === 'GOING') counts.going = row._count._all;
      if (row.response === 'INTERESTED') counts.interested = row._count._all;
      if (row.response === 'WAITLISTED') counts.waitlisted = row._count._all;
      if (row.response === 'NOT_GOING') counts.notGoing = row._count._all;
    }
    return counts;
  }

  private async notifyRespondents(eventId: string, title: string, body: string) {
    const respondents = await this.prisma.eventResponse.findMany({
      where: { eventId, response: { in: ['GOING', 'INTERESTED', 'WAITLISTED'] } },
    });
    if (respondents.length === 0) {
      return;
    }
    await this.notifications.emitMany(
      respondents.map((item) => ({
        personId: item.personId,
        type: 'EVENT_CHANGED',
        category: 'ORGANIZATION' as const,
        title,
        body,
        sourceType: 'EVENT',
        sourceId: eventId,
        priority: 'HIGH' as const,
        sourceEventId: `${eventId}:${body}`,
      })),
    );
  }

  private async audit(eventId: string, actorId: string, action: string, previousValues: unknown, newValues: unknown) {
    await this.prisma.eventAudit.create({
      data: {
        id: newId('eaud'),
        eventId,
        actorId,
        action,
        previousValues: previousValues as Prisma.InputJsonValue,
        newValues: newValues as Prisma.InputJsonValue,
      },
    });
  }

  private serialize(
    event: {
      id: string;
      title: string;
      eventType: string;
      status: string;
      startsAt: Date;
      endsAt: Date | null;
      location: string | null;
      visibility: string;
      organization?: { name: string } | null;
      participantVisibility?: string;
    },
    myResponse: string | null,
    counts: { going: number; interested: number },
  ) {
    return {
      id: event.id,
      title: event.title,
      eventType: event.eventType,
      status: event.status,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      location: event.location,
      visibility: event.visibility,
      organizerName: event.organization?.name ?? null,
      myResponse,
      goingCount: counts.going,
      interestedCount: counts.interested,
      participantVisibility: event.participantVisibility ?? 'COUNT_ONLY',
      route: `/app/explore/event/${event.id}`,
      categoryLabel: this.categoryLabel(event.eventType),
    };
  }

  private categoryLabel(type: string) {
    switch (type) {
      case 'ACADEMIC':
        return 'Academic event';
      case 'SPORT':
        return 'Sport event';
      case 'RELIGIOUS':
        return 'Religious event';
      default:
        return 'Campus event';
    }
  }
}
