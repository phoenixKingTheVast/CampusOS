import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import { SocialService } from './social.service';
import {
  audienceAllows,
  connectionState,
  followState,
  messagingPolicy,
  normalizeUsername,
  profileActions,
  usernameError,
} from './social-rules';

@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly social: SocialService,
  ) {}

  async me(personId: string) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person) {
      throw Errors.unauthenticated();
    }
    return this.serialize(person);
  }

  async usernameAvailability(username: string) {
    const normalized = normalizeUsername(username);
    this.assertUsername(normalized);
    const existing = await this.prisma.person.findFirst({
      where: { username: { equals: normalized, mode: 'insensitive' } },
    });
    return { username: normalized, available: !existing };
  }

  async upsertProfile(
    personId: string,
    input: {
      displayName: string;
      username: string;
      bio?: string;
      givenName?: string;
      middleName?: string;
      familyName?: string;
    },
  ) {
    const username = normalizeUsername(input.username);
    this.assertUsername(username);
    if (!input.displayName.trim()) {
      throw Errors.validation('Enter your name.');
    }
    const taken = await this.prisma.person.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        NOT: { id: personId },
      },
    });
    if (taken) {
      throw Errors.conflict('That username is already taken.');
    }

    const current = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!current) {
      throw Errors.unauthenticated();
    }

    const nextState =
      current.accountState === 'NEW' || current.accountState === 'PROFILE_INCOMPLETE'
        ? 'STUDENT_VERIFICATION_PENDING'
        : current.accountState;

    const person = await this.prisma.person.update({
      where: { id: personId },
      data: {
        displayName: input.displayName.trim(),
        username,
        bio: input.bio?.trim() || null,
        givenName: input.givenName?.trim() || null,
        middleName: input.middleName?.trim() || null,
        familyName: input.familyName?.trim() || null,
        accountState: nextState,
      },
    });
    return this.serialize(person);
  }

  /**
   * A person's profile as the viewer is allowed to see it. `context()` has
   * already rejected a missing person and a block in either direction, so what
   * remains to decide is how much of an existing profile to disclose.
   */
  async profile(viewerId: string, personId: string) {
    const context = await this.social.context(viewerId, personId);

    if (!audienceAllows(context.privacy.profileVisibility, context.audience)) {
      return {
        id: context.target.id,
        displayName: context.target.displayName,
        username: context.target.username,
        photoFileId: context.target.photoFileId,
        isSelf: false,
        restricted: true,
        restrictionMessage: "This profile isn't visible to you.",
        // Advisory only, and deliberately short: blocking and reporting stay
        // reachable from a profile the viewer cannot otherwise see.
        actions: ['BLOCK', 'REPORT'],
      };
    }

    const [edges, counts] = await Promise.all([
      this.social.followEdges(viewerId, personId),
      this.social.counts(personId),
    ]);

    const follow = followState(edges);
    const connection = connectionState(viewerId, context.connection);
    const messaging = messagingPolicy({
      whoCanMessage: context.privacy.whoCanMessage,
      context: context.audience,
      blocked: context.blockedByMe || context.blockedMe,
    });
    const canFollow = !context.self && audienceAllows(context.privacy.whoCanFollow, context.audience);
    const canConnect =
      !context.self && audienceAllows(context.privacy.whoCanConnect, context.audience);

    // A count is only as visible as the list it summarizes, so a hidden list
    // yields null rather than a number the viewer could not have derived.
    const followersVisible = audienceAllows(context.privacy.followerVisibility, context.audience);
    const followingVisible = audienceAllows(context.privacy.followingVisibility, context.audience);
    const connectionsVisible = audienceAllows(
      context.privacy.connectionVisibility,
      context.audience,
    );

    return {
      id: context.target.id,
      displayName: context.target.displayName,
      username: context.target.username,
      bio: context.target.bio,
      photoFileId: context.target.photoFileId,
      // Account state is the person's own business; it is never disclosed to
      // another viewer.
      ...(context.self ? { accountState: context.target.accountState } : {}),
      isSelf: context.self,
      restricted: false,
      restrictionMessage: null,
      relationship: {
        follow,
        connection,
        following: follow === 'FOLLOWING' || follow === 'MUTUAL',
        followedBy: follow === 'FOLLOWED_BY' || follow === 'MUTUAL',
        connected: context.connected,
        blockedByMe: context.blockedByMe,
        blockedMe: context.blockedMe,
      },
      counts: {
        followers: followersVisible ? counts.followers : null,
        following: followingVisible ? counts.following : null,
        connections: connectionsVisible ? counts.connections : null,
      },
      messagingPolicy: messaging,
      contextMemberships: context.shared,
      // Convenience for the client only. Every mutation endpoint re-derives
      // the same decision before it writes.
      actions: profileActions({
        self: context.self,
        blockedByMe: context.blockedByMe,
        follow,
        connection,
        canFollow,
        canConnect,
        canMessage: messaging.canMessage,
      }),
    };
  }

  /**
   * Edits an existing profile. Unlike the onboarding `POST /people/me/profile`
   * this never advances accountState and never touches the username.
   */
  async updateProfile(
    personId: string,
    input: {
      displayName?: string | null;
      bio?: string | null;
      givenName?: string | null;
      middleName?: string | null;
      familyName?: string | null;
      photoFileId?: string | null;
    },
  ) {
    const current = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!current) {
      throw Errors.unauthenticated();
    }

    // A field that is absent is left alone; a field sent as null or blank is
    // cleared. class-validator's @IsOptional() lets an explicit null through,
    // so every read here has to tolerate one.
    const data: Prisma.PersonUpdateInput = {};
    if (input.displayName !== undefined) {
      const displayName = input.displayName?.trim();
      if (!displayName) {
        throw Errors.validation('Enter your name.');
      }
      data.displayName = displayName;
    }
    if (input.bio !== undefined) {
      data.bio = input.bio?.trim() || null;
    }
    if (input.givenName !== undefined) {
      data.givenName = input.givenName?.trim() || null;
    }
    if (input.middleName !== undefined) {
      data.middleName = input.middleName?.trim() || null;
    }
    if (input.familyName !== undefined) {
      data.familyName = input.familyName?.trim() || null;
    }
    if (input.photoFileId !== undefined) {
      data.photoFileId = await this.resolvePhotoFileId(personId, input.photoFileId);
    }

    const fields = Object.keys(data);
    if (!fields.length) {
      return this.serialize(current);
    }
    const person = await this.prisma.person.update({ where: { id: personId }, data });
    await this.social.recordAudit(personId, 'PROFILE_UPDATED', personId, { fields });
    return this.serialize(person);
  }

  async changeUsername(personId: string, requested: string) {
    const username = normalizeUsername(requested);
    this.assertUsername(username);

    const current = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!current) {
      throw Errors.unauthenticated();
    }
    if (current.username === username) {
      return this.serialize(current);
    }
    const taken = await this.prisma.person.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        NOT: { id: personId },
      },
    });
    if (taken) {
      throw Errors.conflict('That username is already taken.');
    }

    const [person] = await this.prisma.$transaction([
      this.prisma.person.update({ where: { id: personId }, data: { username } }),
      this.prisma.usernameChange.create({
        data: {
          id: newId('uchg'),
          personId,
          previousValue: current.username,
          nextValue: username,
        },
      }),
      this.prisma.socialAudit.create({
        data: {
          id: newId('saud'),
          actorId: personId,
          action: 'USERNAME_CHANGED',
          targetPersonId: personId,
          metadata: { previousValue: current.username ?? null, nextValue: username },
        },
      }),
    ]);
    return this.serialize(person);
  }

  /**
   * A profile photo has to be a file this person uploaded. Accepting an
   * arbitrary id would let anyone attach someone else's upload to their
   * profile.
   */
  private async resolvePhotoFileId(personId: string, photoFileId: string | null) {
    if (photoFileId === null || !photoFileId.trim()) {
      return null;
    }
    const file = await this.prisma.fileObject.findUnique({ where: { id: photoFileId.trim() } });
    if (!file || file.uploaderId !== personId) {
      throw Errors.validation('Upload a new photo and try again.');
    }
    return file.id;
  }

  private assertUsername(username: string) {
    const error = usernameError(username);
    if (error) {
      throw Errors.validation(error);
    }
  }

  private serialize(person: {
    id: string;
    phoneNumber: string;
    displayName: string | null;
    username: string | null;
    bio: string | null;
    givenName: string | null;
    middleName: string | null;
    familyName: string | null;
    photoFileId: string | null;
    accountState: string;
  }) {
    return {
      id: person.id,
      phoneNumber: person.phoneNumber,
      displayName: person.displayName,
      username: person.username,
      bio: person.bio,
      givenName: person.givenName,
      middleName: person.middleName,
      familyName: person.familyName,
      photoFileId: person.photoFileId,
      accountState: person.accountState,
    };
  }
}
