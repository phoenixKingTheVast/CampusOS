import { Injectable } from '@nestjs/common';
import {
  OrganizationMembershipPolicy,
  OrganizationStatus,
  OrganizationTypeKey,
  Prisma,
  ReportReason,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContentService } from '../content/content.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';

const PUBLIC_STATUSES: OrganizationStatus[] = ['ACTIVE'];
const DISCOVERABLE: OrganizationStatus[] = ['ACTIVE', 'SUSPENDED', 'CLOSED'];

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly content: ContentService,
  ) {}

  async types() {
    const items = await this.prisma.organizationType.findMany({ orderBy: { label: 'asc' } });
    return { items };
  }

  async list(personId: string, typeKey?: string) {
    const items = await this.prisma.organization.findMany({
      where: {
        status: { in: DISCOVERABLE },
        visibility: 'PUBLIC',
        ...(typeKey ? { typeKey: typeKey as OrganizationTypeKey } : {}),
      },
      include: { type: true },
      orderBy: { name: 'asc' },
      take: 50,
    });
    const follows = await this.prisma.organizationFollow.findMany({
      where: { personId, organizationId: { in: items.map((item) => item.id) } },
    });
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { personId, organizationId: { in: items.map((item) => item.id) } },
    });
    return {
      items: items.map((item) =>
        this.card(item, {
          following: follows.some((row) => row.organizationId === item.id),
          membership: memberships.find((row) => row.organizationId === item.id) ?? null,
        }),
      ),
    };
  }

  async get(personId: string, organizationId: string) {
    const organization = await this.require(organizationId);
    if (!this.canView(organization, personId)) {
      throw Errors.notFound('This organization is no longer available.');
    }
    // Post visibility depends on the viewer's membership, so resolve it first.
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_personId: { organizationId, personId } },
    });
    const [follow, events, posts, officers] = await Promise.all([
      this.prisma.organizationFollow.findUnique({
        where: { organizationId_personId: { organizationId, personId } },
      }),
      this.prisma.campusEvent.findMany({
        where: { organizationId, startsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        take: 8,
      }),
      this.prisma.post.findMany({
        where: {
          organizationId,
          status: 'PUBLISHED',
          visibility: { in: this.visiblePostVisibilities(membership) },
        },
        include: { author: true },
        orderBy: { publishedAt: 'desc' },
        take: 10,
      }),
      this.prisma.organizationMembership.findMany({
        where: { organizationId, status: 'ACTIVE', role: { in: ['OFFICER', 'ADMIN'] } },
        include: { person: true },
      }),
    ]);
    const permissions = this.permissions(organization, membership);
    return {
      ...this.detail(organization, { following: Boolean(follow), membership }),
      upcoming: events.map((event) => ({
        id: event.id,
        title: event.title,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
        location: event.location,
        route: `/app/explore/event/${event.id}`,
      })),
      posts: posts.map((post) => this.serializePost(post)),
      officers: officers.map((item) => ({
        membershipId: item.id,
        personId: item.personId,
        name: item.person.displayName,
        role: item.role,
        officerTitle: item.officerTitle,
      })),
      permissions,
      conversationId:
        permissions.includes('OPEN_CONVERSATION') ? organization.conversationId : null,
    };
  }

  async create(
    personId: string,
    input: {
      name: string;
      description?: string;
      typeKey: OrganizationTypeKey;
      membershipPolicy?: OrganizationMembershipPolicy;
    },
    asAdmin = false,
  ) {
    const type = await this.prisma.organizationType.findUnique({ where: { key: input.typeKey } });
    const conversation = await this.prisma.conversation.create({
      data: { id: newId('conv'), kind: 'ORGANIZATION', createdById: personId, title: input.name },
    });
    const organization = await this.prisma.organization.create({
      data: {
        id: newId('org'),
        name: input.name.trim(),
        description: input.description?.trim(),
        typeKey: input.typeKey,
        typeId: type?.id,
        membershipPolicy: input.membershipPolicy ?? 'OPEN',
        status: asAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
        createdById: personId,
        conversationId: conversation.id,
        memberCount: 1,
      },
    });
    await this.prisma.organizationMembership.create({
      data: {
        id: newId('orgm'),
        organizationId: organization.id,
        personId,
        role: 'ADMIN',
        officerTitle: asAdmin ? 'Administrator' : 'Founder',
        status: 'ACTIVE',
      },
    });
    return this.detail(organization, {
      following: false,
      membership: { status: 'ACTIVE', role: 'ADMIN' },
    });
  }

  async submit(personId: string, organizationId: string) {
    const organization = await this.require(organizationId);
    this.requireAdmin(await this.membership(organizationId, personId));
    if (organization.status !== 'PROPOSED' && organization.status !== 'REJECTED') {
      throw Errors.conflict('This organization cannot be submitted for approval.');
    }
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'PENDING_APPROVAL' },
    });
  }

  async approve(reviewerId: string, organizationId: string, reason?: string) {
    await this.requirePlatformAdmin(reviewerId);
    const organization = await this.require(organizationId);
    if (organization.status !== 'PENDING_APPROVAL') {
      throw Errors.conflict('This organization is not awaiting approval.');
    }
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'ACTIVE' },
    });
    await this.prisma.organizationApproval.create({
      data: {
        id: newId('orgap'),
        organizationId,
        reviewerId,
        decision: 'APPROVE',
        reason,
      },
    });
    return this.detail(updated, { following: false, membership: null });
  }

  async reject(reviewerId: string, organizationId: string, reason?: string) {
    await this.requirePlatformAdmin(reviewerId);
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'REJECTED' },
    });
    await this.prisma.organizationApproval.create({
      data: {
        id: newId('orgap'),
        organizationId,
        reviewerId,
        decision: 'REJECT',
        reason,
      },
    });
    return updated;
  }

  async suspend(reviewerId: string, organizationId: string) {
    await this.requirePlatformAdmin(reviewerId);
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'SUSPENDED' },
    });
  }

  async close(personId: string, organizationId: string) {
    const membership = await this.membership(organizationId, personId);
    const isAdmin = await this.isPlatformAdmin(personId);
    if (!isAdmin) {
      this.requireAdmin(membership);
    }
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'CLOSED' },
    });
    if (updated.conversationId) {
      await this.prisma.conversation.update({
        where: { id: updated.conversationId },
        data: { locked: true },
      });
    }
    return updated;
  }

  async archive(reviewerId: string, organizationId: string) {
    await this.requirePlatformAdmin(reviewerId);
    const organization = await this.require(organizationId);
    if (organization.status !== 'CLOSED') {
      throw Errors.conflict('Close the organization before archiving it.');
    }
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'ARCHIVED' },
    });
  }

  async follow(personId: string, organizationId: string) {
    const organization = await this.requireActive(organizationId);
    await this.prisma.organizationFollow.upsert({
      where: { organizationId_personId: { organizationId, personId } },
      update: {},
      create: { id: newId('orgf'), organizationId, personId },
    });
    await this.recomputeCounts(organization.id);
    return { following: true };
  }

  async unfollow(personId: string, organizationId: string) {
    await this.prisma.organizationFollow.deleteMany({
      where: { organizationId, personId },
    });
    await this.recomputeCounts(organizationId);
    return { following: false };
  }

  async join(personId: string, organizationId: string) {
    const organization = await this.requireActive(organizationId);
    const existing = await this.membership(organizationId, personId);
    if (existing?.status === 'ACTIVE') {
      return existing;
    }
    if (organization.membershipPolicy === 'INVITATION_ONLY') {
      throw Errors.permissionDenied('This organization is invitation only.');
    }
    if (organization.membershipPolicy === 'RESTRICTED') {
      throw Errors.permissionDenied('This organization has additional eligibility rules.');
    }
    const status =
      organization.membershipPolicy === 'REQUEST_TO_JOIN' ? 'PENDING' : 'ACTIVE';
    const membership = await this.prisma.organizationMembership.upsert({
      where: { organizationId_personId: { organizationId, personId } },
      update: { status, role: 'MEMBER' },
      create: {
        id: newId('orgm'),
        organizationId,
        personId,
        role: 'MEMBER',
        status,
      },
    });
    await this.recomputeCounts(organizationId);
    return membership;
  }

  async leave(personId: string, organizationId: string) {
    const existing = await this.membership(organizationId, personId);
    if (!existing) {
      throw Errors.notFound();
    }
    const updated = await this.prisma.organizationMembership.update({
      where: { id: existing.id },
      data: { status: 'ENDED' },
    });
    await this.recomputeCounts(organizationId);
    return updated;
  }

  async members(personId: string, organizationId: string) {
    const organization = await this.require(organizationId);
    if (!this.canView(organization, personId)) {
      throw Errors.permissionDenied();
    }
    const items = await this.prisma.organizationMembership.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: { person: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      officers: items
        .filter((item) => item.role === 'OFFICER' || item.role === 'ADMIN')
        .map((item) => this.memberCard(item)),
      members: items.filter((item) => item.role === 'MEMBER').map((item) => this.memberCard(item)),
    };
  }

  async approveMember(actorId: string, organizationId: string, membershipId: string) {
    this.requireOfficer(await this.membership(organizationId, actorId));
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.organizationId !== organizationId) {
      throw Errors.notFound();
    }
    if (membership.status !== 'PENDING') {
      throw Errors.conflict('This membership is no longer pending.');
    }
    const updated = await this.prisma.organizationMembership.update({
      where: { id: membershipId },
      data: { status: 'ACTIVE' },
    });
    await this.notifications.emit({
      personId: membership.personId,
      type: 'ORGANIZATION_MEMBERSHIP',
      category: 'ORGANIZATION',
      title: 'Membership approved',
      body: 'Your membership request was approved.',
      sourceType: 'ORGANIZATION',
      sourceId: organizationId,
      sourceEventId: `${membershipId}:approved`,
    });
    await this.recomputeCounts(organizationId);
    return updated;
  }

  async rejectMember(actorId: string, organizationId: string, membershipId: string) {
    this.requireOfficer(await this.membership(organizationId, actorId));
    return this.prisma.organizationMembership.update({
      where: { id: membershipId },
      data: { status: 'REJECTED' },
    });
  }

  async transferAdmin(actorId: string, organizationId: string, membershipId: string) {
    this.requireAdmin(await this.membership(organizationId, actorId));
    const next = await this.prisma.organizationMembership.findUnique({
      where: { id: membershipId },
    });
    if (!next || next.organizationId !== organizationId || next.status !== 'ACTIVE') {
      throw Errors.notFound();
    }
    await this.prisma.$transaction([
      this.prisma.organizationMembership.updateMany({
        where: { organizationId, role: 'ADMIN' },
        data: { role: 'OFFICER' },
      }),
      this.prisma.organizationMembership.update({
        where: { id: membershipId },
        data: { role: 'ADMIN' },
      }),
    ]);
    return { ok: true };
  }

  async createPost(
    personId: string,
    organizationId: string,
    input: { body: string; kind?: string; visibility?: string },
  ) {
    const post = await this.content.createPost(personId, {
      body: input.body,
      contextType: 'ORGANIZATION',
      contextId: organizationId,
      visibility: (input.visibility as 'PUBLIC' | 'CAMPUS_ONLY' | 'CONTEXT_ONLY' | 'FOLLOWERS') ?? 'PUBLIC',
      kind: input.kind,
    });
    if (input.kind === 'ANNOUNCEMENT') {
      const organization = await this.requireActive(organizationId);
      const members = await this.prisma.organizationMembership.findMany({
        where: { organizationId, status: 'ACTIVE' },
      });
      await this.notifications.emitMany(
        members
          .filter((item) => item.personId !== personId)
          .map((item) => ({
            personId: item.personId,
            type: 'ORGANIZATION_ANNOUNCEMENT',
            category: 'ORGANIZATION' as const,
            title: organization.name,
            body: post.body.slice(0, 140),
            sourceType: 'POST',
            sourceId: post.id,
            priority: 'HIGH' as const,
            sourceEventId: post.id,
          })),
      );
    }
    return post;
  }

  async getPost(personId: string, postId: string) {
    return this.content.getPost(personId, postId);
  }

  async archivePost(personId: string, postId: string) {
    return this.content.removePost(personId, postId);
  }

  async reportPost(personId: string, postId: string, reason: ReportReason, details?: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw Errors.notFound();
    }
    return this.prisma.moderationReport.create({
      data: {
        id: newId('rep'),
        reporterId: personId,
        targetType: 'POST',
        targetId: postId,
        reason,
        details,
        postId,
      },
    });
  }

  async createEvent(
    personId: string,
    organizationId: string,
    input: { title: string; startsAt: string; endsAt?: string; location?: string; description?: string },
  ) {
    const organization = await this.requireActive(organizationId);
    this.requireOfficer(await this.membership(organizationId, personId));
    const event = await this.prisma.campusEvent.create({
      data: {
        id: newId('event'),
        organizationId,
        title: input.title.trim(),
        description: input.description,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        location: input.location,
        createdById: personId,
        organizerType: 'ORGANIZATION',
        organizerId: organizationId,
        visibility: 'PUBLIC',
      },
    });
    await this.prisma.activity.create({
      data: {
        id: newId('activity'),
        type: 'EVENT',
        title: `${organization.name}: ${event.title}`,
        startTime: event.startsAt,
        endTime: event.endsAt ?? event.startsAt,
        location: event.location,
        status: 'SCHEDULED',
        relevanceWeight: 55,
        sourceType: 'EVENT',
        sourceId: event.id,
        organizationId,
        eventId: event.id,
      },
    });
    return event;
  }

  async updateEvent(personId: string, eventId: string, input: { location?: string; startsAt?: string; title?: string }) {
    const event = await this.prisma.campusEvent.findUnique({ where: { id: eventId } });
    if (!event?.organizationId) {
      throw Errors.notFound();
    }
    this.requireOfficer(await this.membership(event.organizationId, personId));
    const previousLocation = event.location;
    const updated = await this.prisma.campusEvent.update({
      where: { id: eventId },
      data: {
        location: input.location,
        title: input.title,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      },
    });
    await this.prisma.activity.updateMany({
      where: { eventId },
      data: {
        location: updated.location,
        title: updated.title,
        startTime: updated.startsAt,
      },
    });
    if (previousLocation !== updated.location && updated.location) {
      const members = await this.prisma.organizationMembership.findMany({
        where: { organizationId: event.organizationId, status: 'ACTIVE' },
      });
      await this.notifications.emitMany(
        members.map((item) => ({
          personId: item.personId,
          type: 'EVENT_CHANGED',
          category: 'ORGANIZATION' as const,
          title: updated.title,
          body: `The event venue has changed: ${updated.location}`,
          sourceType: 'EVENT',
          sourceId: eventId,
          priority: 'HIGH' as const,
          sourceEventId: `${eventId}:venue:${updated.location}`,
        })),
      );
    }
    return updated;
  }

  async invite(actorId: string, organizationId: string, personId: string) {
    this.requireOfficer(await this.membership(organizationId, actorId));
    const organization = await this.requireActive(organizationId);
    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        id: newId('orgi'),
        organizationId,
        personId,
        invitedById: actorId,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    await this.notifications.emit({
      personId,
      type: 'ORGANIZATION_INVITATION',
      category: 'ORGANIZATION',
      title: `You were invited to join ${organization.name}.`,
      body: 'Open the invitation to accept or decline.',
      sourceType: 'ORGANIZATION_INVITATION',
      sourceId: invitation.id,
      deepLink: `/app/explore/organization/${organizationId}`,
      sourceEventId: invitation.id,
    });
    return invitation;
  }

  async conversation(personId: string, organizationId: string) {
    const organization = await this.require(organizationId);
    const membership = await this.membership(organizationId, personId);
    const follow = await this.prisma.organizationFollow.findUnique({
      where: { organizationId_personId: { organizationId, personId } },
    });
    if (!this.canOpenConversation(organization, membership, Boolean(follow))) {
      throw Errors.permissionDenied();
    }
    if (!organization.conversationId) {
      throw Errors.notFound();
    }
    const messages = await this.prisma.message.findMany({
      where: { conversationId: organization.conversationId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return {
      conversationId: organization.conversationId,
      locked: false,
      messages: messages.map((item) => ({
        id: item.id,
        body: item.body,
        authorName: item.author.displayName,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async notificationSettings(personId: string, organizationId: string) {
    const settings = await this.prisma.organizationNotificationSetting.upsert({
      where: { organizationId_personId: { organizationId, personId } },
      update: {},
      create: { id: newId('orgns'), organizationId, personId },
    });
    return settings;
  }

  async updateNotificationSettings(
    personId: string,
    organizationId: string,
    input: { posts?: string; events?: string; announcements?: string; messages?: string },
  ) {
    return this.prisma.organizationNotificationSetting.upsert({
      where: { organizationId_personId: { organizationId, personId } },
      update: input,
      create: { id: newId('orgns'), organizationId, personId, ...input },
    });
  }

  private async require(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: { type: true },
    });
    if (!organization) {
      throw Errors.notFound('This organization is no longer available.');
    }
    return organization;
  }

  private async requireActive(id: string) {
    const organization = await this.require(id);
    if (organization.status === 'SUSPENDED') {
      throw Errors.permissionDenied('Organization suspended');
    }
    if (organization.status !== 'ACTIVE') {
      throw Errors.permissionDenied();
    }
    return organization;
  }

  private canView(
    organization: { status: OrganizationStatus; visibility: string; createdById: string | null },
    personId: string,
  ) {
    if (organization.status === 'ARCHIVED') {
      return false;
    }
    if (PUBLIC_STATUSES.includes(organization.status) && organization.visibility === 'PUBLIC') {
      return true;
    }
    if (organization.status === 'SUSPENDED' || organization.status === 'CLOSED') {
      return true;
    }
    return organization.createdById === personId;
  }

  private async membership(organizationId: string, personId: string) {
    return this.prisma.organizationMembership.findUnique({
      where: { organizationId_personId: { organizationId, personId } },
    });
  }

  private requireOfficer(membership: { role: string; status: string } | null) {
    if (!membership || membership.status !== 'ACTIVE' || !['OFFICER', 'ADMIN'].includes(membership.role)) {
      throw Errors.permissionDenied();
    }
  }

  private requireAdmin(membership: { role: string; status: string } | null) {
    if (!membership || membership.status !== 'ACTIVE' || membership.role !== 'ADMIN') {
      throw Errors.permissionDenied();
    }
  }

  private async isPlatformAdmin(personId: string) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    return person?.username === 'uzadmin';
  }

  private async requirePlatformAdmin(personId: string) {
    if (!(await this.isPlatformAdmin(personId))) {
      throw Errors.permissionDenied();
    }
  }

  private permissions(
    organization: { status: OrganizationStatus; membershipPolicy: OrganizationMembershipPolicy; messagingPolicy: string },
    membership: { role: string; status: string } | null,
  ) {
    const permissions: string[] = ['VIEW'];
    if (organization.status === 'SUSPENDED') {
      return ['VIEW'];
    }
    if (organization.status !== 'ACTIVE') {
      return permissions;
    }
    permissions.push('FOLLOW');
    if (organization.membershipPolicy !== 'INVITATION_ONLY') {
      permissions.push('JOIN');
    }
    if (membership?.status === 'ACTIVE') {
      permissions.push('LEAVE');
      if (['OFFICER', 'ADMIN'].includes(membership.role)) {
        permissions.push('CREATE_POST', 'CREATE_EVENT', 'MANAGE_MEMBERS', 'MANAGE');
      }
      if (membership.role === 'ADMIN') {
        permissions.push('TRANSFER_ADMIN', 'CLOSE');
      }
    }
    if (this.canOpenConversation(organization, membership, false)) {
      permissions.push('OPEN_CONVERSATION');
    }
    return permissions;
  }

  private canOpenConversation(
    organization: { messagingPolicy: string; status: OrganizationStatus },
    membership: { role: string; status: string } | null,
    following: boolean,
  ) {
    if (organization.status !== 'ACTIVE') {
      return false;
    }
    if (organization.messagingPolicy === 'DISABLED') {
      return false;
    }
    if (organization.messagingPolicy === 'OFFICERS_ONLY') {
      return Boolean(membership && ['OFFICER', 'ADMIN'].includes(membership.role) && membership.status === 'ACTIVE');
    }
    if (organization.messagingPolicy === 'MEMBERS_ONLY') {
      return membership?.status === 'ACTIVE';
    }
    if (organization.messagingPolicy === 'FOLLOWERS_AND_MEMBERS') {
      return following || membership?.status === 'ACTIVE';
    }
    return false;
  }

  private visiblePostVisibilities(membership: { status: string } | null) {
    if (membership?.status === 'ACTIVE') {
      return ['PUBLIC', 'CAMPUS_ONLY', 'CONTEXT_ONLY', 'FOLLOWERS'];
    }
    return ['PUBLIC', 'CAMPUS_ONLY'];
  }

  private async recomputeCounts(organizationId: string) {
    const [memberCount, followerCount] = await Promise.all([
      this.prisma.organizationMembership.count({
        where: { organizationId, status: 'ACTIVE' },
      }),
      this.prisma.organizationFollow.count({ where: { organizationId } }),
    ]);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { memberCount, followerCount },
    });
  }

  private card(
    organization: {
      id: string;
      name: string;
      description: string | null;
      typeKey: OrganizationTypeKey;
      status: OrganizationStatus;
      memberCount: number;
      followerCount: number;
      type: { label: string } | null;
    },
    context: { following: boolean; membership: { status: string; role: string } | null },
  ) {
    return {
      id: organization.id,
      name: organization.name,
      description: organization.description,
      typeKey: organization.typeKey,
      typeLabel: organization.type?.label ?? organization.typeKey,
      status: organization.status,
      memberCount: organization.memberCount,
      followerCount: organization.followerCount,
      following: context.following,
      membershipStatus: context.membership?.status ?? 'NONE',
      accessibilityLabel: this.accessibilityLabel(organization, context),
      route: `/app/explore/organization/${organization.id}`,
    };
  }

  private detail(
    organization: {
      id: string;
      name: string;
      description: string | null;
      typeKey: OrganizationTypeKey;
      status: OrganizationStatus;
      membershipPolicy: OrganizationMembershipPolicy;
      messagingPolicy: string;
      memberCount: number;
      followerCount: number;
      type?: { label: string } | null;
    },
    context: { following: boolean; membership: { status: string; role: string } | null },
  ) {
    return {
      ...this.card({ ...organization, type: organization.type ?? null }, context),
      membershipPolicy: organization.membershipPolicy,
      messagingPolicy: organization.messagingPolicy,
      suspended: organization.status === 'SUSPENDED',
      closed: organization.status === 'CLOSED',
    };
  }

  private serializePost(post: {
    id: string;
    organizationId: string | null;
    contextId?: string | null;
    body: string;
    kind: string;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
    author?: { displayName: string | null };
    authorName?: string | null;
  }) {
    return {
      id: post.id,
      organizationId: post.organizationId ?? post.contextId ?? null,
      body: post.body,
      kind: post.kind,
      status: post.status,
      authorName: post.authorName ?? post.author?.displayName ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? post.createdAt.toISOString(),
    };
  }

  private memberCard(item: {
    id: string;
    personId: string;
    role: string;
    officerTitle: string | null;
    person: { displayName: string | null };
  }) {
    return {
      membershipId: item.id,
      personId: item.personId,
      name: item.person.displayName,
      role: item.role,
      officerTitle: item.officerTitle,
    };
  }

  private accessibilityLabel(
    organization: { name: string; memberCount: number; status: OrganizationStatus },
    context: { following: boolean; membership: { status: string } | null },
  ) {
    const parts = [
      organization.name,
      `${organization.memberCount} members`,
    ];
    if (context.following) parts.push('Followed');
    if (context.membership?.status === 'PENDING') parts.push('Membership pending');
    if (organization.status === 'SUSPENDED') parts.push('Organization suspended');
    if (organization.status === 'CLOSED') parts.push('Organization closed');
    parts.push('Open organization');
    return parts.join('. ') + '.';
  }
}
