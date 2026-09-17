import { Injectable } from '@nestjs/common';
import { AttentionPriority, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import { hasDerivedParticipants } from '../messaging/messaging-rules';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationCategory,
  notificationDeepLink,
  notificationIdempotencyKey,
  preferenceAllows,
  quietHoursSuppressPush,
} from './notification-rules';

export type EmitNotification = {
  personId: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  sourceType: string;
  sourceId: string;
  sourceActivityId?: string;
  deepLink?: string;
  priority?: AttentionPriority;
  announcementId?: string;
  resourceId?: string;
  idempotencyKey?: string;
  sourceEventId?: string;
  expiresAt?: Date;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(input: EmitNotification): Promise<boolean> {
    const prefs = await this.preferencesFor(input.personId);
    if (!preferenceAllows(input.type, input.category, prefs)) {
      return false;
    }
    const key =
      input.idempotencyKey ??
      (input.sourceEventId
        ? notificationIdempotencyKey(input.sourceEventId, input.personId, input.type)
        : undefined);
    if (key) {
      const existing = await this.prisma.notification.findUnique({ where: { idempotencyKey: key } });
      if (existing) {
        return false;
      }
    }
    const deepLink = notificationDeepLink({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      announcementId: input.announcementId,
      resourceId: input.resourceId,
      deepLink: input.deepLink,
    });
    try {
      const notification = await this.prisma.notification.create({
        data: {
          id: newId('ntf'),
          personId: input.personId,
          type: input.type,
          category: input.category,
          title: input.title,
          body: input.body,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          sourceActivityId: input.sourceActivityId,
          deepLink,
          priority: input.priority ?? 'NORMAL',
          announcementId: input.announcementId,
          resourceId: input.resourceId,
          idempotencyKey: key,
          expiresAt: input.expiresAt,
          status: 'DELIVERED',
          deliveredAt: new Date(),
        },
      });
      await this.prisma.notificationDelivery.create({
        data: {
          id: newId('ntd'),
          notificationId: notification.id,
          channel: 'IN_APP',
          status: 'DELIVERED',
          deliveredAt: new Date(),
        },
      });
      const quiet = quietHoursSuppressPush(input.priority ?? 'NORMAL', new Date(), prefs.quietHoursStart, prefs.quietHoursEnd);
      if (!quiet && input.priority !== 'LOW') {
        await this.prisma.notificationDelivery.create({
          data: {
            id: newId('ntd'),
            notificationId: notification.id,
            channel: 'PUSH',
            status: 'QUEUED',
          },
        });
      }
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async emitMany(items: EmitNotification[]) {
    for (const item of items) {
      await this.emit(item);
    }
  }

  async list(personId: string, query?: { category?: string; unread?: string; cursor?: string }) {
    const items = await this.prisma.notification.findMany({
      where: {
        personId,
        ...(query?.category && query.category !== 'ALL' ? { category: query.category.toUpperCase() } : {}),
        ...(query?.unread === 'true' ? { readAt: null } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }, { category: 'SYSTEM' }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      ...(query?.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return {
      items: items.map((item) => this.serialize(item)),
      nextCursor: items.length === 50 ? items[items.length - 1].id : null,
    };
  }

  async unreadCount(personId: string) {
    const count = await this.prisma.notification.count({
      where: {
        personId,
        readAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }, { category: 'SYSTEM' }],
      },
    });
    return { count };
  }

  async markRead(personId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, personId },
      data: { readAt: new Date(), seenAt: new Date(), status: 'READ' },
    });
    return { ok: true };
  }

  async markMany(personId: string, notificationIds: string[]) {
    if (!notificationIds.length) {
      return { ok: true };
    }
    await this.prisma.notification.updateMany({
      where: { personId, id: { in: notificationIds } },
      data: { readAt: new Date(), seenAt: new Date(), status: 'READ' },
    });
    return { ok: true };
  }

  async markAll(personId: string) {
    await this.prisma.notification.updateMany({
      where: { personId, readAt: null },
      data: { readAt: new Date(), seenAt: new Date(), status: 'READ' },
    });
    return { ok: true };
  }

  async open(personId: string, id: string) {
    const item = await this.prisma.notification.findFirst({ where: { id, personId } });
    if (!item) {
      throw Errors.notFound('This content is no longer available to you.');
    }
    await this.prisma.notification.updateMany({
      where: { id, personId },
      data: { seenAt: item.seenAt ?? new Date(), readAt: new Date(), status: 'READ' },
    });
    const allowed = await this.sourceStillAllowed(personId, item);
    if (!allowed) {
      throw Errors.notFound('This content is no longer available to you.');
    }
    return {
      route: notificationDeepLink(item),
      sourceType: item.sourceType,
      sourceId: item.sourceId,
    };
  }

  async preferences(personId: string) {
    return this.serializePreferences(await this.ensurePreferences(personId));
  }

  async updatePreferences(
    personId: string,
    input: Partial<{
      directMessages: boolean;
      mentions: boolean;
      groupMessages: boolean;
      academicImportant: boolean;
      assignments: boolean;
      resources: boolean;
      classUpdates: boolean;
      organizationEvents: boolean;
      organizationPosts: boolean;
      serviceUpdates: boolean;
      follows: boolean;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
    }>,
  ) {
    await this.ensurePreferences(personId);
    const updated = await this.prisma.notificationPreference.update({
      where: { personId },
      data: input,
    });
    return this.serializePreferences(updated);
  }

  async registerDevice(
    personId: string,
    input: { platform: string; pushToken?: string; appVersion?: string; notificationEnabled?: boolean },
  ) {
    if (input.pushToken) {
      const existing = await this.prisma.device.findFirst({
        where: { personId, pushToken: input.pushToken, revokedAt: null },
      });
      if (existing) {
        return this.prisma.device.update({
          where: { id: existing.id },
          data: { lastSeenAt: new Date(), appVersion: input.appVersion, notificationEnabled: input.notificationEnabled ?? true },
        });
      }
    }
    return this.prisma.device.create({
      data: {
        id: newId('dev'),
        personId,
        platform: input.platform,
        pushToken: input.pushToken,
        appVersion: input.appVersion,
        notificationEnabled: input.notificationEnabled ?? true,
      },
    });
  }

  async updateDevice(
    personId: string,
    deviceId: string,
    input: { pushToken?: string; appVersion?: string; notificationEnabled?: boolean },
  ) {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, personId, revokedAt: null } });
    if (!device) {
      throw Errors.notFound();
    }
    return this.prisma.device.update({
      where: { id: deviceId },
      data: {
        pushToken: input.pushToken,
        appVersion: input.appVersion,
        notificationEnabled: input.notificationEnabled,
        lastSeenAt: new Date(),
      },
    });
  }

  async revokeDevice(personId: string, deviceId: string) {
    await this.prisma.device.updateMany({
      where: { id: deviceId, personId },
      data: { revokedAt: new Date(), notificationEnabled: false, pushToken: null },
    });
    return { ok: true };
  }

  recordCreateMany(items: EmitNotification[]): Prisma.NotificationCreateManyInput[] {
    return items.map((input) => ({
      id: newId('ntf'),
      personId: input.personId,
      type: input.type,
      category: input.category,
      title: input.title,
      body: input.body,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceActivityId: input.sourceActivityId,
      deepLink: notificationDeepLink(input),
      priority: input.priority ?? 'NORMAL',
      announcementId: input.announcementId,
      resourceId: input.resourceId,
      status: 'DELIVERED',
      deliveredAt: new Date(),
    }));
  }

  private async sourceStillAllowed(personId: string, item: { sourceType: string; sourceId: string }) {
    if (item.sourceType === 'CONVERSATION') {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: item.sourceId },
        include: { participants: { where: { personId, status: 'ACTIVE' } } },
      });
      if (!conversation || conversation.status !== 'ACTIVE') {
        return false;
      }
      // Derived-participant conversations are gated by domain membership, which
      // the conversation endpoint re-checks; stored participants we check here.
      return hasDerivedParticipants(conversation.kind) || conversation.participants.length > 0;
    }
    if (item.sourceType === 'BOOKING') {
      const booking = await this.prisma.booking.findUnique({
        where: { id: item.sourceId },
        select: { customerId: true, provider: { select: { personId: true } } },
      });
      return Boolean(
        booking && (booking.customerId === personId || booking.provider.personId === personId),
      );
    }
    if (item.sourceType === 'SERVICE') {
      const service = await this.prisma.service.findUnique({
        where: { id: item.sourceId },
        select: { status: true },
      });
      return Boolean(service && service.status !== 'DISCONTINUED');
    }
    if (item.sourceType === 'EVENT') {
      const event = await this.prisma.campusEvent.findUnique({ where: { id: item.sourceId } });
      return Boolean(event && event.status !== 'REMOVED');
    }
    if (item.sourceType === 'RESOURCE') {
      const resource = await this.prisma.resource.findUnique({ where: { id: item.sourceId } });
      return Boolean(resource && resource.status !== 'REMOVED');
    }
    if (item.sourceType === 'ASSESSMENT') {
      const assessment = await this.prisma.assessment.findUnique({ where: { id: item.sourceId } });
      return Boolean(assessment);
    }
    if (item.sourceType === 'PERSON' || item.sourceType === 'CONNECTION' || item.sourceType === 'FOLLOW') {
      const blocked = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: personId, blockedId: item.sourceId },
            { blockerId: item.sourceId, blockedId: personId },
          ],
        },
      });
      return !blocked;
    }
    return true;
  }

  private async preferencesFor(personId: string) {
    const row = await this.prisma.notificationPreference.findUnique({ where: { personId } });
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHoursStart: row?.quietHoursStart ?? null,
      quietHoursEnd: row?.quietHoursEnd ?? null,
      ...(row ?? {}),
    };
  }

  private async ensurePreferences(personId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({ where: { personId } });
    if (existing) {
      return existing;
    }
    return this.prisma.notificationPreference.create({
      data: { id: newId('npref'), personId },
    });
  }

  private serialize(item: {
    id: string;
    type: string;
    category: string;
    priority: string;
    title: string;
    body: string;
    sourceType: string;
    sourceId: string;
    deepLink: string | null;
    status: string;
    createdAt: Date;
    deliveredAt: Date | null;
    seenAt: Date | null;
    readAt: Date | null;
    expiresAt: Date | null;
    announcementId: string | null;
    resourceId: string | null;
  }) {
    return {
      id: item.id,
      type: item.type,
      category: item.category,
      priority: item.priority,
      title: item.title,
      body: item.body,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      deepLink: notificationDeepLink(item),
      route: notificationDeepLink(item),
      status: item.status,
      read: Boolean(item.readAt),
      seen: Boolean(item.seenAt),
      createdAt: item.createdAt.toISOString(),
      deliveredAt: item.deliveredAt?.toISOString() ?? null,
      seenAt: item.seenAt?.toISOString() ?? null,
      readAt: item.readAt?.toISOString() ?? null,
      expiresAt: item.expiresAt?.toISOString() ?? null,
    };
  }

  private serializePreferences(row: {
    directMessages: boolean;
    mentions: boolean;
    groupMessages: boolean;
    academicImportant: boolean;
    assignments: boolean;
    resources: boolean;
    classUpdates: boolean;
    organizationEvents: boolean;
    organizationPosts: boolean;
    serviceUpdates: boolean;
    follows: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  }) {
    return {
      messages: {
        directMessages: row.directMessages,
        mentions: row.mentions,
        groupMessages: row.groupMessages,
      },
      academic: {
        important: row.academicImportant,
        assignments: row.assignments,
        resources: row.resources,
      },
      classes: { classUpdates: row.classUpdates },
      organizations: {
        events: row.organizationEvents,
        posts: row.organizationPosts,
      },
      services: { serviceUpdates: row.serviceUpdates },
      social: { follows: row.follows },
      quietHours: {
        start: row.quietHoursStart,
        end: row.quietHoursEnd,
      },
    };
  }
}
