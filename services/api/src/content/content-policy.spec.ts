import {
  REMOVED_POST_MESSAGE,
  applyReaction,
  canCreatePost,
  canEditPost,
  canRemovePost,
  canTransitionPost,
  commentDisplayDepth,
  commentParentFor,
  feedEntryKindFor,
  mentionAllowed,
  removedPostView,
  resolveVisibility,
  sharedObjectRoute,
  unsafeContentAnalyticsKeys,
  visibilityOptionsFor,
} from './content-policy';

describe('content policy', () => {
  it('enforces the post lifecycle including restore from RESTRICTED', () => {
    expect(canTransitionPost('DRAFT', 'PUBLISHED')).toBe(true);
    expect(canTransitionPost('PUBLISHED', 'RESTRICTED')).toBe(true);
    expect(canTransitionPost('RESTRICTED', 'PUBLISHED')).toBe(true);
    expect(canTransitionPost('REMOVED', 'PUBLISHED')).toBe(false);
    expect(canTransitionPost('DRAFT', 'ARCHIVED')).toBe(false);
  });

  it('lets context policy override the requested visibility', () => {
    expect(resolveVisibility('CLASS', 'PUBLIC')).toBe('CONTEXT_ONLY');
    expect(resolveVisibility('COURSE', 'CAMPUS_ONLY')).toBe('CONTEXT_ONLY');
    expect(resolveVisibility('ORGANIZATION', 'PUBLIC')).toBe('PUBLIC');
    expect(resolveVisibility('PERSON', 'CONNECTIONS')).toBe('CONNECTIONS');
    expect(visibilityOptionsFor('STUDY_GROUP')).toEqual(['CONTEXT_ONLY', 'INVITE_ONLY']);
  });

  it('makes post creation contextual rather than a global button', () => {
    expect(canCreatePost({ contextType: 'CLASS', role: 'STUDENT', accountActive: true }).allowed).toBe(true);
    expect(canCreatePost({ contextType: 'CLASS', role: 'NONE', accountActive: true }).allowed).toBe(false);
    expect(canCreatePost({ contextType: 'ORGANIZATION', role: 'MEMBER', accountActive: true }).allowed).toBe(false);
    expect(canCreatePost({ contextType: 'ORGANIZATION', role: 'OFFICER', accountActive: true }).allowed).toBe(true);
    expect(canCreatePost({ contextType: 'SERVICE', role: 'STUDENT', accountActive: true }).allowed).toBe(false);
    expect(canCreatePost({ contextType: 'PERSON', role: 'NONE', accountActive: false }).allowed).toBe(false);
  });

  it('keeps global posting behind a flag so it can be enabled gradually', () => {
    expect(canCreatePost({ contextType: 'GLOBAL', role: 'STUDENT', accountActive: true }).allowed).toBe(false);
    expect(
      canCreatePost({ contextType: 'GLOBAL', role: 'STUDENT', accountActive: true, globalPostingEnabled: true })
        .allowed,
    ).toBe(true);
  });

  it('limits editing to the author within the edit window', () => {
    const publishedAt = new Date('2026-03-01T14:02:00Z');
    expect(
      canEditPost({
        authorId: 'p1',
        personId: 'p1',
        status: 'PUBLISHED',
        publishedAt,
        now: new Date('2026-03-01T14:11:00Z'),
      }),
    ).toBe(true);
    expect(
      canEditPost({
        authorId: 'p1',
        personId: 'p1',
        status: 'PUBLISHED',
        publishedAt,
        now: new Date('2026-03-01T14:40:00Z'),
      }),
    ).toBe(false);
    expect(
      canEditPost({
        authorId: 'p1',
        personId: 'p2',
        status: 'PUBLISHED',
        publishedAt,
        now: new Date('2026-03-01T14:03:00Z'),
      }),
    ).toBe(false);
  });

  it('gives contextual moderators removal rights without granting them everywhere', () => {
    expect(
      canRemovePost({ authorId: 'p1', personId: 'p2', contextType: 'CLASS', viewerRole: 'CLASS_REP' }),
    ).toBe(true);
    expect(
      canRemovePost({ authorId: 'p1', personId: 'p2', contextType: 'COURSE', viewerRole: 'CLASS_REP' }),
    ).toBe(false);
    expect(canRemovePost({ authorId: 'p1', personId: 'p1', contextType: 'GLOBAL', viewerRole: 'NONE' })).toBe(true);
  });

  it('hides removed post bodies from ordinary readers but keeps them for moderation', () => {
    expect(removedPostView({ status: 'REMOVED', isModerator: false })).toEqual({
      bodyVisible: false,
      message: REMOVED_POST_MESSAGE,
    });
    expect(removedPostView({ status: 'REMOVED', isModerator: true }).bodyVisible).toBe(true);
    expect(removedPostView({ status: 'PUBLISHED', isModerator: false }).bodyVisible).toBe(true);
  });

  it('keeps one active reaction per person per post', () => {
    expect(applyReaction({ existing: null, requested: 'LIKE' })).toEqual({
      reaction: 'LIKE',
      removedPrevious: null,
    });
    expect(applyReaction({ existing: 'LIKE', requested: 'LOVE' })).toEqual({
      reaction: 'LOVE',
      removedPrevious: 'LIKE',
    });
    expect(applyReaction({ existing: 'LIKE', requested: 'LIKE' })).toEqual({
      reaction: null,
      removedPrevious: 'LIKE',
    });
  });

  it('flattens comment nesting beyond replies', () => {
    expect(commentDisplayDepth(0)).toBe(0);
    expect(commentDisplayDepth(1)).toBe(1);
    expect(commentDisplayDepth(4)).toBe(1);
    expect(commentParentFor({ parentDepth: 0, parentId: 'c1', parentRootId: null })).toBe('c1');
    expect(commentParentFor({ parentDepth: 1, parentId: 'c2', parentRootId: 'c1' })).toBe('c1');
  });

  it('validates mentions against privacy and blocking', () => {
    const base = { targetExists: true, targetMentionable: true, blockedEitherDirection: false, sharesContext: true };
    expect(mentionAllowed(base)).toBe(true);
    expect(mentionAllowed({ ...base, blockedEitherDirection: true })).toBe(false);
    expect(mentionAllowed({ ...base, targetMentionable: false })).toBe(false);
    expect(mentionAllowed({ ...base, sharesContext: false })).toBe(false);
  });

  it('never converts an announcement into a post and routes shares to canonical objects', () => {
    expect(feedEntryKindFor('ANNOUNCEMENT')).toBe('ANNOUNCEMENT');
    expect(feedEntryKindFor('ASSIGNMENT')).toBe('ASSESSMENT');
    expect(feedEntryKindFor('POST')).toBe('POST');
    expect(sharedObjectRoute('EVENT', 'evt_1')).toBe('/app/explore/event/evt_1');
    expect(sharedObjectRoute('SERVICE', 'svc_1')).toBe('/app/explore/service/svc_1');
  });

  it('keeps post bodies out of analytics', () => {
    expect(unsafeContentAnalyticsKeys({ postId: 'p1', contextType: 'CLASS' })).toEqual([]);
    expect(unsafeContentAnalyticsKeys({ postId: 'p1', body: 'hello' })).toEqual(['body']);
  });
});
