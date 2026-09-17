import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import { FilesService } from '../files/files.service';
import { canSurfaceInDiscovery } from '../files/file-policy';
import {
  AuthorContext,
  ContextRole,
  PostContextType,
  PostStatus,
  PostVisibility,
  canCreatePost,
  canEditPost,
  canRemovePost,
  canTransitionPost,
  resolveVisibility,
} from './content-policy';
import {
  FeedCandidate,
  FeedFilter,
  authorizeFeedCandidates,
  feedPage,
  newContentBanner,
  rankFeed,
} from './feed-query';
import { loadViewerContext } from './viewer-context';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async createPost(
    personId: string,
    input: {
      body: string;
      contextType: PostContextType;
      contextId?: string;
      visibility?: PostVisibility;
      kind?: string;
      fileIds?: string[];
      resourceIds?: string[];
    },
  ) {
    const author = await this.authorContext(personId, input.contextType, input.contextId);
    const allowed = canCreatePost(author);
    if (!allowed.allowed) {
      throw Errors.permissionDenied(allowed.reason);
    }
    const visibility = resolveVisibility(input.contextType, input.visibility ?? 'CAMPUS_ONLY');
    const now = new Date();
    const post = await this.prisma.post.create({
      data: {
        id: newId('post'),
        authorId: personId,
        contextType: input.contextType,
        contextId: input.contextId ?? null,
        organizationId: input.contextType === 'ORGANIZATION' ? input.contextId : null,
        body: input.body.trim(),
        status: 'PUBLISHED',
        visibility,
        kind: input.kind === 'ANNOUNCEMENT' ? 'POST' : input.kind ?? 'POST',
        publishedAt: now,
      },
      include: { author: true, attachments: { include: { file: true, resource: true } } },
    });
    await this.attach(personId, post.id, input.fileIds ?? [], input.resourceIds ?? []);
    return this.serialize(await this.requireVisible(personId, post.id), personId);
  }

  async getPost(personId: string, postId: string) {
    return this.serialize(await this.requireVisible(personId, postId), personId);
  }

  async editPost(personId: string, postId: string, body: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw Errors.notFound();
    if (
      !canEditPost({
        authorId: post.authorId,
        personId,
        status: post.status as PostStatus,
        publishedAt: post.publishedAt,
        now: new Date(),
      })
    ) {
      throw Errors.permissionDenied();
    }
    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { body: body.trim() },
    });
    return this.serialize(await this.requireVisible(personId, updated.id), personId);
  }

  async removePost(personId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw Errors.notFound();
    const role = (await this.authorContext(personId, post.contextType as PostContextType, post.contextId ?? undefined)).role;
    if (
      !canRemovePost({
        authorId: post.authorId,
        personId,
        contextType: post.contextType as PostContextType,
        viewerRole: role,
      })
    ) {
      throw Errors.permissionDenied();
    }
    if (!canTransitionPost(post.status as PostStatus, 'REMOVED')) {
      throw Errors.validation('This post is no longer available.');
    }
    await this.prisma.post.update({
      where: { id: postId },
      data: { status: 'REMOVED', removedAt: new Date() },
    });
    return { postId, status: 'REMOVED' };
  }

  async feed(
    personId: string,
    input: { cursor?: string; limit?: number; filter?: FeedFilter; contextType?: PostContextType; contextId?: string; since?: string } = {},
  ) {
    const viewer = await loadViewerContext(this.prisma, personId);
    const posts = await this.prisma.post.findMany({
      where: {
        ...(input.contextType ? { contextType: input.contextType } : {}),
        ...(input.contextId ? { contextId: input.contextId } : {}),
      },
      include: { attachments: { include: { file: true, resource: true } }, reactions: true, comments: true },
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });
    const candidates: FeedCandidate[] = posts.map((post) => this.asCandidate(post));
    const authorized = authorizeFeedCandidates(candidates, viewer);
    const ranked = rankFeed({
      candidates: authorized,
      viewer,
      filter: input.filter ?? 'FOR_YOU',
      now: new Date(),
    });
    const page = feedPage(ranked, input.limit ?? 20);
    const items = [];
    for (const candidate of page.items) {
      const post = posts.find((row) => row.id === candidate.id);
      if (post) items.push(await this.serialize(post, personId));
    }
    const banner = input.since
      ? newContentBanner({ candidates: authorized, viewer, filter: input.filter ?? 'FOR_YOU', since: new Date(input.since) })
      : { count: 0, label: null };
    return { items, nextCursor: page.nextCursor, newContent: banner };
  }

  engineName() {
    return 'Post';
  }

  private asCandidate(post: {
    id: string;
    authorId: string;
    contextType: string;
    contextId: string | null;
    status: string;
    visibility: string;
    publishedAt: Date | null;
    reactions?: unknown[];
    comments?: unknown[];
  }): FeedCandidate {
    return {
      id: post.id,
      kind: 'POST',
      authorId: post.authorId,
      contextType: post.contextType as PostContextType,
      contextId: post.contextId,
      status: post.status as PostStatus,
      visibility: post.visibility as PostVisibility,
      priority: 'NORMAL',
      publishedAt: post.publishedAt ?? new Date(0),
      reactionCount: post.reactions?.length ?? 0,
      commentCount: post.comments?.length ?? 0,
    };
  }

  private async requireVisible(personId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { author: true, attachments: { include: { file: true, resource: true } }, reactions: true, comments: true },
    });
    if (!post) throw Errors.notFound();
    const viewer = await loadViewerContext(this.prisma, personId);
    if (authorizeFeedCandidates([this.asCandidate(post)], viewer).length === 0) {
      throw Errors.notFound();
    }
    return post;
  }

  private async attach(personId: string, postId: string, fileIds: string[], resourceIds: string[]) {
    for (const fileId of fileIds) {
      await this.files.get(personId, fileId);
      await this.prisma.postAttachment.create({
        data: { id: newId('patt'), postId, fileId },
      });
    }
    for (const resourceId of resourceIds) {
      await this.prisma.postAttachment.create({
        data: { id: newId('patt'), postId, resourceId },
      });
    }
  }

  private async authorContext(personId: string, contextType: PostContextType, contextId?: string): Promise<AuthorContext> {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    const accountActive = person?.accountState !== 'SUSPENDED';
    let role: ContextRole = 'NONE';
    if (contextType === 'PERSON' || contextType === 'GLOBAL') {
      role = 'MEMBER';
    }
    if (contextType === 'CLASS' && contextId) {
      const membership = await this.prisma.classMembership.findUnique({
        where: { classId_personId: { classId: contextId, personId } },
      });
      if (membership?.status === 'ACTIVE') {
        role = membership.role === 'CLASS_REPRESENTATIVE' ? 'CLASS_REP' : 'STUDENT';
      }
    }
    if (contextType === 'ORGANIZATION' && contextId) {
      const membership = await this.prisma.organizationMembership.findUnique({
        where: { organizationId_personId: { organizationId: contextId, personId } },
      });
      if (membership?.status === 'ACTIVE') {
        role = membership.role === 'ADMIN' || membership.role === 'OFFICER' ? 'OFFICER' : 'MEMBER';
      }
    }
    if (contextType === 'COURSE' && contextId) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { courseOfferingId_personId: { courseOfferingId: contextId, personId } },
      });
      if (enrollment?.status === 'ACTIVE') role = 'STUDENT';
    }
    return { contextType, role, accountActive };
  }

  private async serialize(
    post: {
      id: string;
      authorId: string;
      contextType: string;
      contextId: string | null;
      organizationId?: string | null;
      body: string;
      status: string;
      visibility: string;
      kind: string;
      publishedAt: Date | null;
      createdAt: Date;
      author?: { displayName: string | null };
      attachments?: Array<{
        fileId: string | null;
        resourceId: string | null;
        file: { id: string; securityClass: string; lifecycleState: string; processingState: string } | null;
        resource: { id: string; visibility: string; status: string } | null;
      }>;
    },
    personId: string,
  ) {
    const attachments = [];
    for (const attachment of post.attachments ?? []) {
      if (attachment.file) {
        if (!canSurfaceInDiscovery(attachment.file.securityClass)) {
          continue;
        }
        attachments.push({
          kind: 'FILE',
          fileId: attachment.file.id,
          available: attachment.file.lifecycleState === 'AVAILABLE' || attachment.file.processingState === 'READY',
        });
      }
      if (attachment.resource) {
        attachments.push({
          kind: 'RESOURCE',
          resourceId: attachment.resource.id,
          visibility: attachment.resource.visibility,
          status: attachment.resource.status,
        });
      }
    }
    return {
      id: post.id,
      engine: 'Post',
      contextType: post.contextType,
      contextId: post.contextId,
      organizationId: post.organizationId ?? (post.contextType === 'ORGANIZATION' ? post.contextId : null),
      body: post.body,
      status: post.status,
      visibility: post.visibility,
      kind: post.kind,
      authorId: post.authorId,
      authorName: post.author?.displayName ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? post.createdAt.toISOString(),
      attachments,
      viewerId: personId,
    };
  }
}
