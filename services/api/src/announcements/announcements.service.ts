import { Injectable } from '@nestjs/common';
import { AnnouncementPriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import { announcementShouldPush } from '../resources/resource-policy';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(personId: string, courseOfferingId: string) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    const items = await this.prisma.announcement.findMany({
      where: {
        courseOfferingId,
        status: { in: context.isLecturer ? ['PUBLISHED', 'ARCHIVED', 'DRAFT'] : ['PUBLISHED', 'ARCHIVED'] },
      },
      include: { author: true, reads: { where: { personId } } },
      orderBy: { publishedAt: 'desc' },
    });
    return {
      items: items.map((item) => this.serialize(item, personId)),
      permissions: [...context.permissions],
    };
  }

  async get(personId: string, announcementId: string) {
    const item = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: { author: true, reads: { where: { personId } } },
    });
    if (!item) {
      throw Errors.notFound();
    }
    const context = await this.access.courseContext(personId, item.courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    return this.serialize(item, personId);
  }

  async create(
    personId: string,
    courseOfferingId: string,
    input: { title: string; body: string; priority?: AnnouncementPriority },
  ) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('CREATE_ANNOUNCEMENT')) {
      throw Errors.permissionDenied();
    }
    const announcement = await this.prisma.announcement.create({
      data: {
        id: newId('ann'),
        courseOfferingId,
        authorId: personId,
        title: input.title.trim(),
        body: input.body.trim(),
        priority: input.priority ?? 'NORMAL',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
      include: { author: true, reads: true, courseOffering: { include: { enrollments: true } } },
    });
    await this.notify(announcement);
    return this.serialize(announcement, personId);
  }

  async update(
    personId: string,
    announcementId: string,
    input: { title?: string; body?: string; priority?: AnnouncementPriority },
  ) {
    const item = await this.require(announcementId);
    const context = await this.access.courseContext(personId, item.courseOfferingId);
    if (!context?.can('EDIT_ANNOUNCEMENT')) {
      throw Errors.permissionDenied();
    }
    const updated = await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        title: input.title?.trim(),
        body: input.body?.trim(),
        priority: input.priority,
      },
      include: { author: true, reads: { where: { personId } } },
    });
    return this.serialize(updated, personId);
  }

  async archive(personId: string, announcementId: string) {
    const item = await this.require(announcementId);
    const context = await this.access.courseContext(personId, item.courseOfferingId);
    if (!context?.can('ARCHIVE_ANNOUNCEMENT')) {
      throw Errors.permissionDenied();
    }
    return this.prisma.announcement.update({
      where: { id: announcementId },
      data: { status: 'ARCHIVED' },
    });
  }

  async markRead(personId: string, announcementId: string) {
    const item = await this.require(announcementId);
    const context = await this.access.courseContext(personId, item.courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    await this.prisma.announcementRead.upsert({
      where: { announcementId_personId: { announcementId, personId } },
      update: { readAt: new Date() },
      create: { id: newId('aread'), announcementId, personId },
    });
    return { ok: true };
  }

  private async notify(announcement: {
    id: string;
    title: string;
    priority: AnnouncementPriority;
    courseOfferingId: string;
    courseOffering: { enrollments: Array<{ personId: string; status: string }> };
    authorId: string;
  }) {
    const recipients = announcement.courseOffering.enrollments
      .filter((item) => item.status === 'ACTIVE' && item.personId !== announcement.authorId)
      .map((item) => item.personId);
    const pushWorthy = announcementShouldPush(announcement.priority);
    await this.notifications.emitMany(
      recipients.map((personId) => ({
        personId,
        type: pushWorthy ? 'IMPORTANT_ANNOUNCEMENT' : 'COURSE_ANNOUNCEMENT',
        category: 'ACADEMIC' as const,
        title: announcement.title,
        body: 'New course announcement',
        sourceType: 'ANNOUNCEMENT',
        sourceId: announcement.id,
        announcementId: announcement.id,
        priority: pushWorthy ? ('HIGH' as const) : ('NORMAL' as const),
        sourceEventId: announcement.id,
      })),
    );
  }

  private async require(id: string) {
    const item = await this.prisma.announcement.findUnique({ where: { id } });
    if (!item) {
      throw Errors.notFound();
    }
    return item;
  }

  private serialize(
    item: {
      id: string;
      courseOfferingId: string;
      authorId: string;
      title: string;
      body: string;
      priority: string;
      status: string;
      publishedAt: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      author: { displayName: string | null };
      reads: Array<{ personId: string }>;
    },
    personId: string,
  ) {
    return {
      id: item.id,
      courseOfferingId: item.courseOfferingId,
      authorId: item.authorId,
      authorName: item.author.displayName,
      title: item.title,
      body: item.body,
      priority: item.priority,
      status: item.status,
      publishedAt: item.publishedAt?.toISOString() ?? null,
      expiresAt: item.expiresAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      isRead: item.reads.some((read) => read.personId === personId),
    };
  }
}
