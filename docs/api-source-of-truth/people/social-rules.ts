export const RESERVED_USERNAMES = new Set([
  'admin',
  'campusos',
  'uz',
  'support',
  'root',
  'system',
  'official',
  'university',
  'staff',
  'lecturer',
  'moderator',
  'security',
]);

export type PrivacySettingsView = {
  profileVisibility: string;
  findable: boolean;
  whoCanFollow: string;
  whoCanConnect: string;
  whoCanMessage: string;
  activityVisibility: string;
  followerVisibility: string;
  followingVisibility: string;
  connectionVisibility: string;
};

export const DEFAULT_PRIVACY: PrivacySettingsView = {
  profileVisibility: 'CAMPUS',
  findable: true,
  whoCanFollow: 'EVERYONE',
  whoCanConnect: 'CAMPUS',
  whoCanMessage: 'CONNECTIONS',
  activityVisibility: 'CAMPUS',
  followerVisibility: 'EVERYONE',
  followingVisibility: 'EVERYONE',
  connectionVisibility: 'CONNECTIONS',
};

export function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, '').toLowerCase();
}

export function usernameError(username: string): string | null {
  if (username.length < 3 || username.length > 24) {
    return 'Usernames must be 3–24 characters.';
  }
  if (!/^[a-z0-9][a-z0-9._]*[a-z0-9]$/.test(username)) {
    return 'Usernames can use letters, numbers, periods and underscores.';
  }
  if (RESERVED_USERNAMES.has(username)) {
    return 'That username is reserved.';
  }
  return null;
}

export function canonicalPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export type AudienceContext = {
  sameCampus: boolean;
  connected: boolean;
  sameContext: boolean;
  self: boolean;
};

export function audienceAllows(audience: string, context: AudienceContext): boolean {
  if (context.self) {
    return true;
  }
  switch (audience) {
    case 'EVERYONE':
      return true;
    case 'CAMPUS':
      return context.sameCampus;
    case 'CONNECTIONS':
      return context.connected;
    case 'CONTEXT_ONLY':
      return context.sameContext;
    case 'ONLY_ME':
      return false;
    default:
      return context.sameCampus;
  }
}

export function isBlocked(blocks: Array<{ blockerId: string; blockedId: string }>, a: string, b: string): boolean {
  return blocks.some(
    (row) =>
      (row.blockerId === a && row.blockedId === b) || (row.blockerId === b && row.blockedId === a),
  );
}

export function canAppearInPeopleSearch(input: {
  targetId: string;
  viewerId: string;
  findable: boolean;
  blocked: boolean;
}): boolean {
  if (input.targetId === input.viewerId) {
    return true;
  }
  if (input.blocked) {
    return false;
  }
  return input.findable;
}

/**
 * In the MVP there is a single campus, so every verified person with a live
 * account counts as a campus peer of every other one.
 */
export function sameCampusAs(viewerAccountState: string, targetAccountState: string): boolean {
  return viewerAccountState === 'ACTIVE' && targetAccountState === 'ACTIVE';
}

export type FollowState = 'NONE' | 'FOLLOWING' | 'FOLLOWED_BY' | 'MUTUAL';

export function followState(input: {
  viewerFollowsTarget: boolean;
  targetFollowsViewer: boolean;
}): FollowState {
  if (input.viewerFollowsTarget && input.targetFollowsViewer) {
    return 'MUTUAL';
  }
  if (input.viewerFollowsTarget) {
    return 'FOLLOWING';
  }
  if (input.targetFollowsViewer) {
    return 'FOLLOWED_BY';
  }
  return 'NONE';
}

export type ConnectionState = 'NONE' | 'REQUESTED_BY_ME' | 'REQUESTED_BY_THEM' | 'CONNECTED';

export function connectionState(
  viewerId: string,
  row: { requesterId: string; addresseeId: string; status: string } | null,
): ConnectionState {
  if (!row) {
    return 'NONE';
  }
  if (row.status === 'ACCEPTED') {
    return 'CONNECTED';
  }
  if (row.status !== 'REQUESTED') {
    return 'NONE';
  }
  return row.requesterId === viewerId ? 'REQUESTED_BY_ME' : 'REQUESTED_BY_THEM';
}

export type MessagingPolicy = { canMessage: boolean; reason: string | null };

export function messagingPolicy(input: {
  whoCanMessage: string;
  context: AudienceContext;
  blocked: boolean;
}): MessagingPolicy {
  if (input.context.self) {
    return { canMessage: false, reason: "You can't message yourself." };
  }
  if (input.blocked) {
    return { canMessage: false, reason: 'This profile is no longer available.' };
  }
  if (audienceAllows(input.whoCanMessage, input.context)) {
    return { canMessage: true, reason: null };
  }
  switch (input.whoCanMessage) {
    case 'ONLY_ME':
      return { canMessage: false, reason: "This person isn't accepting messages." };
    case 'CONNECTIONS':
      return { canMessage: false, reason: 'Only their connections can message them.' };
    case 'CONTEXT_ONLY':
      return {
        canMessage: false,
        reason: 'Only people who share a class, course or group with them can message them.',
      };
    default:
      return { canMessage: false, reason: 'Only people on campus can message them.' };
  }
}

export type ProfileAction =
  | 'FOLLOW'
  | 'UNFOLLOW'
  | 'CONNECT'
  | 'ACCEPT_CONNECTION'
  | 'CANCEL_CONNECTION_REQUEST'
  | 'REMOVE_CONNECTION'
  | 'MESSAGE'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'REPORT'
  | 'EDIT_PROFILE';

/**
 * Advisory only. The client uses this to decide which buttons to draw; every
 * mutation endpoint re-derives the same decision from the database before it
 * writes anything.
 */
export function profileActions(input: {
  self: boolean;
  blockedByMe: boolean;
  follow: FollowState;
  connection: ConnectionState;
  canFollow: boolean;
  canConnect: boolean;
  canMessage: boolean;
}): ProfileAction[] {
  if (input.self) {
    return ['EDIT_PROFILE'];
  }
  if (input.blockedByMe) {
    return ['UNBLOCK', 'REPORT'];
  }
  const actions: ProfileAction[] = [];
  if (input.follow === 'FOLLOWING' || input.follow === 'MUTUAL') {
    actions.push('UNFOLLOW');
  } else if (input.canFollow) {
    actions.push('FOLLOW');
  }
  switch (input.connection) {
    case 'CONNECTED':
      actions.push('REMOVE_CONNECTION');
      break;
    case 'REQUESTED_BY_ME':
      actions.push('CANCEL_CONNECTION_REQUEST');
      break;
    case 'REQUESTED_BY_THEM':
      actions.push('ACCEPT_CONNECTION');
      break;
    default:
      if (input.canConnect) {
        actions.push('CONNECT');
      }
  }
  if (input.canMessage) {
    actions.push('MESSAGE');
  }
  actions.push('BLOCK', 'REPORT');
  return actions;
}

export type SocialList = 'FOLLOWERS' | 'FOLLOWING' | 'CONNECTIONS';

export function listHiddenMessage(list: SocialList): string {
  switch (list) {
    case 'FOLLOWERS':
      return "Followers aren't visible.";
    case 'FOLLOWING':
      return "Following isn't visible.";
    default:
      return "Connections aren't visible.";
  }
}

export const AUDIENCE_OPTIONS: Record<string, readonly string[]> = {
  profileVisibility: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'CONTEXT_ONLY', 'ONLY_ME'],
  activityVisibility: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'CONTEXT_ONLY', 'ONLY_ME'],
  whoCanFollow: ['EVERYONE', 'CAMPUS', 'CONNECTIONS'],
  whoCanConnect: ['EVERYONE', 'CAMPUS', 'CONTEXT_ONLY'],
  whoCanMessage: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'CONTEXT_ONLY', 'ONLY_ME'],
  followerVisibility: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'ONLY_ME'],
  followingVisibility: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'ONLY_ME'],
  connectionVisibility: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'ONLY_ME'],
};

const AUDIENCE_FIELD_LABELS: Record<string, string> = {
  profileVisibility: 'who can see your profile',
  activityVisibility: 'who can see your activity',
  whoCanFollow: 'who can follow you',
  whoCanConnect: 'who can connect with you',
  whoCanMessage: 'who can message you',
  followerVisibility: 'who can see your followers',
  followingVisibility: 'who can see who you follow',
  connectionVisibility: 'who can see your connections',
};

export function privacyAudienceError(field: string, value: string): string | null {
  const allowed = AUDIENCE_OPTIONS[field];
  if (!allowed) {
    return 'That privacy setting cannot be changed.';
  }
  if (!allowed.includes(value)) {
    return `Choose a valid option for ${AUDIENCE_FIELD_LABELS[field] ?? field}.`;
  }
  return null;
}

/**
 * Object ids that both people belong to. Used to derive the shared class,
 * course, organization and study group context shown on a profile. When the
 * viewer is the target this returns their own memberships, which is the
 * correct intersection of a set with itself.
 */
export function sharedObjectIds(
  rows: Array<{ personId: string; objectId: string }>,
  viewerId: string,
  targetId: string,
): string[] {
  const viewerIds = new Set(rows.filter((row) => row.personId === viewerId).map((row) => row.objectId));
  const targetIds = new Set(rows.filter((row) => row.personId === targetId).map((row) => row.objectId));
  const shared: string[] = [];
  for (const id of viewerIds) {
    if (targetIds.has(id)) {
      shared.push(id);
    }
  }
  return shared;
}
