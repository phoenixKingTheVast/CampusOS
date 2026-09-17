import {
  AUDIENCE_OPTIONS,
  AudienceContext,
  DEFAULT_PRIVACY,
  audienceAllows,
  canAppearInPeopleSearch,
  canonicalPair,
  connectionState,
  followState,
  isBlocked,
  listHiddenMessage,
  messagingPolicy,
  normalizeUsername,
  privacyAudienceError,
  profileActions,
  sameCampusAs,
  sharedObjectIds,
  usernameError,
} from './social-rules';

const STRANGER: AudienceContext = {
  self: false,
  sameCampus: true,
  connected: false,
  sameContext: false,
};

describe('canonicalPair', () => {
  it('orders a pair the same way whichever argument comes first', () => {
    const forward = canonicalPair('per_alpha', 'per_beta');
    const reverse = canonicalPair('per_beta', 'per_alpha');
    expect(forward).toEqual(reverse);
  });

  it('always puts the lower id first', () => {
    for (const [a, b] of [
      ['per_alpha', 'per_beta'],
      ['per_beta', 'per_alpha'],
      ['per_zulu', 'per_alpha'],
      ['per_0001', 'per_9999'],
    ]) {
      const pair = canonicalPair(a, b);
      expect(pair.low < pair.high).toBe(true);
      expect([pair.low, pair.high].sort()).toEqual([a, b].sort());
    }
  });

  it('is stable for a person paired with themselves', () => {
    expect(canonicalPair('per_self', 'per_self')).toEqual({ low: 'per_self', high: 'per_self' });
  });
});

describe('audienceAllows', () => {
  it('admits everyone for EVERYONE', () => {
    expect(
      audienceAllows('EVERYONE', { ...STRANGER, sameCampus: false }),
    ).toBe(true);
  });

  it('admits campus peers only for CAMPUS', () => {
    expect(audienceAllows('CAMPUS', STRANGER)).toBe(true);
    expect(audienceAllows('CAMPUS', { ...STRANGER, sameCampus: false })).toBe(false);
  });

  it('admits connections only for CONNECTIONS', () => {
    expect(audienceAllows('CONNECTIONS', STRANGER)).toBe(false);
    expect(audienceAllows('CONNECTIONS', { ...STRANGER, connected: true })).toBe(true);
  });

  it('admits shared context only for CONTEXT_ONLY', () => {
    expect(audienceAllows('CONTEXT_ONLY', STRANGER)).toBe(false);
    expect(audienceAllows('CONTEXT_ONLY', { ...STRANGER, sameContext: true })).toBe(true);
  });

  it('admits nobody but the person themselves for ONLY_ME', () => {
    expect(audienceAllows('ONLY_ME', STRANGER)).toBe(false);
    expect(
      audienceAllows('ONLY_ME', {
        self: true,
        sameCampus: false,
        connected: false,
        sameContext: false,
      }),
    ).toBe(true);
  });

  it('always admits self, whatever the audience', () => {
    const self: AudienceContext = {
      self: true,
      sameCampus: false,
      connected: false,
      sameContext: false,
    };
    for (const audience of ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'CONTEXT_ONLY', 'ONLY_ME', 'NONSENSE']) {
      expect(audienceAllows(audience, self)).toBe(true);
    }
  });

  it('falls back to campus for an unknown audience', () => {
    expect(audienceAllows('SOMETHING_NEW', STRANGER)).toBe(true);
    expect(audienceAllows('SOMETHING_NEW', { ...STRANGER, sameCampus: false })).toBe(false);
  });
});

describe('sameCampusAs', () => {
  it('requires both accounts to be active', () => {
    expect(sameCampusAs('ACTIVE', 'ACTIVE')).toBe(true);
    expect(sameCampusAs('ACTIVE', 'SUSPENDED')).toBe(false);
    expect(sameCampusAs('STUDENT_VERIFICATION_PENDING', 'ACTIVE')).toBe(false);
  });
});

describe('usernameError', () => {
  it('accepts valid usernames', () => {
    for (const username of ['tino', 'tino.moyo', 'tino_moyo', 'a1b', 'n0.1_student']) {
      expect(usernameError(username)).toBeNull();
    }
  });

  it('rejects usernames that are too short or too long', () => {
    expect(usernameError('ab')).toBe('Usernames must be 3–24 characters.');
    expect(usernameError('a'.repeat(25))).toBe('Usernames must be 3–24 characters.');
    expect(usernameError('a'.repeat(24))).toBeNull();
  });

  it('rejects reserved usernames', () => {
    expect(usernameError('admin')).toBe('That username is reserved.');
    expect(usernameError('campusos')).toBe('That username is reserved.');
  });

  it('rejects badly punctuated usernames', () => {
    const punctuation = 'Usernames can use letters, numbers, periods and underscores.';
    expect(usernameError('.tino')).toBe(punctuation);
    expect(usernameError('tino.')).toBe(punctuation);
    expect(usernameError('_tino')).toBe(punctuation);
    expect(usernameError('tino moyo')).toBe(punctuation);
    expect(usernameError('tino-moyo')).toBe(punctuation);
    expect(usernameError('Tino')).toBe(punctuation);
  });

  it('pairs with normalizeUsername, which strips the @ and the case', () => {
    expect(normalizeUsername('  @Tino.Moyo ')).toBe('tino.moyo');
    expect(usernameError(normalizeUsername('@Tino.Moyo'))).toBeNull();
  });
});

describe('canAppearInPeopleSearch', () => {
  it('always lets the viewer find themselves', () => {
    expect(
      canAppearInPeopleSearch({
        targetId: 'per_me',
        viewerId: 'per_me',
        findable: false,
        blocked: true,
      }),
    ).toBe(true);
  });

  it('never surfaces someone involved in a block', () => {
    expect(
      canAppearInPeopleSearch({
        targetId: 'per_them',
        viewerId: 'per_me',
        findable: true,
        blocked: true,
      }),
    ).toBe(false);
  });

  it('excludes people who are not findable', () => {
    expect(
      canAppearInPeopleSearch({
        targetId: 'per_them',
        viewerId: 'per_me',
        findable: false,
        blocked: false,
      }),
    ).toBe(false);
  });

  it('surfaces findable people by default', () => {
    expect(
      canAppearInPeopleSearch({
        targetId: 'per_them',
        viewerId: 'per_me',
        findable: DEFAULT_PRIVACY.findable,
        blocked: false,
      }),
    ).toBe(true);
  });
});

describe('isBlocked', () => {
  const blocks = [{ blockerId: 'per_me', blockedId: 'per_them' }];

  it('is symmetric in its arguments', () => {
    expect(isBlocked(blocks, 'per_me', 'per_them')).toBe(true);
    expect(isBlocked(blocks, 'per_them', 'per_me')).toBe(true);
  });

  it('detects a block made in either direction', () => {
    const received = [{ blockerId: 'per_them', blockedId: 'per_me' }];
    expect(isBlocked(received, 'per_me', 'per_them')).toBe(true);
    expect(isBlocked(received, 'per_them', 'per_me')).toBe(true);
  });

  it('ignores blocks between other people', () => {
    expect(isBlocked(blocks, 'per_me', 'per_other')).toBe(false);
    expect(isBlocked([], 'per_me', 'per_them')).toBe(false);
  });
});

describe('followState', () => {
  it('names each of the four follow states', () => {
    expect(followState({ viewerFollowsTarget: false, targetFollowsViewer: false })).toBe('NONE');
    expect(followState({ viewerFollowsTarget: true, targetFollowsViewer: false })).toBe('FOLLOWING');
    expect(followState({ viewerFollowsTarget: false, targetFollowsViewer: true })).toBe('FOLLOWED_BY');
    expect(followState({ viewerFollowsTarget: true, targetFollowsViewer: true })).toBe('MUTUAL');
  });
});

describe('connectionState', () => {
  const row = (status: string, requesterId: string, addresseeId: string) => ({
    status,
    requesterId,
    addresseeId,
  });

  it('reports NONE when there is no row', () => {
    expect(connectionState('per_me', null)).toBe('NONE');
  });

  it('distinguishes the direction of a pending request', () => {
    expect(connectionState('per_me', row('REQUESTED', 'per_me', 'per_them'))).toBe('REQUESTED_BY_ME');
    expect(connectionState('per_me', row('REQUESTED', 'per_them', 'per_me'))).toBe(
      'REQUESTED_BY_THEM',
    );
  });

  it('reports CONNECTED regardless of who asked', () => {
    expect(connectionState('per_me', row('ACCEPTED', 'per_them', 'per_me'))).toBe('CONNECTED');
    expect(connectionState('per_me', row('ACCEPTED', 'per_me', 'per_them'))).toBe('CONNECTED');
  });

  it('treats a reusable terminal row as no connection', () => {
    for (const status of ['DECLINED', 'CANCELLED', 'REMOVED']) {
      expect(connectionState('per_me', row(status, 'per_me', 'per_them'))).toBe('NONE');
    }
  });
});

describe('messagingPolicy', () => {
  it('refuses messaging yourself', () => {
    const policy = messagingPolicy({
      whoCanMessage: 'EVERYONE',
      context: { ...STRANGER, self: true },
      blocked: false,
    });
    expect(policy.canMessage).toBe(false);
  });

  it('hides behind the standard copy when a block is involved', () => {
    const policy = messagingPolicy({
      whoCanMessage: 'EVERYONE',
      context: STRANGER,
      blocked: true,
    });
    expect(policy).toEqual({
      canMessage: false,
      reason: 'This profile is no longer available.',
    });
  });

  it('allows messaging when the audience admits the viewer', () => {
    expect(
      messagingPolicy({ whoCanMessage: 'CAMPUS', context: STRANGER, blocked: false }),
    ).toEqual({ canMessage: true, reason: null });
  });

  it('explains why messaging is closed', () => {
    expect(
      messagingPolicy({ whoCanMessage: 'CONNECTIONS', context: STRANGER, blocked: false }).reason,
    ).toBe('Only their connections can message them.');
    expect(
      messagingPolicy({ whoCanMessage: 'ONLY_ME', context: STRANGER, blocked: false }).reason,
    ).toBe("This person isn't accepting messages.");
    expect(
      messagingPolicy({ whoCanMessage: 'CONTEXT_ONLY', context: STRANGER, blocked: false }).reason,
    ).toBe('Only people who share a class, course or group with them can message them.');
  });
});

describe('profileActions', () => {
  const base = {
    self: false,
    blockedByMe: false,
    follow: 'NONE' as const,
    connection: 'NONE' as const,
    canFollow: true,
    canConnect: true,
    canMessage: true,
  };

  it('offers only editing on your own profile', () => {
    expect(profileActions({ ...base, self: true })).toEqual(['EDIT_PROFILE']);
  });

  it('offers only unblocking and reporting for someone you have blocked', () => {
    expect(profileActions({ ...base, blockedByMe: true })).toEqual(['UNBLOCK', 'REPORT']);
  });

  it('offers follow, connect and message to an eligible stranger', () => {
    expect(profileActions(base)).toEqual(['FOLLOW', 'CONNECT', 'MESSAGE', 'BLOCK', 'REPORT']);
  });

  it('omits actions the privacy settings do not allow', () => {
    expect(
      profileActions({ ...base, canFollow: false, canConnect: false, canMessage: false }),
    ).toEqual(['BLOCK', 'REPORT']);
  });

  it('replaces follow with unfollow once following', () => {
    expect(profileActions({ ...base, follow: 'MUTUAL' })).toContain('UNFOLLOW');
    expect(profileActions({ ...base, follow: 'FOLLOWING' })).not.toContain('FOLLOW');
    expect(profileActions({ ...base, follow: 'FOLLOWED_BY' })).toContain('FOLLOW');
  });

  it('matches the connection action to the connection state', () => {
    expect(profileActions({ ...base, connection: 'CONNECTED' })).toContain('REMOVE_CONNECTION');
    expect(profileActions({ ...base, connection: 'REQUESTED_BY_ME' })).toContain(
      'CANCEL_CONNECTION_REQUEST',
    );
    expect(profileActions({ ...base, connection: 'REQUESTED_BY_THEM' })).toContain(
      'ACCEPT_CONNECTION',
    );
    expect(profileActions({ ...base, connection: 'CONNECTED' })).not.toContain('CONNECT');
  });
});

describe('privacyAudienceError', () => {
  it('accepts every documented option for every field', () => {
    for (const [field, options] of Object.entries(AUDIENCE_OPTIONS)) {
      for (const option of options) {
        expect(privacyAudienceError(field, option)).toBeNull();
      }
    }
  });

  it('keeps the narrower fields narrow', () => {
    expect(privacyAudienceError('whoCanFollow', 'CONTEXT_ONLY')).not.toBeNull();
    expect(privacyAudienceError('whoCanFollow', 'ONLY_ME')).not.toBeNull();
    expect(privacyAudienceError('whoCanConnect', 'CONNECTIONS')).not.toBeNull();
    expect(privacyAudienceError('followerVisibility', 'CONTEXT_ONLY')).not.toBeNull();
  });

  it('rejects an unknown field and an unknown value', () => {
    expect(privacyAudienceError('somethingElse', 'EVERYONE')).toBe(
      'That privacy setting cannot be changed.',
    );
    expect(privacyAudienceError('profileVisibility', 'everyone')).toBe(
      'Choose a valid option for who can see your profile.',
    );
  });

  it('agrees with the defaults it guards', () => {
    for (const [field, value] of Object.entries(DEFAULT_PRIVACY)) {
      if (typeof value === 'string') {
        expect(privacyAudienceError(field, value)).toBeNull();
      }
    }
  });
});

describe('listHiddenMessage', () => {
  it('uses the right copy per list', () => {
    expect(listHiddenMessage('FOLLOWERS')).toBe("Followers aren't visible.");
    expect(listHiddenMessage('FOLLOWING')).toBe("Following isn't visible.");
    expect(listHiddenMessage('CONNECTIONS')).toBe("Connections aren't visible.");
  });
});

describe('sharedObjectIds', () => {
  const rows = [
    { personId: 'per_me', objectId: 'cls_1' },
    { personId: 'per_me', objectId: 'cls_2' },
    { personId: 'per_them', objectId: 'cls_2' },
    { personId: 'per_them', objectId: 'cls_3' },
  ];

  it('returns only the objects both people belong to', () => {
    expect(sharedObjectIds(rows, 'per_me', 'per_them')).toEqual(['cls_2']);
  });

  it('is symmetric', () => {
    expect(sharedObjectIds(rows, 'per_them', 'per_me')).toEqual(['cls_2']);
  });

  it('returns a person their own memberships when paired with themselves', () => {
    expect(sharedObjectIds(rows, 'per_me', 'per_me')).toEqual(['cls_1', 'cls_2']);
  });

  it('returns nothing when there is no overlap', () => {
    expect(sharedObjectIds(rows, 'per_me', 'per_nobody')).toEqual([]);
    expect(sharedObjectIds([], 'per_me', 'per_them')).toEqual([]);
  });
});
