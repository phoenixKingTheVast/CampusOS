export type NotificationCategory =
  | 'ACADEMIC'
  | 'SOCIAL'
  | 'ORGANIZATION'
  | 'CLASS'
  | 'SERVICE'
  | 'SYSTEM';

export type NotificationPreferences = {
  directMessages: boolean;
  mentions: boolean;
  groupMessages: boolean;
  academicImportant: boolean;
  assignments: boolean;
  resources: boolean;
  classUpdates: boolean;
  organizationEvents: boolean;
  organizationPosts: boolean;
  serviceUpdates: boolean;
  follows: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  directMessages: true,
  mentions: true,
  groupMessages: true,
  academicImportant: true,
  assignments: true,
  resources: true,
  classUpdates: true,
  organizationEvents: true,
  organizationPosts: true,
  serviceUpdates: true,
  follows: true,
};

const SYSTEM_TYPES = new Set([
  'OTP',
  'VERIFICATION_RESULT',
  'ACCOUNT_SECURITY',
  'MODERATION_DECISION',
  'SYSTEM_MAINTENANCE',
  'CRITICAL_ACCOUNT',
  'CLASS_MEMBERSHIP',
]);

export function preferenceAllows(
  type: string,
  category: NotificationCategory,
  prefs: NotificationPreferences,
): boolean {
  if (category === 'SYSTEM' || SYSTEM_TYPES.has(type) || type === 'CONNECTION_REQUEST' || type === 'CONNECTION_ACCEPTED') {
    return true;
  }
  if (type === 'DIRECT_MESSAGE') return prefs.directMessages;
  if (type === 'MENTION' || type === 'STUDY_GROUP_MENTION') return prefs.mentions;
  if (
    type === 'GROUP_MESSAGE' ||
    type === 'COURSE_MESSAGE' ||
    type === 'CLASS_MESSAGE' ||
    type === 'STUDY_GROUP_MESSAGE'
  ) {
    return prefs.groupMessages;
  }
  if (type === 'STUDY_GROUP_INVITATION' || type === 'STUDY_GROUP_JOIN_REQUEST' || type === 'STUDY_GROUP_JOIN_APPROVED') {
    return true;
  }
  if (type === 'STUDY_GROUP_POST' || type === 'STUDY_GROUP_RESOURCE' || type === 'STUDY_GROUP_ACTIVITY') {
    return prefs.resources;
  }
  if (type === 'ASSIGNMENT_REMINDER' || type === 'ASSIGNMENT_CHANGED' || type === 'TEST_REMINDER' || type === 'EXAM_REMINDER') {
    return prefs.assignments;
  }
  if (type === 'RESOURCE_PUBLISHED') return prefs.resources;
  if (type === 'COURSE_ANNOUNCEMENT' || type === 'IMPORTANT_ANNOUNCEMENT') return prefs.academicImportant;
  if (category === 'CLASS') return prefs.classUpdates;
  if (type === 'ORGANIZATION_EVENT' || type === 'EVENT_PUBLISHED' || type === 'EVENT_CHANGED') return prefs.organizationEvents;
  if (type === 'ORGANIZATION_POST' || type === 'ORGANIZATION_ANNOUNCEMENT') return prefs.organizationPosts;
  if (category === 'SERVICE') return prefs.serviceUpdates;
  if (type === 'FOLLOW') return prefs.follows;
  return true;
}

export function inQuietHours(now: Date, start?: string | null, end?: string | null, timezoneOffsetMinutes = 120): boolean {
  if (!start || !end) {
    return false;
  }
  const local = new Date(now.getTime() + timezoneOffsetMinutes * 60_000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const from = parseHm(start);
  const to = parseHm(end);
  if (from == null || to == null) {
    return false;
  }
  if (from === to) {
    return false;
  }
  if (from < to) {
    return minutes >= from && minutes < to;
  }
  return minutes >= from || minutes < to;
}

export function quietHoursSuppressPush(priority: string, now: Date, start?: string | null, end?: string | null): boolean {
  if (priority === 'CRITICAL') {
    return false;
  }
  return inQuietHours(now, start, end);
}

export function notificationDeepLink(input: {
  sourceType: string;
  sourceId: string;
  announcementId?: string | null;
  resourceId?: string | null;
  deepLink?: string | null;
}): string {
  if (input.deepLink) {
    return input.deepLink;
  }
  if (input.announcementId) {
    return `/app/learn/announcement/${input.announcementId}`;
  }
  if (input.resourceId) {
    return `/app/learn/resource/${input.resourceId}`;
  }
  switch (input.sourceType) {
    case 'ASSESSMENT':
      return `/app/learn/assignment/${input.sourceId}`;
    case 'EVENT':
      return `/app/explore/event/${input.sourceId}`;
    case 'CONVERSATION':
      return `/app/messages/${input.sourceId}`;
    case 'CLASS':
      return `/app/class/${input.sourceId}`;
    case 'ORGANIZATION':
    case 'ORGANIZATION_POST':
      return `/app/explore/organization/${input.sourceId}`;
    case 'PERSON':
    case 'CONNECTION':
    case 'FOLLOW':
      return `/app/profile/${input.sourceId}`;
    case 'RESOURCE':
      return `/app/learn/resource/${input.sourceId}`;
    case 'ANNOUNCEMENT':
      return `/app/learn/announcement/${input.sourceId}`;
    case 'BOOKING':
      return `/app/services/bookings/${input.sourceId}`;
    case 'SERVICE':
      return `/app/explore/service/${input.sourceId}`;
    case 'STUDY_GROUP':
      return `/app/learn/study-group/${input.sourceId}`;
    default:
      return '/app/notifications';
  }
}

export function notificationIdempotencyKey(sourceEventId: string, recipientId: string, type: string): string {
  return `${sourceEventId}:${recipientId}:${type}`;
}

function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}
