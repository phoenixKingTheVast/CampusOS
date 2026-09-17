import { Injectable } from '@nestjs/common';
import { Prisma, ReportReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import {
  AudienceContext,
  DEFAULT_PRIVACY,
  PrivacySettingsView,
  SocialList,
  audienceAllows,
  canonicalPair,
  connectionState,
  listHiddenMessage,
  privacyAudienceError,
  sameCampusAs,
  sharedObjectIds,
} from './social-rules';

export const SOCIAL_PAGE_SIZE = 30;

const PROFILE_GONE = 'This profile is no longer available.';

export type PersonCard = {
  id: string;
  displayName: string | null;
  username: string | null;
  photoFileId: string | null;
};

export type SharedContext = {
  classes: Array<{ id: string; code: string; name: string }>;
  courseOfferings: Array<{ id: string; code: string; title: string; semester: string }>;
  organizations: Array<{ id: string; name: string }>;
  studyGroups: Array<{ id: string; name: string }>;
  total: number;
};

export type ConnectionRow = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
};

export type SocialContext = {
  viewerId: string;
  viewer: PersonCard & { accountState: string };
  target: PersonCard & { bio: string | null; accountState: string };
  self: boolean;
  /** Always false once `context()` returns: a block in either direction is a notFound. */
  blockedByMe: boolean;
  /** Always false once `context()` returns: a block in either direction is a notFound. */
  blockedMe: boolean;
  connection: ConnectionRow | null;
  connected: boolean;
  shared: SharedContext;
  privacy: PrivacySettingsView;
  audience: AudienceContext;
};

export type SocialPage = {
  items: PersonCard[];
  nextCursor: string | null;
  visible: boolean;
  message?: string;
};

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Loads everything an authorization decision about `targetId` needs: both
   * people, the blocks between them, their single canonical connection row,
   * the context they share and the target's privacy settings. Callers get a
   * `notFound` for a missing person and for a block in either direction, so
   * neither side can probe the other's existence through this path.
   */
  async context(viewerId: string, targetId: string): Promise<SocialContext> {
    const [viewer, target] = await Promise.all([
      this.prisma.person.findUnique({ where: { id: viewerId } }),
      this.prisma.person.findUnique({ where: { id: targetId } }),
    ]);
    if (!viewer) {
      throw Errors.unauthenticated();
    }
    if (!target) {
      throw Errors.notFound(PROFILE_GONE);
    }
    const self = viewerId === targetId;
    const { low, high } = canonicalPair(viewerId, targetId);
    const [blocks, connection, shared, privacy] = await Promise.all([
      self
        ? Promise.resolve([])
        : this.prisma.userBlock.findMany({
            where: {
              OR: [
                { blockerId: viewerId, blockedId: targetId },
                { blockerId: targetId, blockedId: viewerId },
              ],
            },
          }),
      self
        ? Promise.resolve(null)
        : this.prisma.connectionRelationship.findUnique({
            where: { personLowId_personHighId: { personLowId: low, personHighId: high } },
          }),
      this.sharedContextFor(viewerId, targetId),
      this.privacyFor(targetId),
    ]);

    const blockedByMe = blocks.some((row) => row.blockerId === viewerId);
    const blockedMe = blocks.some((row) => row.blockerId === targetId);
    if (blockedByMe || blockedMe) {
      throw Errors.notFound(PROFILE_GONE);
    }

    const connected = connection?.status === 'ACCEPTED';
    return {
      viewerId,
      viewer: { ...this.card(viewer), accountState: viewer.accountState },
      target: { ...this.card(target), bio: target.bio, accountState: target.accountState },
      self,
      blockedByMe,
      blockedMe,
      connection: connection
        ? {
            id: connection.id,
            requesterId: connection.requesterId,
            addresseeId: connection.addresseeId,
            status: connection.status,
          }
        : null,
      connected,
      shared,
      privacy,
      audience: {
        self,
        sameCampus: sameCampusAs(viewer.accountState, target.accountState),
        connected,
        sameContext: shared.total > 0,
      },
    };
  }

  // -- Follow ---------------------------------------------------------------

  async follow(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw Errors.validation("You can't follow yourself.");
    }
    const context = await this.context(viewerId, targetId);
    if (!audienceAllows(context.privacy.whoCanFollow, context.audience)) {
      throw Errors.permissionDenied("This person isn't accepting new followers.");
    }

    const existing = await this.prisma.followRelationship.findUnique({
      where: { followerId_followedId: { followerId: viewerId, followedId: targetId } },
    });
    if (existing?.status === 'FOLLOWING') {
      return { following: true, alreadyFollowing: true };
    }
    // An UNFOLLOWED row is reused rather than duplicated: the unique pair is
    // the identity of the edge and unfollowing only soft-clears its status.
    await this.prisma.followRelationship.upsert({
      where: { followerId_followedId: { followerId: viewerId, followedId: targetId } },
      create: {
        id: newId('flw'),
        followerId: viewerId,
        followedId: targetId,
        status: 'FOLLOWING',
      },
      update: { status: 'FOLLOWING' },
    });

    await this.notifications.emit({
      personId: targetId,
      type: 'FOLLOW',
      category: 'SOCIAL',
      title: `${this.nameOf(context.viewer)} started following you.`,
      body: 'View their profile.',
      sourceType: 'PERSON',
      sourceId: viewerId,
      // LOW is what keeps push off for follows: NotificationsService.emit
      // skips the PUSH delivery row when the priority is LOW, so this stays
      // in-app only. Connection requests deliberately use NORMAL instead.
      priority: 'LOW',
    });
    await this.recordAudit(viewerId, 'FOLLOWED', targetId);
    return { following: true, alreadyFollowing: false };
  }

  async unfollow(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw Errors.validation("You can't follow yourself.");
    }
    await this.context(viewerId, targetId);
    const existing = await this.prisma.followRelationship.findUnique({
      where: { followerId_followedId: { followerId: viewerId, followedId: targetId } },
    });
    if (!existing || existing.status !== 'FOLLOWING') {
      return { following: false };
    }
    // Soft unfollow: the row survives so re-following is an update, and the
    // history stays auditable.
    await this.prisma.followRelationship.update({
      where: { id: existing.id },
      data: { status: 'UNFOLLOWED' },
    });
    await this.recordAudit(viewerId, 'UNFOLLOWED', targetId);
    return { following: false };
  }

  async followers(viewerId: string, targetId: string, cursor?: string): Promise<SocialPage> {
    const context = await this.context(viewerId, targetId);
    if (!audienceAllows(context.privacy.followerVisibility, context.audience)) {
      return this.hiddenPage('FOLLOWERS');
    }
    const rows = await this.prisma.followRelationship.findMany({
      where: { followedId: targetId, status: 'FOLLOWING' },
      include: { follower: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SOCIAL_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return this.peoplePage(
      viewerId,
      rows.map((row) => ({ cursorId: row.id, person: row.follower })),
    );
  }

  async following(viewerId: string, targetId: string, cursor?: string): Promise<SocialPage> {
    const context = await this.context(viewerId, targetId);
    if (!audienceAllows(context.privacy.followingVisibility, context.audience)) {
      return this.hiddenPage('FOLLOWING');
    }
    const rows = await this.prisma.followRelationship.findMany({
      where: { followerId: targetId, status: 'FOLLOWING' },
      include: { followed: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SOCIAL_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return this.peoplePage(
      viewerId,
      rows.map((row) => ({ cursorId: row.id, person: row.followed })),
    );
  }

  async followEdges(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      return { viewerFollowsTarget: false, targetFollowsViewer: false };
    }
    const rows = await this.prisma.followRelationship.findMany({
      where: {
        status: 'FOLLOWING',
        OR: [
          { followerId: viewerId, followedId: targetId },
          { followerId: targetId, followedId: viewerId },
        ],
      },
    });
    return {
      viewerFollowsTarget: rows.some((row) => row.followerId === viewerId),
      targetFollowsViewer: rows.some((row) => row.followerId === targetId),
    };
  }

  // -- Connections ----------------------------------------------------------

  async requestConnection(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw Errors.validation("You can't connect with yourself.");
    }
    const context = await this.context(viewerId, targetId);
    if (!audienceAllows(context.privacy.whoCanConnect, context.audience)) {
      throw Errors.permissionDenied("This person isn't accepting connection requests.");
    }
    const state = connectionState(viewerId, context.connection);
    if (state === 'CONNECTED') {
      throw Errors.conflict("You're already connected with this person.");
    }
    if (state === 'REQUESTED_BY_ME') {
      throw Errors.conflict("You've already sent this person a connection request.");
    }
    if (state === 'REQUESTED_BY_THEM') {
      throw Errors.conflict('This person has already sent you a connection request. Accept it instead.');
    }

    // Exactly one row per pair. `canonicalPair` fixes the storage order and the
    // [personLowId, personHighId] unique lets a request after a DECLINED,
    // CANCELLED or REMOVED outcome reuse the same row.
    const { low, high } = canonicalPair(viewerId, targetId);
    await this.prisma.connectionRelationship.upsert({
      where: { personLowId_personHighId: { personLowId: low, personHighId: high } },
      create: {
        id: newId('conn'),
        personLowId: low,
        personHighId: high,
        requesterId: viewerId,
        addresseeId: targetId,
        status: 'REQUESTED',
      },
      update: { requesterId: viewerId, addresseeId: targetId, status: 'REQUESTED' },
    });

    await this.notifications.emit({
      personId: targetId,
      type: 'CONNECTION_REQUEST',
      category: 'SOCIAL',
      title: `${this.nameOf(context.viewer)} would like to connect.`,
      body: 'Review the request on their profile.',
      sourceType: 'CONNECTION',
      sourceId: viewerId,
      // NORMAL, so a push delivery is queued. Unlike FOLLOW this is not
      // suppressible by preferences either: preferenceAllows in
      // notification-rules.ts force-allows CONNECTION_REQUEST and
      // CONNECTION_ACCEPTED because they need a reply.
      priority: 'NORMAL',
    });
    await this.recordAudit(viewerId, 'CONNECTION_REQUESTED', targetId);
    return { connection: 'REQUESTED_BY_ME' };
  }

  async acceptConnection(viewerId: string, targetId: string) {
    const { context, row } = await this.pendingRequest(viewerId, targetId);
    await this.prisma.connectionRelationship.update({
      where: { id: row.id },
      data: { status: 'ACCEPTED' },
    });
    await this.notifications.emit({
      personId: row.requesterId,
      type: 'CONNECTION_ACCEPTED',
      category: 'SOCIAL',
      title: `${this.nameOf(context.viewer)} accepted your connection request.`,
      body: 'View their profile.',
      sourceType: 'CONNECTION',
      sourceId: viewerId,
      priority: 'NORMAL',
    });
    await this.recordAudit(viewerId, 'CONNECTION_ACCEPTED', targetId);
    return { connection: 'CONNECTED' };
  }

  async declineConnection(viewerId: string, targetId: string) {
    const { row } = await this.pendingRequest(viewerId, targetId);
    await this.prisma.connectionRelationship.update({
      where: { id: row.id },
      data: { status: 'DECLINED' },
    });
    await this.recordAudit(viewerId, 'CONNECTION_DECLINED', targetId);
    return { connection: 'NONE' };
  }

  /**
   * Cancels a request the viewer sent, or removes an accepted connection. The
   * current status decides which, and only the requester may cancel.
   */
  async withdrawConnection(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw Errors.validation("You can't connect with yourself.");
    }
    const context = await this.context(viewerId, targetId);
    const row = context.connection;
    if (!row || (row.status !== 'REQUESTED' && row.status !== 'ACCEPTED')) {
      throw Errors.notFound("You aren't connected with this person.");
    }
    if (row.status === 'REQUESTED') {
      if (row.requesterId !== viewerId) {
        throw Errors.permissionDenied('Only the person who sent this request can cancel it.');
      }
      await this.prisma.connectionRelationship.update({
        where: { id: row.id },
        data: { status: 'CANCELLED' },
      });
      await this.recordAudit(viewerId, 'CONNECTION_REMOVED', targetId, {
        previousStatus: 'REQUESTED',
        outcome: 'CANCELLED',
      });
      return { connection: 'NONE' };
    }
    await this.prisma.connectionRelationship.update({
      where: { id: row.id },
      data: { status: 'REMOVED' },
    });
    await this.recordAudit(viewerId, 'CONNECTION_REMOVED', targetId, {
      previousStatus: 'ACCEPTED',
      outcome: 'REMOVED',
    });
    return { connection: 'NONE' };
  }

  async connections(viewerId: string, targetId: string, cursor?: string): Promise<SocialPage> {
    const context = await this.context(viewerId, targetId);
    if (!audienceAllows(context.privacy.connectionVisibility, context.audience)) {
      return this.hiddenPage('CONNECTIONS');
    }
    const rows = await this.prisma.connectionRelationship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ personLowId: targetId }, { personHighId: targetId }],
      },
      include: { personLow: true, personHigh: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: SOCIAL_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return this.peoplePage(
      viewerId,
      rows.map((row) => ({
        cursorId: row.id,
        person: row.personLowId === targetId ? row.personHigh : row.personLow,
      })),
    );
  }

  async incomingConnectionRequests(viewerId: string, cursor?: string): Promise<SocialPage> {
    const rows = await this.prisma.connectionRelationship.findMany({
      where: { addresseeId: viewerId, status: 'REQUESTED' },
      include: { personLow: true, personHigh: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: SOCIAL_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return this.peoplePage(
      viewerId,
      rows.map((row) => ({
        cursorId: row.id,
        person: row.requesterId === row.personLowId ? row.personLow : row.personHigh,
      })),
    );
  }

  // -- Blocks and reports ---------------------------------------------------

  async block(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw Errors.validation("You can't block yourself.");
    }
    // Deliberately not routed through `context()`: blocking someone who has
    // already blocked you must still work.
    const target = await this.prisma.person.findUnique({ where: { id: targetId } });
    if (!target) {
      throw Errors.notFound(PROFILE_GONE);
    }
    const { low, high } = canonicalPair(viewerId, targetId);
    await this.prisma.$transaction([
      this.prisma.followRelationship.updateMany({
        where: {
          status: 'FOLLOWING',
          OR: [
            { followerId: viewerId, followedId: targetId },
            { followerId: targetId, followedId: viewerId },
          ],
        },
        data: { status: 'UNFOLLOWED' },
      }),
      this.prisma.connectionRelationship.updateMany({
        where: { personLowId: low, personHighId: high },
        data: { status: 'REMOVED' },
      }),
      this.prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: viewerId, blockedId: targetId } },
        create: { id: newId('blk'), blockerId: viewerId, blockedId: targetId },
        update: {},
      }),
    ]);
    // Blocking severs the social graph only. It never removes a
    // ClassMembership, Enrollment, OrganizationMembership or
    // StudyGroupMembership: academic and organizational standing is not a
    // social relationship and must not be lost by blocking a classmate.
    await this.recordAudit(viewerId, 'BLOCKED', targetId);
    return { blocked: true };
  }

  async unblock(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw Errors.validation("You can't block yourself.");
    }
    const { count } = await this.prisma.userBlock.deleteMany({
      where: { blockerId: viewerId, blockedId: targetId },
    });
    if (!count) {
      return { blocked: false };
    }
    // Unblocking restores visibility only; the follows and connection that the
    // block cleared are not reinstated.
    await this.recordAudit(viewerId, 'UNBLOCKED', targetId);
    return { blocked: false };
  }

  async blockedPeople(viewerId: string, cursor?: string) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: viewerId },
      include: { blocked: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SOCIAL_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return {
      items: rows.map((row) => ({
        ...this.card(row.blocked),
        blockedAt: row.createdAt.toISOString(),
        actions: ['UNBLOCK'],
      })),
      nextCursor: rows.length === SOCIAL_PAGE_SIZE ? rows[rows.length - 1].id : null,
      visible: true,
    };
  }

  async report(viewerId: string, targetId: string, input: { reason?: string; details?: string }) {
    if (viewerId === targetId) {
      throw Errors.validation("You can't report yourself.");
    }
    const target = await this.prisma.person.findUnique({ where: { id: targetId } });
    if (!target) {
      throw Errors.notFound(PROFILE_GONE);
    }
    const reason = Object.values(ReportReason).includes(input.reason as ReportReason)
      ? (input.reason as ReportReason)
      : ReportReason.OTHER;
    const report = await this.prisma.moderationReport.create({
      data: {
        id: newId('rpt'),
        reporterId: viewerId,
        targetType: 'PERSON',
        targetId,
        reason,
        details: input.details?.trim() || null,
      },
    });
    await this.recordAudit(viewerId, 'PERSON_REPORTED', targetId, { reportId: report.id, reason });
    return {
      id: report.id,
      status: report.status,
      message: 'Thanks. A moderator will review this report.',
    };
  }

  // -- Privacy settings -----------------------------------------------------

  async privacySettings(personId: string): Promise<PrivacySettingsView> {
    return this.view(await this.ensurePrivacySettings(personId));
  }

  async updatePrivacySettings(
    personId: string,
    input: {
      profileVisibility?: string;
      findable?: boolean;
      whoCanFollow?: string;
      whoCanConnect?: string;
      whoCanMessage?: string;
      activityVisibility?: string;
      followerVisibility?: string;
      followingVisibility?: string;
      connectionVisibility?: string;
    },
  ): Promise<PrivacySettingsView> {
    const changed: Record<string, string | boolean> = {};
    const audience = (field: string, value?: string) => {
      if (value === undefined) {
        return undefined;
      }
      const error = privacyAudienceError(field, value);
      if (error) {
        throw Errors.validation(error);
      }
      changed[field] = value;
      return value;
    };

    const data: Prisma.PrivacySettingsUpdateInput = {
      profileVisibility: audience('profileVisibility', input.profileVisibility),
      whoCanFollow: audience('whoCanFollow', input.whoCanFollow),
      whoCanConnect: audience('whoCanConnect', input.whoCanConnect),
      whoCanMessage: audience('whoCanMessage', input.whoCanMessage),
      activityVisibility: audience('activityVisibility', input.activityVisibility),
      followerVisibility: audience('followerVisibility', input.followerVisibility),
      followingVisibility: audience('followingVisibility', input.followingVisibility),
      connectionVisibility: audience('connectionVisibility', input.connectionVisibility),
    };
    if (input.findable !== undefined) {
      data.findable = input.findable;
      changed.findable = input.findable;
    }

    await this.ensurePrivacySettings(personId);
    if (!Object.keys(changed).length) {
      return this.privacySettings(personId);
    }
    const updated = await this.prisma.privacySettings.update({ where: { personId }, data });
    await this.recordAudit(personId, 'PRIVACY_SETTINGS_CHANGED', null, { changed });
    return this.view(updated);
  }

  async privacyFor(personId: string): Promise<PrivacySettingsView> {
    const row = await this.prisma.privacySettings.findUnique({ where: { personId } });
    return row ? this.view(row) : { ...DEFAULT_PRIVACY };
  }

  // -- Shared helpers -------------------------------------------------------

  async counts(targetId: string) {
    const [followers, following, connections] = await Promise.all([
      this.prisma.followRelationship.count({
        where: { followedId: targetId, status: 'FOLLOWING' },
      }),
      this.prisma.followRelationship.count({
        where: { followerId: targetId, status: 'FOLLOWING' },
      }),
      this.prisma.connectionRelationship.count({
        where: { status: 'ACCEPTED', OR: [{ personLowId: targetId }, { personHighId: targetId }] },
      }),
    ]);
    return { followers, following, connections };
  }

  async recordAudit(
    actorId: string,
    action: string,
    targetPersonId: string | null = null,
    metadata?: Prisma.InputJsonValue,
  ) {
    await this.prisma.socialAudit.create({
      data: { id: newId('saud'), actorId, action, targetPersonId, metadata },
    });
  }

  card(person: {
    id: string;
    displayName: string | null;
    username: string | null;
    photoFileId: string | null;
  }): PersonCard {
    return {
      id: person.id,
      displayName: person.displayName,
      username: person.username,
      photoFileId: person.photoFileId,
    };
  }

  private nameOf(person: { displayName: string | null; username: string | null }): string {
    return person.displayName ?? person.username ?? 'Someone';
  }

  private async pendingRequest(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw Errors.validation("You can't connect with yourself.");
    }
    const context = await this.context(viewerId, targetId);
    const row = context.connection;
    if (!row || row.status !== 'REQUESTED') {
      throw Errors.notFound('This connection request is no longer available.');
    }
    if (row.addresseeId !== viewerId) {
      throw Errors.permissionDenied('Only the person who received this request can respond to it.');
    }
    return { context, row };
  }

  private hiddenPage(list: SocialList): SocialPage {
    return { items: [], nextCursor: null, visible: false, message: listHiddenMessage(list) };
  }

  /**
   * Serializes a page of people, dropping anyone the viewer has blocked or who
   * has blocked them. The cursor is taken from the unfiltered rows so paging
   * stays stable even when entries are removed.
   */
  private async peoplePage(
    viewerId: string,
    rows: Array<{
      cursorId: string;
      person: {
        id: string;
        displayName: string | null;
        username: string | null;
        photoFileId: string | null;
      };
    }>,
  ): Promise<SocialPage> {
    const nextCursor = rows.length === SOCIAL_PAGE_SIZE ? rows[rows.length - 1].cursorId : null;
    const personIds = rows.map((row) => row.person.id).filter((id) => id !== viewerId);
    const blocks = personIds.length
      ? await this.prisma.userBlock.findMany({
          where: {
            OR: [
              { blockerId: viewerId, blockedId: { in: personIds } },
              { blockedId: viewerId, blockerId: { in: personIds } },
            ],
          },
        })
      : [];
    const hidden = new Set(
      blocks.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId)),
    );
    return {
      items: rows.filter((row) => !hidden.has(row.person.id)).map((row) => this.card(row.person)),
      nextCursor,
      visible: true,
    };
  }

  private async sharedContextFor(viewerId: string, targetId: string): Promise<SharedContext> {
    const personIds = viewerId === targetId ? [viewerId] : [viewerId, targetId];
    const [classRows, enrollmentRows, organizationRows, studyGroupRows] = await Promise.all([
      this.prisma.classMembership.findMany({
        where: { personId: { in: personIds }, status: 'ACTIVE' },
        include: { class: true },
      }),
      this.prisma.enrollment.findMany({
        where: { personId: { in: personIds }, status: 'ACTIVE' },
        include: { courseOffering: { include: { course: true, semester: true } } },
      }),
      this.prisma.organizationMembership.findMany({
        where: { personId: { in: personIds }, status: 'ACTIVE' },
        include: { organization: true },
      }),
      this.prisma.studyGroupMembership.findMany({
        where: { personId: { in: personIds }, status: 'ACTIVE' },
        include: { studyGroup: true },
      }),
    ]);

    const classIds = new Set(
      sharedObjectIds(
        classRows.map((row) => ({ personId: row.personId, objectId: row.classId })),
        viewerId,
        targetId,
      ),
    );
    const offeringIds = new Set(
      sharedObjectIds(
        enrollmentRows.map((row) => ({ personId: row.personId, objectId: row.courseOfferingId })),
        viewerId,
        targetId,
      ),
    );
    const organizationIds = new Set(
      sharedObjectIds(
        organizationRows.map((row) => ({ personId: row.personId, objectId: row.organizationId })),
        viewerId,
        targetId,
      ),
    );
    const studyGroupIds = new Set(
      sharedObjectIds(
        studyGroupRows.map((row) => ({ personId: row.personId, objectId: row.studyGroupId })),
        viewerId,
        targetId,
      ),
    );

    const classes = uniqueById(
      classRows
        .filter((row) => classIds.has(row.classId))
        .map((row) => ({ id: row.class.id, code: row.class.code, name: row.class.name })),
    );
    const courseOfferings = uniqueById(
      enrollmentRows
        .filter((row) => offeringIds.has(row.courseOfferingId))
        .map((row) => ({
          id: row.courseOffering.id,
          code: row.courseOffering.course.code,
          title: row.courseOffering.course.title,
          semester: row.courseOffering.semester.label,
        })),
    );
    const organizations = uniqueById(
      organizationRows
        .filter((row) => organizationIds.has(row.organizationId))
        .map((row) => ({ id: row.organization.id, name: row.organization.name })),
    );
    const studyGroups = uniqueById(
      studyGroupRows
        .filter((row) => studyGroupIds.has(row.studyGroupId))
        .map((row) => ({ id: row.studyGroup.id, name: row.studyGroup.name })),
    );

    return {
      classes,
      courseOfferings,
      organizations,
      studyGroups,
      total:
        classes.length + courseOfferings.length + organizations.length + studyGroups.length,
    };
  }

  private async ensurePrivacySettings(personId: string) {
    const existing = await this.prisma.privacySettings.findUnique({ where: { personId } });
    if (existing) {
      return existing;
    }
    return this.prisma.privacySettings.create({
      data: { id: newId('priv'), personId, ...DEFAULT_PRIVACY },
    });
  }

  private view(row: PrivacySettingsView): PrivacySettingsView {
    return {
      profileVisibility: row.profileVisibility,
      findable: row.findable,
      whoCanFollow: row.whoCanFollow,
      whoCanConnect: row.whoCanConnect,
      whoCanMessage: row.whoCanMessage,
      activityVisibility: row.activityVisibility,
      followerVisibility: row.followerVisibility,
      followingVisibility: row.followingVisibility,
      connectionVisibility: row.connectionVisibility,
    };
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return [...seen.values()];
}
