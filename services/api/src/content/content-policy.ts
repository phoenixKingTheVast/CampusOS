export type PostContextType =
  | 'GLOBAL'
  | 'PERSON'
  | 'CLASS'
  | 'COURSE'
  | 'ORGANIZATION'
  | 'STUDY_GROUP'
  | 'SERVICE'
  | 'EVENT';

export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'RESTRICTED' | 'ARCHIVED' | 'REMOVED';

const POST_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  DRAFT: ['PUBLISHED', 'REMOVED'],
  PUBLISHED: ['RESTRICTED', 'ARCHIVED', 'REMOVED'],
  RESTRICTED: ['PUBLISHED', 'ARCHIVED', 'REMOVED'],
  ARCHIVED: ['REMOVED'],
  REMOVED: [],
};

export function canTransitionPost(from: PostStatus, to: PostStatus): boolean {
  return POST_TRANSITIONS[from]?.includes(to) ?? false;
}

export type PostVisibility =
  | 'PUBLIC'
  | 'CAMPUS_ONLY'
  | 'CONTEXT_ONLY'
  | 'CONNECTIONS'
  | 'FOLLOWERS'
  | 'INVITE_ONLY';

const CONTEXT_VISIBILITY: Record<PostContextType, PostVisibility[]> = {
  GLOBAL: ['CAMPUS_ONLY'],
  PERSON: ['CAMPUS_ONLY', 'CONNECTIONS', 'FOLLOWERS'],
  CLASS: ['CONTEXT_ONLY'],
  COURSE: ['CONTEXT_ONLY'],
  ORGANIZATION: ['PUBLIC', 'CAMPUS_ONLY', 'CONTEXT_ONLY', 'FOLLOWERS'],
  STUDY_GROUP: ['CONTEXT_ONLY', 'INVITE_ONLY'],
  SERVICE: ['PUBLIC', 'CAMPUS_ONLY'],
  EVENT: ['PUBLIC', 'CAMPUS_ONLY', 'CONTEXT_ONLY', 'INVITE_ONLY'],
};

export function visibilityOptionsFor(context: PostContextType): PostVisibility[] {
  return CONTEXT_VISIBILITY[context];
}

/** Context policy overrides the author's choice rather than trusting the client. */
export function resolveVisibility(context: PostContextType, requested: PostVisibility): PostVisibility {
  const allowed = CONTEXT_VISIBILITY[context];
  return allowed.includes(requested) ? requested : allowed[0];
}

export type ContextRole =
  | 'NONE'
  | 'MEMBER'
  | 'STUDENT'
  | 'CLASS_REP'
  | 'LECTURER'
  | 'OFFICER'
  | 'OWNER'
  | 'PROVIDER'
  | 'MODERATOR';

export type AuthorContext = {
  contextType: PostContextType;
  role: ContextRole;
  accountActive: boolean;
  globalPostingEnabled?: boolean;
};

export function canCreatePost(author: AuthorContext): { allowed: boolean; reason?: string } {
  if (!author.accountActive) {
    return { allowed: false, reason: 'Your account cannot post right now.' };
  }
  if (author.contextType === 'GLOBAL') {
    return author.globalPostingEnabled
      ? { allowed: true }
      : { allowed: false, reason: 'Campus-wide posting is not available yet.' };
  }
  if (author.contextType === 'PERSON') {
    return { allowed: true };
  }
  if (author.role === 'NONE') {
    return { allowed: false, reason: "You don't have permission to post here." };
  }
  if (author.contextType === 'SERVICE' && author.role !== 'PROVIDER' && author.role !== 'OWNER') {
    return { allowed: false, reason: "You don't have permission to post here." };
  }
  if (author.contextType === 'ORGANIZATION' && author.role === 'MEMBER') {
    return { allowed: false, reason: 'Only officers can post for this organization.' };
  }
  if (author.contextType === 'EVENT' && author.role !== 'OWNER' && author.role !== 'OFFICER') {
    return { allowed: false, reason: "You don't have permission to post here." };
  }
  return { allowed: true };
}

export const POST_EDIT_WINDOW_MS = 15 * 60 * 1000;

export function canEditPost(input: {
  authorId: string;
  personId: string;
  status: PostStatus;
  publishedAt: Date | null;
  now: Date;
}): boolean {
  if (input.authorId !== input.personId) return false;
  if (input.status === 'DRAFT') return true;
  if (input.status !== 'PUBLISHED') return false;
  if (!input.publishedAt) return false;
  return input.now.getTime() - input.publishedAt.getTime() <= POST_EDIT_WINDOW_MS;
}

export function editedIndicator(input: { publishedAt: Date; updatedAt: Date }): boolean {
  return input.updatedAt.getTime() - input.publishedAt.getTime() > 1000;
}

export function canRemovePost(input: {
  authorId: string;
  personId: string;
  contextType: PostContextType;
  viewerRole: ContextRole;
}): boolean {
  if (input.authorId === input.personId) return true;
  if (input.viewerRole === 'MODERATOR') return true;
  if (input.contextType === 'CLASS' && input.viewerRole === 'CLASS_REP') return true;
  if (input.contextType === 'COURSE' && input.viewerRole === 'LECTURER') return true;
  if (input.contextType === 'ORGANIZATION' && (input.viewerRole === 'OFFICER' || input.viewerRole === 'OWNER')) {
    return true;
  }
  return false;
}

export const REMOVED_POST_MESSAGE = 'This post is no longer available.';

export function removedPostView(input: { status: PostStatus; isModerator: boolean }): {
  bodyVisible: boolean;
  message?: string;
} {
  if (input.status === 'PUBLISHED') {
    return { bodyVisible: true };
  }
  if (input.isModerator) {
    return { bodyVisible: true };
  }
  return { bodyVisible: false, message: REMOVED_POST_MESSAGE };
}

export type ReactionType = 'LIKE' | 'LOVE' | 'LAUGH' | 'APPLAUD' | 'CONFUSED';

export const REACTION_TYPES: ReactionType[] = ['LIKE', 'LOVE', 'LAUGH', 'APPLAUD', 'CONFUSED'];

/** MVP keeps one active reaction per person per post; reacting again replaces or clears. */
export function applyReaction(input: {
  existing: ReactionType | null;
  requested: ReactionType;
}): { reaction: ReactionType | null; removedPrevious: ReactionType | null } {
  if (input.existing === input.requested) {
    return { reaction: null, removedPrevious: input.existing };
  }
  return { reaction: input.requested, removedPrevious: input.existing };
}

export const MAX_COMMENT_DEPTH = 2;

/** Deeper replies are flattened onto the reply tier rather than nesting indefinitely. */
export function commentDisplayDepth(actualDepth: number): number {
  return Math.min(Math.max(actualDepth, 0), MAX_COMMENT_DEPTH - 1);
}

export function commentParentFor(input: { parentDepth: number; parentId: string; parentRootId: string | null }): string {
  return input.parentDepth >= MAX_COMMENT_DEPTH - 1 ? (input.parentRootId ?? input.parentId) : input.parentId;
}

export function mentionAllowed(input: {
  targetExists: boolean;
  targetMentionable: boolean;
  blockedEitherDirection: boolean;
  sharesContext: boolean;
}): boolean {
  if (!input.targetExists || !input.targetMentionable) return false;
  if (input.blockedEitherDirection) return false;
  return input.sharesContext;
}

export type FeedEntryKind = 'POST' | 'ANNOUNCEMENT' | 'EVENT' | 'ASSESSMENT' | 'SERVICE_UPDATE';

/** A feed entry points at its canonical object; it never converts one type into another. */
export function feedEntryKindFor(objectType: string): FeedEntryKind {
  switch (objectType) {
    case 'ANNOUNCEMENT':
      return 'ANNOUNCEMENT';
    case 'EVENT':
      return 'EVENT';
    case 'ASSIGNMENT':
    case 'TEST':
    case 'EXAM':
      return 'ASSESSMENT';
    case 'SERVICE':
      return 'SERVICE_UPDATE';
    default:
      return 'POST';
  }
}

export function sharedObjectRoute(kind: 'EVENT' | 'SERVICE' | 'RESOURCE' | 'POST', id: string): string {
  switch (kind) {
    case 'EVENT':
      return `/app/explore/event/${id}`;
    case 'SERVICE':
      return `/app/explore/service/${id}`;
    case 'RESOURCE':
      return `/app/learn/resource/${id}`;
    default:
      return `/app/post/${id}`;
  }
}

export const CONTENT_ANALYTICS_EVENTS = [
  'feed_opened',
  'feed_refreshed',
  'feed_item_opened',
  'feed_item_shared',
  'post_created',
  'post_edited',
  'post_removed',
  'post_reaction_added',
  'post_reaction_removed',
  'comment_created',
  'comment_replied',
  'post_reported',
  'feed_filter_changed',
  'new_content_banner_opened',
];

const FORBIDDEN_ANALYTICS_KEYS = ['body', 'commentBody', 'text', 'attachmentUrl', 'mentionNames'];

export function unsafeContentAnalyticsKeys(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((key) => FORBIDDEN_ANALYTICS_KEYS.includes(key));
}
