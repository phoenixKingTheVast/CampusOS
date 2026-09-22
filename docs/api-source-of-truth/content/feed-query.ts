import { FeedEntryKind, PostContextType, PostStatus, PostVisibility } from './content-policy';

export type FeedFilter = 'FOR_YOU' | 'FOLLOWING' | 'MY_CLASS' | 'MY_COURSES' | 'ORGANIZATIONS';

export type FeedPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

const PRIORITY_WEIGHT: Record<FeedPriority, number> = {
  CRITICAL: 10_000,
  HIGH: 1_000,
  NORMAL: 100,
  LOW: 10,
};

export type ViewerContext = {
  personId: string;
  classIds: string[];
  courseIds: string[];
  organizationIds: string[];
  studyGroupIds: string[];
  followedPersonIds: string[];
  connectedPersonIds: string[];
  followedOrganizationIds: string[];
  blockedPersonIds: string[];
};

export type FeedCandidate = {
  id: string;
  kind: FeedEntryKind;
  authorId: string;
  contextType: PostContextType;
  contextId: string | null;
  status: PostStatus;
  visibility: PostVisibility;
  priority: FeedPriority;
  publishedAt: Date;
  reactionCount: number;
  commentCount: number;
  eventStartsAt?: Date | null;
  viewerInteracted?: boolean;
};

export type EligibilityStage =
  | 'LIFECYCLE'
  | 'BLOCKING'
  | 'CONTEXT_RELATIONSHIP'
  | 'VISIBILITY'
  | 'ELIGIBLE';

export type EligibilityResult = { eligible: boolean; rejectedAt?: EligibilityStage };

function inContext(candidate: FeedCandidate, viewer: ViewerContext): boolean {
  switch (candidate.contextType) {
    case 'CLASS':
      return candidate.contextId !== null && viewer.classIds.includes(candidate.contextId);
    case 'COURSE':
      return candidate.contextId !== null && viewer.courseIds.includes(candidate.contextId);
    case 'ORGANIZATION':
    case 'SERVICE':
    case 'EVENT':
    case 'GLOBAL':
      return true;
    case 'STUDY_GROUP':
      return candidate.contextId !== null && viewer.studyGroupIds.includes(candidate.contextId);
    case 'PERSON':
      return (
        candidate.authorId === viewer.personId ||
        viewer.followedPersonIds.includes(candidate.authorId) ||
        viewer.connectedPersonIds.includes(candidate.authorId)
      );
    default:
      return true;
  }
}

function visibilitySatisfied(candidate: FeedCandidate, viewer: ViewerContext): boolean {
  switch (candidate.visibility) {
    case 'PUBLIC':
    case 'CAMPUS_ONLY':
      return true;
    case 'CONTEXT_ONLY':
      return candidate.contextId === null
        ? false
        : [...viewer.classIds, ...viewer.courseIds, ...viewer.organizationIds, ...viewer.studyGroupIds].includes(
            candidate.contextId,
          );
    case 'CONNECTIONS':
      return candidate.authorId === viewer.personId || viewer.connectedPersonIds.includes(candidate.authorId);
    case 'FOLLOWERS':
      return (
        candidate.authorId === viewer.personId ||
        viewer.followedPersonIds.includes(candidate.authorId) ||
        (candidate.contextId !== null && viewer.followedOrganizationIds.includes(candidate.contextId))
      );
    case 'INVITE_ONLY':
      return candidate.contextId !== null && viewer.studyGroupIds.includes(candidate.contextId);
    default:
      return false;
  }
}

/** Eligibility only. Ranking must never see items this function rejects. */
export function authorizeFeedCandidates(candidates: FeedCandidate[], viewer: ViewerContext): FeedCandidate[] {
  return candidates.filter((candidate) => feedEligibility(candidate, viewer).eligible);
}

/** Server-side gate. The client never receives content it then has to hide. */
export function feedEligibility(candidate: FeedCandidate, viewer: ViewerContext): EligibilityResult {
  if (candidate.status !== 'PUBLISHED') {
    return { eligible: false, rejectedAt: 'LIFECYCLE' };
  }
  if (viewer.blockedPersonIds.includes(candidate.authorId)) {
    return { eligible: false, rejectedAt: 'BLOCKING' };
  }
  if (!inContext(candidate, viewer)) {
    return { eligible: false, rejectedAt: 'CONTEXT_RELATIONSHIP' };
  }
  if (!visibilitySatisfied(candidate, viewer)) {
    return { eligible: false, rejectedAt: 'VISIBILITY' };
  }
  return { eligible: true, rejectedAt: 'ELIGIBLE' };
}

const FILTER_CONTEXTS: Record<FeedFilter, PostContextType[] | null> = {
  FOR_YOU: null,
  FOLLOWING: ['PERSON', 'ORGANIZATION'],
  MY_CLASS: ['CLASS'],
  MY_COURSES: ['COURSE'],
  ORGANIZATIONS: ['ORGANIZATION'],
};

/** Filters are query configurations over one content system, not separate feeds. */
export function matchesFilter(candidate: FeedCandidate, filter: FeedFilter): boolean {
  const contexts = FILTER_CONTEXTS[filter];
  return contexts === null || contexts.includes(candidate.contextType);
}

export function feedScore(candidate: FeedCandidate, viewer: ViewerContext, now: Date): number {
  let score = PRIORITY_WEIGHT[candidate.priority];

  if (candidate.contextType === 'CLASS' || candidate.contextType === 'COURSE') {
    score += 400;
  }
  if (candidate.kind === 'ANNOUNCEMENT' || candidate.kind === 'ASSESSMENT') {
    score += 300;
  }
  if (viewer.connectedPersonIds.includes(candidate.authorId)) {
    score += 60;
  } else if (viewer.followedPersonIds.includes(candidate.authorId)) {
    score += 30;
  }

  const ageHours = Math.max(0, (now.getTime() - candidate.publishedAt.getTime()) / 3_600_000);
  score += Math.max(0, 240 - ageHours * 4);

  if (candidate.eventStartsAt) {
    const hoursUntil = (candidate.eventStartsAt.getTime() - now.getTime()) / 3_600_000;
    if (hoursUntil >= 0 && hoursUntil <= 72) {
      score += 200 - hoursUntil * 2;
    }
  }
  if (candidate.viewerInteracted) {
    score += 40;
  }

  // Engagement nudges ordering within a tier; it can never lift a post above one.
  score += Math.min(25, Math.log1p(candidate.reactionCount + candidate.commentCount) * 6);

  return score;
}

export function rankFeed(input: {
  candidates: FeedCandidate[];
  viewer: ViewerContext;
  filter: FeedFilter;
  now: Date;
}): FeedCandidate[] {
  return authorizeFeedCandidates(input.candidates, input.viewer)
    .filter((candidate) => matchesFilter(candidate, input.filter))
    .map((candidate) => ({ candidate, score: feedScore(candidate, input.viewer, input.now) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.candidate.publishedAt.getTime() !== a.candidate.publishedAt.getTime()) {
        return b.candidate.publishedAt.getTime() - a.candidate.publishedAt.getTime();
      }
      return a.candidate.id.localeCompare(b.candidate.id);
    })
    .map((entry) => entry.candidate);
}

export type FeedCursor = { publishedAt: string; id: string };

export function encodeFeedCursor(candidate: FeedCandidate): string {
  const payload: FeedCursor = { publishedAt: candidate.publishedAt.toISOString(), id: candidate.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeFeedCursor(cursor: string): FeedCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed?.publishedAt !== 'string' || typeof parsed?.id !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const FEED_PAGE_SIZE = 20;
export const FEED_MAX_PAGE_SIZE = 50;

export function feedPage(items: FeedCandidate[], limit = FEED_PAGE_SIZE): {
  items: FeedCandidate[];
  nextCursor: string | null;
} {
  const size = Math.min(Math.max(limit, 1), FEED_MAX_PAGE_SIZE);
  const page = items.slice(0, size);
  const hasMore = items.length > size;
  return {
    items: page,
    nextCursor: hasMore && page.length > 0 ? encodeFeedCursor(page[page.length - 1]) : null,
  };
}

/**
 * New content is announced rather than spliced into the list, so an active
 * scroll position never shifts underneath the reader.
 */
export function newContentBanner(input: {
  candidates: FeedCandidate[];
  viewer: ViewerContext;
  filter: FeedFilter;
  since: Date;
}): { count: number; label: string | null } {
  const count = input.candidates.filter(
    (candidate) =>
      candidate.publishedAt > input.since &&
      feedEligibility(candidate, input.viewer).eligible &&
      matchesFilter(candidate, input.filter),
  ).length;
  if (count === 0) {
    return { count: 0, label: null };
  }
  return { count, label: count === 1 ? '1 new post' : `${count} new posts` };
}

export type FeedFreshness = 'LIVE' | 'CACHED' | 'STALE';

export const FEED_STALE_AFTER_MS = 30 * 60 * 1000;

export function feedFreshness(input: { online: boolean; fetchedAt: Date; now: Date }): FeedFreshness {
  if (input.online) return 'LIVE';
  return input.now.getTime() - input.fetchedAt.getTime() > FEED_STALE_AFTER_MS ? 'STALE' : 'CACHED';
}

/** Discovery reaches beyond the cache, so it cannot be served offline. */
export function filterAvailableOffline(filter: FeedFilter): boolean {
  return filter !== 'FOR_YOU';
}
