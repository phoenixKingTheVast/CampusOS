import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';

@Injectable()
export class DiscussionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(personId: string, courseOfferingId: string) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    const items = await this.prisma.discussion.findMany({
      where: { courseOfferingId, status: { in: ['ACTIVE', 'CLOSED'] } },
      include: { author: true, _count: { select: { replies: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
    return {
      items: items.map((item) => this.serialize(item)),
      permissions: [...context.permissions],
    };
  }

  async get(personId: string, discussionId: string) {
    const item = await this.prisma.discussion.findUnique({
      where: { id: discussionId },
      include: {
        author: true,
        replies: { include: { author: true }, orderBy: { createdAt: 'asc' }, take: 80 },
        courseOffering: true,
      },
    });
    if (!item) {
      throw Errors.notFound();
    }
    const context = await this.access.courseContext(personId, item.courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    return {
      ...this.serialize({ ...item, _count: { replies: item.replies.length } }),
      replies: item.replies.map((reply) => ({
        id: reply.id,
        body: reply.body,
        authorName: reply.author.displayName,
        authorId: reply.authorId,
        createdAt: reply.createdAt.toISOString(),
      })),
      permissions: [...context.permissions],
    };
  }

  async create(personId: string, courseOfferingId: string, input: { title: string; body: string }) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('CREATE_DISCUSSION')) {
      throw Errors.permissionDenied();
    }
    const item = await this.prisma.discussion.create({
      data: {
        id: newId('disc'),
        courseOfferingId,
        authorId: personId,
        title: input.title.trim(),
        body: input.body.trim(),
      },
      include: { author: true, _count: { select: { replies: true } } },
    });
    return this.serialize(item);
  }

  async reply(personId: string, discussionId: string, body: string) {
    const item = await this.prisma.discussion.findUnique({ where: { id: discussionId } });
    if (!item) {
      throw Errors.notFound();
    }
    if (item.status === 'CLOSED') {
      throw Errors.validation('This discussion is closed.');
    }
    const context = await this.access.courseContext(personId, item.courseOfferingId);
    if (!context?.can('REPLY_DISCUSSION')) {
      throw Errors.permissionDenied();
    }
    const reply = await this.prisma.discussionReply.create({
      data: {
        id: newId('drep'),
        discussionId,
        authorId: personId,
        body: body.trim(),
      },
      include: { author: true },
    });
    return {
      id: reply.id,
      body: reply.body,
      authorName: reply.author.displayName,
      authorId: reply.authorId,
      createdAt: reply.createdAt.toISOString(),
    };
  }

  private serialize(item: {
    id: string;
    courseOfferingId: string;
    title: string;
    body: string;
    status: string;
    pinned: boolean;
    createdAt: Date;
    author?: { displayName: string | null };
    _count?: { replies: number };
  }) {
    return {
      id: item.id,
      courseOfferingId: item.courseOfferingId,
      title: item.title,
      body: item.body,
      status: item.status,
      pinned: item.pinned,
      authorName: item.author?.displayName ?? 'Student',
      replyCount: item._count?.replies ?? 0,
      createdAt: item.createdAt.toISOString(),
      route: `/app/learn/discussion/${item.id}`,
    };
  }
}
