import { Injectable } from '@nestjs/common';
import { Conversation, ConversationKind, Prisma, ReportReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import { audienceAllows, canonicalPair, DEFAULT_PRIVACY } from '../people/social-rules';
import {
  canEditMessage,
  directContextKey,
  hasDerivedParticipants,
  leaveBlockedMessage,
  messageNotificationType,
  messagePreview,
} from './messaging-rules';

const PAGE_SIZE = 40;

type ParticipantRole = 'MEMBER' | 'MODERATOR' | 'OWNER';

type Audience = {
  ids: string[];
  role: ParticipantRole | null;
};

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async inbox(personId: string, cursor?: string) {
    const ids = await this.reachableConversationIds(personId);
    if (ids.length === 0) {
      return { items: [], nextCursor: null };
    }
    const conversations = await this.prisma.conversation.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      orderBy: { lastActivityAt: 'desc' },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const items = [];
    for (const conversation of conversations) {
      items.push(await this.summarize(conversation, personId));
    }
    return {
      items,
      nextCursor: conversations.length === PAGE_SIZE ? conversations[conversations.length - 1].id : null,
    };
  }

  async get(personId: string, conversationId: string) {
    const conversation = await this.require(conversationId);
    const audience = await this.requireAudience(conversation, personId);
    const people = await this.prisma.person.findMany({
      where: { id: { in: audience.ids } },
      select: { id: true, displayName: true, username: true, photoFileId: true },
    });
    const summary = await this.summarize(conversation, personId);
    const sendBlockedReason = await this.sendBlockedReason(conversation, personId, audience);
    return {
      ...summary,
      description: conversation.description,
      locked: conversation.locked,
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      participantsDerived: hasDerivedParticipants(conversation.kind),
      participants: people.map((person) => ({
        personId: person.id,
        displayName: person.displayName,
        username: person.username,
        photoFileId: person.photoFileId,
      })),
      canSend: sendBlockedReason === null,
      sendBlockedReason,
      canLeave: !hasDerivedParticipants(conversation.kind) && conversation.kind !== 'DIRECT',
    };
  }

  async messages(personId: string, conversationId: string, cursor?: string, limit = PAGE_SIZE) {
    const conversation = await this.require(conversationId);
    await this.requireAudience(conversation, personId);
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      include: {
        author: { select: { id: true, displayName: true, username: true, photoFileId: true } },
        reactions: true,
        mentions: true,
        shares: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const readState = await this.prisma.messageReadState.findUnique({
      where: { conversationId_personId: { conversationId, personId } },
    });
    return {
      items: rows.map((row) => this.serializeMessage(row, personId)),
      nextCursor: rows.length === take ? rows[rows.length - 1].id : null,
      lastReadAt: readState?.lastReadAt.toISOString() ?? null,
    };
  }

  async findOrCreateDirect(personId: string, otherPersonId: string) {
    if (personId === otherPersonId) {
      throw Errors.validation("You can't start a conversation with yourself.");
    }
    const other = await this.prisma.person.findUnique({ where: { id: otherPersonId } });
    if (!other) {
      throw Errors.notFound('This person is no longer available.');
    }
    if (await this.blockedBetween(personId, otherPersonId)) {
      throw Errors.notFound('This conversation is no longer available.');
    }
    const reason = await this.directMessagingBlockedReason(personId, otherPersonId);
    if (reason) {
      throw Errors.permissionDenied(reason);
    }

    const contextId = directContextKey(personId, otherPersonId);
    const existing = await this.prisma.conversation.findFirst({
      where: { kind: 'DIRECT', contextType: 'DIRECT_PAIR', contextId },
    });
    if (existing) {
      return this.get(personId, existing.id);
    }

    const { low, high } = canonicalPair(personId, otherPersonId);
    const conversation = await this.prisma.conversation.create({
      data: {
        id: newId('conv'),
        kind: 'DIRECT',
        contextType: 'DIRECT_PAIR',
        contextId,
        createdById: personId,
        participants: {
          create: [
            { id: newId('cpart'), personId: low },
            { id: newId('cpart'), personId: high },
          ],
        },
      },
    });
    return this.get(personId, conversation.id);
  }

  async sendMessage(
    personId: string,
    conversationId: string,
    input: {
      body?: string;
      messageType?: string;
      replyToMessageId?: string;
      clientActionId?: string;
      mentionPersonIds?: string[];
      sharedObjectType?: string;
      sharedObjectId?: string;
      resourceId?: string;
    },
  ) {
    const conversation = await this.require(conversationId);
    const audience = await this.requireAudience(conversation, personId);

    // Offline clients retry the same clientActionId; return the original message
    // rather than duplicating it or re-notifying anyone.
    if (input.clientActionId) {
      const existing = await this.prisma.message.findUnique({
        where: {
          conversationId_clientActionId: { conversationId, clientActionId: input.clientActionId },
        },
        include: {
          author: { select: { id: true, displayName: true, username: true, photoFileId: true } },
          reactions: true,
          mentions: true,
          shares: true,
        },
      });
      if (existing) {
        return { ...this.serializeMessage(existing, personId), deduplicated: true };
      }
    }

    const blocked = await this.sendBlockedReason(conversation, personId, audience);
    if (blocked) {
      throw Errors.permissionDenied(blocked);
    }

    const body = (input.body ?? '').trim();
    const messageType = input.messageType ?? 'TEXT';
    if (!body && messageType === 'TEXT') {
      throw Errors.validation('Enter a message.');
    }
    if (input.replyToMessageId) {
      const parent = await this.prisma.message.findUnique({ where: { id: input.replyToMessageId } });
      if (!parent || parent.conversationId !== conversationId) {
        throw Errors.notFound('The message you replied to is no longer available.');
      }
    }

    const mentionIds = (input.mentionPersonIds ?? []).filter(
      (id) => id !== personId && audience.ids.includes(id),
    );

    let message;
    try {
      message = await this.prisma.message.create({
        data: {
          id: newId('msg'),
          conversationId,
          senderId: personId,
          body,
          messageType,
          replyToMessageId: input.replyToMessageId,
          clientActionId: input.clientActionId,
          resourceId: input.resourceId,
          status: 'SENT',
          ...(mentionIds.length
            ? {
                mentions: {
                  create: mentionIds.map((id) => ({ id: newId('mmen'), personId: id })),
                },
              }
            : {}),
          ...(input.sharedObjectType && input.sharedObjectId
            ? {
                shares: {
                  create: [
                    {
                      id: newId('mshr'),
                      objectType: input.sharedObjectType,
                      objectId: input.sharedObjectId,
                    },
                  ],
                },
              }
            : {}),
        },
        include: {
          author: { select: { id: true, displayName: true, username: true, photoFileId: true } },
          reactions: true,
          mentions: true,
          shares: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.clientActionId
      ) {
        const raced = await this.prisma.message.findUnique({
          where: {
            conversationId_clientActionId: { conversationId, clientActionId: input.clientActionId },
          },
          include: {
            author: { select: { id: true, displayName: true, username: true, photoFileId: true } },
            reactions: true,
            mentions: true,
            shares: true,
          },
        });
        if (raced) {
          return { ...this.serializeMessage(raced, personId), deduplicated: true };
        }
      }
      throw error;
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageId: message.id, lastActivityAt: message.createdAt },
    });
    await this.prisma.messageReadState.upsert({
      where: { conversationId_personId: { conversationId, personId } },
      update: { lastReadAt: message.createdAt },
      create: {
        id: newId('mread'),
        conversationId,
        personId,
        lastReadAt: message.createdAt,
      },
    });

    await this.notifyRecipients(conversation, message, audience, mentionIds);
    return this.serializeMessage(message, personId);
  }

  async markRead(personId: string, conversationId: string) {
    const conversation = await this.require(conversationId);
    await this.requireAudience(conversation, personId);
    const now = new Date();
    await this.prisma.messageReadState.upsert({
      where: { conversationId_personId: { conversationId, personId } },
      update: { lastReadAt: now },
      create: { id: newId('mread'), conversationId, personId, lastReadAt: now },
    });
    return { ok: true, lastReadAt: now.toISOString() };
  }

  async mute(personId: string, conversationId: string) {
    const conversation = await this.require(conversationId);
    await this.requireAudience(conversation, personId);
    await this.prisma.conversationMute.upsert({
      where: { conversationId_personId: { conversationId, personId } },
      update: {},
      create: { id: newId('cmute'), conversationId, personId },
    });
    return { ok: true, muted: true };
  }

  async unmute(personId: string, conversationId: string) {
    await this.prisma.conversationMute.deleteMany({ where: { conversationId, personId } });
    return { ok: true, muted: false };
  }

  async leave(personId: string, conversationId: string) {
    const conversation = await this.require(conversationId);
    await this.requireAudience(conversation, personId);
    const blocked = leaveBlockedMessage(conversation.kind);
    if (hasDerivedParticipants(conversation.kind) || conversation.kind === 'DIRECT') {
      throw Errors.validation(blocked ?? 'This conversation cannot be left.');
    }
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, personId },
      data: { status: 'LEFT' },
    });
    return { ok: true };
  }

  async editMessage(personId: string, messageId: string, body: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.removedAt) {
      throw Errors.notFound('This message is no longer available.');
    }
    if (message.senderId !== personId) {
      throw Errors.permissionDenied('You can only edit your own messages.');
    }
    if (!canEditMessage(message.createdAt)) {
      throw Errors.permissionDenied('Messages can only be edited for 15 minutes after sending.');
    }
    const text = body.trim();
    if (!text) {
      throw Errors.validation('Enter a message.');
    }
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { body: text, editedAt: new Date() },
      include: {
        author: { select: { id: true, displayName: true, username: true, photoFileId: true } },
        reactions: true,
        mentions: true,
        shares: true,
      },
    });
    return this.serializeMessage(updated, personId);
  }

  async removeMessage(personId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      throw Errors.notFound('This message is no longer available.');
    }
    if (message.removedAt) {
      return { ok: true };
    }
    if (message.senderId !== personId) {
      throw Errors.permissionDenied('You can only remove your own messages.');
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: { removedAt: new Date(), status: 'REMOVED', body: '' },
    });
    return { ok: true };
  }

  async react(personId: string, messageId: string, reaction: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.removedAt) {
      throw Errors.notFound('This message is no longer available.');
    }
    const conversation = await this.require(message.conversationId);
    await this.requireAudience(conversation, personId);
    const value = reaction.trim();
    if (!value) {
      throw Errors.validation('Pick a reaction.');
    }
    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_personId_reaction: { messageId, personId, reaction: value } },
    });
    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
      return { ok: true, reacted: false };
    }
    await this.prisma.messageReaction.create({
      data: { id: newId('mrct'), messageId, personId, reaction: value },
    });
    return { ok: true, reacted: true };
  }

  async reportMessage(
    personId: string,
    messageId: string,
    input: { reason: string; details?: string },
  ) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      throw Errors.notFound('This message is no longer available.');
    }
    const conversation = await this.require(message.conversationId);
    await this.requireAudience(conversation, personId);
    return this.prisma.moderationReport.create({
      data: {
        id: newId('rpt'),
        reporterId: personId,
        targetType: 'MESSAGE',
        targetId: messageId,
        messageId,
        reason: Object.values(ReportReason).includes(input.reason as ReportReason)
          ? (input.reason as ReportReason)
          : ReportReason.OTHER,
        details: input.details,
      },
    });
  }

  /**
   * Returns (creating if needed) the SERVICE conversation for a booking. Bookings
   * reuse the one Conversation engine rather than owning a private chat model.
   */
  async ensureServiceConversation(input: {
    bookingId: string;
    title: string;
    customerId: string;
    providerPersonId: string;
  }) {
    const existing = await this.prisma.conversation.findFirst({
      where: { kind: 'SERVICE', contextType: 'BOOKING', contextId: input.bookingId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.conversation.create({
      data: {
        id: newId('conv'),
        kind: 'SERVICE',
        title: input.title,
        contextType: 'BOOKING',
        contextId: input.bookingId,
        createdById: input.customerId,
        participants: {
          create: [
            { id: newId('cpart'), personId: input.customerId, role: 'MEMBER' },
            { id: newId('cpart'), personId: input.providerPersonId, role: 'OWNER' },
          ],
        },
      },
    });
  }

  private async require(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.status !== 'ACTIVE') {
      throw Errors.notFound('This conversation is no longer available.');
    }
    return conversation;
  }

  private async requireAudience(conversation: Conversation, personId: string): Promise<Audience> {
    const audience = await this.audience(conversation);
    if (!audience.ids.includes(personId)) {
      throw Errors.notFound('This conversation is no longer available.');
    }
    const role = await this.explicitRole(conversation, personId);
    return { ids: audience.ids, role: role ?? 'MEMBER' };
  }

  /**
   * Resolves who is in a conversation. For CLASS/COURSE/STUDY_GROUP/ORGANIZATION
   * the answer is derived from live domain membership every time — participation
   * is never a second, independently editable truth.
   */
  private async audience(conversation: Conversation): Promise<Audience> {
    const contextId = await this.contextId(conversation);
    switch (conversation.kind) {
      case 'CLASS': {
        if (!contextId) return { ids: [], role: null };
        const rows = await this.prisma.classMembership.findMany({
          where: { classId: contextId, status: 'ACTIVE' },
          select: { personId: true },
        });
        return { ids: rows.map((row) => row.personId), role: null };
      }
      case 'COURSE': {
        if (!contextId) return { ids: [], role: null };
        const [enrollments, personnel] = await Promise.all([
          this.prisma.enrollment.findMany({
            where: { courseOfferingId: contextId, status: 'ACTIVE' },
            select: { personId: true },
          }),
          this.prisma.coursePersonnel.findMany({
            where: { courseOfferingId: contextId },
            select: { personId: true },
          }),
        ]);
        return {
          ids: unique([...enrollments, ...personnel].map((row) => row.personId)),
          role: null,
        };
      }
      case 'STUDY_GROUP': {
        if (!contextId) return { ids: [], role: null };
        const rows = await this.prisma.studyGroupMembership.findMany({
          where: { studyGroupId: contextId, status: 'ACTIVE' },
          select: { personId: true },
        });
        return { ids: rows.map((row) => row.personId), role: null };
      }
      case 'ORGANIZATION': {
        if (!contextId) return { ids: [], role: null };
        const rows = await this.prisma.organizationMembership.findMany({
          where: { organizationId: contextId, status: 'ACTIVE' },
          select: { personId: true },
        });
        return { ids: rows.map((row) => row.personId), role: null };
      }
      default: {
        const rows = await this.prisma.conversationParticipant.findMany({
          where: { conversationId: conversation.id, status: 'ACTIVE' },
          select: { personId: true },
        });
        return { ids: rows.map((row) => row.personId), role: null };
      }
    }
  }

  private async explicitRole(
    conversation: Conversation,
    personId: string,
  ): Promise<ParticipantRole | null> {
    if (hasDerivedParticipants(conversation.kind)) {
      return 'MEMBER';
    }
    const row = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_personId: { conversationId: conversation.id, personId } },
    });
    return (row?.role as ParticipantRole | undefined) ?? null;
  }

  /**
   * `contextId` is the canonical link to the domain object. Older organization and
   * study-group conversations were linked from the other side, so fall back to that.
   */
  private async contextId(conversation: Conversation): Promise<string | null> {
    if (conversation.contextId) {
      return conversation.contextId;
    }
    if (conversation.kind === 'ORGANIZATION') {
      const organization = await this.prisma.organization.findFirst({
        where: { conversationId: conversation.id },
        select: { id: true },
      });
      return organization?.id ?? null;
    }
    if (conversation.kind === 'STUDY_GROUP') {
      const group = await this.prisma.studyGroup.findFirst({
        where: { conversationId: conversation.id },
        select: { id: true },
      });
      return group?.id ?? null;
    }
    return null;
  }

  private async reachableConversationIds(personId: string): Promise<string[]> {
    const [explicit, classes, enrollments, personnel, groups, organizations] = await Promise.all([
      this.prisma.conversationParticipant.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { conversationId: true },
      }),
      this.prisma.classMembership.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { classId: true },
      }),
      this.prisma.enrollment.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { courseOfferingId: true },
      }),
      this.prisma.coursePersonnel.findMany({
        where: { personId },
        select: { courseOfferingId: true },
      }),
      this.prisma.studyGroupMembership.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { studyGroupId: true, studyGroup: { select: { conversationId: true } } },
      }),
      this.prisma.organizationMembership.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { organizationId: true, organization: { select: { conversationId: true } } },
      }),
    ]);

    const classIds = classes.map((row) => row.classId);
    const offeringIds = unique([
      ...enrollments.map((row) => row.courseOfferingId),
      ...personnel.map((row) => row.courseOfferingId),
    ]);
    const groupIds = groups.map((row) => row.studyGroupId);
    const organizationIds = organizations.map((row) => row.organizationId);

    const derived = await this.prisma.conversation.findMany({
      where: {
        OR: [
          ...(classIds.length ? [{ kind: 'CLASS' as ConversationKind, contextId: { in: classIds } }] : []),
          ...(offeringIds.length
            ? [{ kind: 'COURSE' as ConversationKind, contextId: { in: offeringIds } }]
            : []),
          ...(groupIds.length
            ? [{ kind: 'STUDY_GROUP' as ConversationKind, contextId: { in: groupIds } }]
            : []),
          ...(organizationIds.length
            ? [{ kind: 'ORGANIZATION' as ConversationKind, contextId: { in: organizationIds } }]
            : []),
        ],
      },
      select: { id: true },
    });

    return unique([
      ...explicit.map((row) => row.conversationId),
      ...derived.map((row) => row.id),
      ...groups.map((row) => row.studyGroup?.conversationId).filter(isString),
      ...organizations.map((row) => row.organization?.conversationId).filter(isString),
    ]);
  }

  private async summarize(conversation: Conversation, personId: string) {
    const audience = await this.audience(conversation);
    const [lastMessage, readState, mute] = await Promise.all([
      conversation.lastMessageId
        ? this.prisma.message.findUnique({
            where: { id: conversation.lastMessageId },
            include: { author: { select: { id: true, displayName: true } } },
          })
        : Promise.resolve(null),
      this.prisma.messageReadState.findUnique({
        where: { conversationId_personId: { conversationId: conversation.id, personId } },
      }),
      this.prisma.conversationMute.findUnique({
        where: { conversationId_personId: { conversationId: conversation.id, personId } },
      }),
    ]);

    // Unread is derived from MessageReadState rather than a stored counter.
    const unread = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: personId },
        removedAt: null,
        ...(readState ? { createdAt: { gt: readState.lastReadAt } } : {}),
      },
    });

    const title = await this.title(conversation, personId, audience.ids);
    return {
      id: conversation.id,
      kind: conversation.kind,
      title,
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      participantCount: audience.ids.length,
      unreadCount: unread,
      muted: Boolean(mute),
      lastActivityAt: conversation.lastActivityAt.toISOString(),
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            senderId: lastMessage.senderId,
            senderName: lastMessage.author.displayName,
            preview: messagePreview(lastMessage.body, lastMessage.messageType, lastMessage.removedAt),
            createdAt: lastMessage.createdAt.toISOString(),
          }
        : null,
      route: `/app/messages/${conversation.id}`,
      accessibilityLabel: `${title}. ${unread === 0 ? 'No unread messages' : `${unread} unread`}.`,
    };
  }

  private async title(conversation: Conversation, personId: string, participantIds: string[]) {
    if (conversation.title) {
      return conversation.title;
    }
    if (conversation.kind === 'DIRECT') {
      const otherId = participantIds.find((id) => id !== personId);
      if (!otherId) {
        return 'Conversation';
      }
      const other = await this.prisma.person.findUnique({
        where: { id: otherId },
        select: { displayName: true, username: true },
      });
      return other?.displayName ?? other?.username ?? 'Conversation';
    }
    const contextId = await this.contextId(conversation);
    if (!contextId) {
      return 'Conversation';
    }
    if (conversation.kind === 'CLASS') {
      const row = await this.prisma.academicClass.findUnique({ where: { id: contextId } });
      return row?.code ?? 'Class';
    }
    if (conversation.kind === 'COURSE') {
      const row = await this.prisma.courseOffering.findUnique({
        where: { id: contextId },
        include: { course: true },
      });
      return row ? `${row.course.code} ${row.course.title}` : 'Course';
    }
    if (conversation.kind === 'STUDY_GROUP') {
      const row = await this.prisma.studyGroup.findUnique({ where: { id: contextId } });
      return row?.name ?? 'Study group';
    }
    if (conversation.kind === 'ORGANIZATION') {
      const row = await this.prisma.organization.findUnique({ where: { id: contextId } });
      return row?.name ?? 'Organization';
    }
    return 'Conversation';
  }

  private async sendBlockedReason(
    conversation: Conversation,
    personId: string,
    audience: Audience,
  ): Promise<string | null> {
    if (conversation.locked) {
      return 'This conversation is closed.';
    }
    if (!audience.ids.includes(personId)) {
      return 'You are no longer part of this conversation.';
    }
    if (conversation.kind === 'DIRECT') {
      const otherId = audience.ids.find((id) => id !== personId);
      if (!otherId) {
        return 'This conversation is no longer available.';
      }
      if (await this.blockedBetween(personId, otherId)) {
        return 'This conversation is no longer available.';
      }
      return this.directMessagingBlockedReason(personId, otherId);
    }
    if (conversation.kind === 'ORGANIZATION') {
      const contextId = await this.contextId(conversation);
      if (contextId) {
        const organization = await this.prisma.organization.findUnique({
          where: { id: contextId },
        });
        if (organization?.messagingPolicy === 'DISABLED') {
          return 'Messaging is turned off for this organization.';
        }
        if (organization?.messagingPolicy === 'OFFICERS_ONLY') {
          const membership = await this.prisma.organizationMembership.findUnique({
            where: { organizationId_personId: { organizationId: contextId, personId } },
          });
          if (!membership || !['OFFICER', 'ADMIN'].includes(membership.role)) {
            return 'Only officers can post in this conversation.';
          }
        }
      }
    }
    return null;
  }

  /** Applies the recipient's `PrivacySettings.whoCanMessage` audience. */
  private async directMessagingBlockedReason(
    senderId: string,
    recipientId: string,
  ): Promise<string | null> {
    const [settings, sender, recipient] = await Promise.all([
      this.prisma.privacySettings.findUnique({ where: { personId: recipientId } }),
      this.prisma.person.findUnique({ where: { id: senderId } }),
      this.prisma.person.findUnique({ where: { id: recipientId } }),
    ]);
    const audienceValue = settings?.whoCanMessage ?? DEFAULT_PRIVACY.whoCanMessage;
    const { low, high } = canonicalPair(senderId, recipientId);
    const connection = await this.prisma.connectionRelationship.findUnique({
      where: { personLowId_personHighId: { personLowId: low, personHighId: high } },
    });
    const sharedContext = await this.sharesContext(senderId, recipientId);
    const allowed = audienceAllows(audienceValue, {
      sameCampus: sender?.accountState === 'ACTIVE' && recipient?.accountState === 'ACTIVE',
      connected: connection?.status === 'ACCEPTED',
      sameContext: sharedContext,
      self: senderId === recipientId,
    });
    if (allowed) {
      return null;
    }
    if (audienceValue === 'CONNECTIONS') {
      return 'You can message this person once you are connected.';
    }
    if (audienceValue === 'CONTEXT_ONLY') {
      return 'You can only message people in your classes, courses or organizations.';
    }
    return "This person isn't accepting messages.";
  }

  private async sharesContext(a: string, b: string): Promise<boolean> {
    const [classes, offerings, organizations, groups] = await Promise.all([
      this.prisma.classMembership.findMany({
        where: { personId: { in: [a, b] }, status: 'ACTIVE' },
        select: { classId: true, personId: true },
      }),
      this.prisma.enrollment.findMany({
        where: { personId: { in: [a, b] }, status: 'ACTIVE' },
        select: { courseOfferingId: true, personId: true },
      }),
      this.prisma.organizationMembership.findMany({
        where: { personId: { in: [a, b] }, status: 'ACTIVE' },
        select: { organizationId: true, personId: true },
      }),
      this.prisma.studyGroupMembership.findMany({
        where: { personId: { in: [a, b] }, status: 'ACTIVE' },
        select: { studyGroupId: true, personId: true },
      }),
    ]);
    return (
      overlaps(classes, 'classId', a, b) ||
      overlaps(offerings, 'courseOfferingId', a, b) ||
      overlaps(organizations, 'organizationId', a, b) ||
      overlaps(groups, 'studyGroupId', a, b)
    );
  }

  private async blockedBetween(a: string, b: string): Promise<boolean> {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return Boolean(block);
  }

  private async notifyRecipients(
    conversation: Conversation,
    message: { id: string; body: string; messageType: string; senderId: string },
    audience: Audience,
    mentionIds: string[],
  ) {
    const sender = await this.prisma.person.findUnique({
      where: { id: message.senderId },
      select: { displayName: true, username: true },
    });
    const senderName = sender?.displayName ?? sender?.username ?? 'Someone';
    const conversationTitle = await this.title(conversation, message.senderId, audience.ids);
    const [mutes, blocks] = await Promise.all([
      this.prisma.conversationMute.findMany({
        where: { conversationId: conversation.id },
        select: { personId: true },
      }),
      this.prisma.userBlock.findMany({
        where: {
          OR: [{ blockerId: message.senderId }, { blockedId: message.senderId }],
        },
      }),
    ]);
    const muted = new Set(mutes.map((row) => row.personId));
    const blockedIds = new Set(
      blocks.map((row) => (row.blockerId === message.senderId ? row.blockedId : row.blockerId)),
    );
    const preview = messagePreview(message.body, message.messageType, null);

    for (const recipientId of audience.ids) {
      if (recipientId === message.senderId || muted.has(recipientId) || blockedIds.has(recipientId)) {
        continue;
      }
      const mentioned = mentionIds.includes(recipientId);
      await this.notifications.emit({
        personId: recipientId,
        type: mentioned ? 'MENTION' : messageNotificationType(conversation.kind),
        category: 'SOCIAL',
        title: conversation.kind === 'DIRECT' ? senderName : conversationTitle,
        body: conversation.kind === 'DIRECT' ? preview : `${senderName}: ${preview}`,
        sourceType: 'CONVERSATION',
        sourceId: conversation.id,
        sourceEventId: message.id,
        priority: mentioned ? 'HIGH' : 'NORMAL',
      });
    }
  }

  private serializeMessage(
    message: {
      id: string;
      conversationId: string;
      senderId: string;
      body: string;
      messageType: string;
      replyToMessageId: string | null;
      status: string;
      clientActionId: string | null;
      createdAt: Date;
      editedAt: Date | null;
      removedAt: Date | null;
      resourceId: string | null;
      author: { id: string; displayName: string | null; username: string | null; photoFileId: string | null };
      reactions: Array<{ personId: string; reaction: string }>;
      mentions: Array<{ personId: string }>;
      shares: Array<{ objectType: string; objectId: string }>;
    },
    personId: string,
  ) {
    const reactions = new Map<string, { reaction: string; count: number; mine: boolean }>();
    for (const row of message.reactions) {
      const current = reactions.get(row.reaction) ?? { reaction: row.reaction, count: 0, mine: false };
      current.count += 1;
      current.mine = current.mine || row.personId === personId;
      reactions.set(row.reaction, current);
    }
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.author.displayName ?? message.author.username,
      senderPhotoFileId: message.author.photoFileId,
      mine: message.senderId === personId,
      body: message.removedAt ? '' : message.body,
      messageType: message.messageType,
      replyToMessageId: message.replyToMessageId,
      status: message.status,
      clientActionId: message.clientActionId,
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt?.toISOString() ?? null,
      removed: Boolean(message.removedAt),
      removedLabel: message.removedAt ? 'Message removed' : null,
      canEdit: message.senderId === personId && !message.removedAt && canEditMessage(message.createdAt),
      canRemove: message.senderId === personId && !message.removedAt,
      resourceId: message.resourceId,
      reactions: [...reactions.values()],
      mentionPersonIds: message.mentions.map((row) => row.personId),
      sharedObjects: message.shares.map((row) => ({
        objectType: row.objectType,
        objectId: row.objectId,
      })),
    };
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function overlaps<K extends string>(
  rows: Array<Record<K, string> & { personId: string }>,
  key: K,
  a: string,
  b: string,
): boolean {
  const first = new Set(rows.filter((row) => row.personId === a).map((row) => row[key]));
  return rows.some((row) => row.personId === b && first.has(row[key]));
}
