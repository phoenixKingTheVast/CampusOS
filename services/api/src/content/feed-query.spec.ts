import {
  FeedCandidate,
  ViewerContext,
  decodeFeedCursor,
  encodeFeedCursor,
  feedEligibility,
  feedFreshness,
  feedPage,
  filterAvailableOffline,
  matchesFilter,
  newContentBanner,
  rankFeed,
} from './feed-query';

const NOW = new Date('2026-03-10T12:00:00Z');

const viewer: ViewerContext = {
  personId: 'me',
  classIds: ['class_eee41'],
  courseIds: ['course_eee401'],
  organizationIds: ['org_engsoc'],
  studyGroupIds: ['sg_control'],
  followedPersonIds: ['p_follow'],
  connectedPersonIds: ['p_connect'],
  followedOrganizationIds: ['org_chess'],
  blockedPersonIds: ['p_blocked'],
};

function candidate(overrides: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    id: 'post_1',
    kind: 'POST',
    authorId: 'p_connect',
    contextType: 'CLASS',
    contextId: 'class_eee41',
    status: 'PUBLISHED',
    visibility: 'CONTEXT_ONLY',
    priority: 'NORMAL',
    publishedAt: new Date('2026-03-10T11:00:00Z'),
    reactionCount: 0,
    commentCount: 0,
    ...overrides,
  };
}

describe('feed query', () => {
  it('rejects items at the first failing stage of the authorization pipeline', () => {
    expect(feedEligibility(candidate(), viewer).eligible).toBe(true);
    expect(feedEligibility(candidate({ status: 'REMOVED' }), viewer).rejectedAt).toBe('LIFECYCLE');
    expect(feedEligibility(candidate({ authorId: 'p_blocked' }), viewer).rejectedAt).toBe('BLOCKING');
    expect(feedEligibility(candidate({ contextId: 'class_other' }), viewer).rejectedAt).toBe(
      'CONTEXT_RELATIONSHIP',
    );
  });

  it('keeps class content out of feeds for people outside the class', () => {
    const outsider: ViewerContext = { ...viewer, classIds: [], courseIds: [] };
    expect(feedEligibility(candidate(), outsider).eligible).toBe(false);
  });

  it('honours connection- and follower-scoped personal posts', () => {
    const personal = candidate({ contextType: 'PERSON', contextId: null, visibility: 'CONNECTIONS' });
    expect(feedEligibility(personal, viewer).eligible).toBe(true);
    expect(feedEligibility({ ...personal, authorId: 'p_follow' }, viewer).rejectedAt).toBe('VISIBILITY');
    expect(feedEligibility({ ...personal, authorId: 'p_follow', visibility: 'FOLLOWERS' }, viewer).eligible).toBe(
      true,
    );
  });

  it('ranks an urgent announcement above a highly reacted social post', () => {
    const urgent = candidate({
      id: 'ann_1',
      kind: 'ANNOUNCEMENT',
      priority: 'CRITICAL',
      reactionCount: 0,
      commentCount: 0,
      publishedAt: new Date('2026-03-10T08:00:00Z'),
    });
    const popular = candidate({
      id: 'post_pop',
      priority: 'NORMAL',
      reactionCount: 500,
      commentCount: 300,
      publishedAt: new Date('2026-03-10T11:55:00Z'),
    });
    const ranked = rankFeed({ candidates: [popular, urgent], viewer, filter: 'FOR_YOU', now: NOW });
    expect(ranked.map((item) => item.id)).toEqual(['ann_1', 'post_pop']);
  });

  it('lifts events that are about to start', () => {
    const soon = candidate({
      id: 'evt_soon',
      kind: 'EVENT',
      contextType: 'ORGANIZATION',
      contextId: 'org_engsoc',
      visibility: 'CAMPUS_ONLY',
      eventStartsAt: new Date('2026-03-10T18:00:00Z'),
    });
    const later = candidate({
      id: 'evt_later',
      kind: 'EVENT',
      contextType: 'ORGANIZATION',
      contextId: 'org_engsoc',
      visibility: 'CAMPUS_ONLY',
      eventStartsAt: new Date('2026-05-10T18:00:00Z'),
    });
    const ranked = rankFeed({ candidates: [later, soon], viewer, filter: 'ORGANIZATIONS', now: NOW });
    expect(ranked[0].id).toBe('evt_soon');
  });

  it('treats filters as views over one content system', () => {
    expect(matchesFilter(candidate(), 'MY_CLASS')).toBe(true);
    expect(matchesFilter(candidate(), 'ORGANIZATIONS')).toBe(false);
    expect(matchesFilter(candidate(), 'FOR_YOU')).toBe(true);
    const ranked = rankFeed({
      candidates: [candidate(), candidate({ id: 'org_post', contextType: 'ORGANIZATION', contextId: 'org_engsoc' })],
      viewer,
      filter: 'MY_CLASS',
      now: NOW,
    });
    expect(ranked.map((item) => item.id)).toEqual(['post_1']);
  });

  it('paginates by cursor rather than offset', () => {
    const items = Array.from({ length: 5 }, (_unused, index) =>
      candidate({ id: `post_${index}`, publishedAt: new Date(NOW.getTime() - index * 60_000) }),
    );
    const page = feedPage(items, 3);
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).not.toBeNull();
    const decoded = decodeFeedCursor(page.nextCursor!);
    expect(decoded?.id).toBe('post_2');
    expect(decodeFeedCursor('not-a-cursor')).toBeNull();
    expect(encodeFeedCursor(items[0])).toBe(encodeFeedCursor(items[0]));
  });

  it('returns no cursor on the last page', () => {
    const items = [candidate()];
    expect(feedPage(items, 20).nextCursor).toBeNull();
  });

  it('announces new content instead of reshuffling the visible list', () => {
    const since = new Date('2026-03-10T11:30:00Z');
    const fresh = [
      candidate({ id: 'new_1', publishedAt: new Date('2026-03-10T11:45:00Z') }),
      candidate({ id: 'new_2', publishedAt: new Date('2026-03-10T11:50:00Z') }),
      candidate({ id: 'old_1', publishedAt: new Date('2026-03-10T10:00:00Z') }),
      candidate({ id: 'blocked', authorId: 'p_blocked', publishedAt: new Date('2026-03-10T11:55:00Z') }),
    ];
    expect(newContentBanner({ candidates: fresh, viewer, filter: 'FOR_YOU', since })).toEqual({
      count: 2,
      label: '2 new posts',
    });
    expect(
      newContentBanner({ candidates: [fresh[0]], viewer, filter: 'FOR_YOU', since }).label,
    ).toBe('1 new post');
  });

  it('marks cached feeds as stale and keeps discovery online-only', () => {
    expect(feedFreshness({ online: true, fetchedAt: new Date('2026-03-09T00:00:00Z'), now: NOW })).toBe('LIVE');
    expect(feedFreshness({ online: false, fetchedAt: new Date('2026-03-10T11:50:00Z'), now: NOW })).toBe('CACHED');
    expect(feedFreshness({ online: false, fetchedAt: new Date('2026-03-10T09:00:00Z'), now: NOW })).toBe('STALE');
    expect(filterAvailableOffline('MY_CLASS')).toBe(true);
    expect(filterAvailableOffline('FOR_YOU')).toBe(false);
  });
});
