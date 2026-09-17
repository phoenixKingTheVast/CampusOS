import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  inQuietHours,
  notificationDeepLink,
  notificationIdempotencyKey,
  preferenceAllows,
  quietHoursSuppressPush,
} from './notification-rules';

const prefs = (overrides: Partial<typeof DEFAULT_NOTIFICATION_PREFERENCES> = {}) => ({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...overrides,
});

describe('preferenceAllows', () => {
  it('honours the message preferences', () => {
    expect(preferenceAllows('DIRECT_MESSAGE', 'SOCIAL', prefs({ directMessages: false }))).toBe(false);
    expect(preferenceAllows('GROUP_MESSAGE', 'SOCIAL', prefs({ groupMessages: false }))).toBe(false);
    expect(preferenceAllows('STUDY_GROUP_MESSAGE', 'SOCIAL', prefs({ groupMessages: false }))).toBe(false);
    expect(preferenceAllows('STUDY_GROUP_MENTION', 'SOCIAL', prefs({ mentions: false }))).toBe(false);
    expect(preferenceAllows('STUDY_GROUP_INVITATION', 'SOCIAL', prefs({ groupMessages: false }))).toBe(true);
    expect(preferenceAllows('MENTION', 'SOCIAL', prefs({ mentions: false }))).toBe(false);
    expect(preferenceAllows('DIRECT_MESSAGE', 'SOCIAL', prefs({ groupMessages: false }))).toBe(true);
  });

  it('honours the academic and service preferences', () => {
    expect(preferenceAllows('ASSIGNMENT_REMINDER', 'ACADEMIC', prefs({ assignments: false }))).toBe(false);
    expect(preferenceAllows('RESOURCE_PUBLISHED', 'ACADEMIC', prefs({ resources: false }))).toBe(false);
    expect(preferenceAllows('COURSE_ANNOUNCEMENT', 'ACADEMIC', prefs({ academicImportant: false }))).toBe(false);
    expect(preferenceAllows('BOOKING_CONFIRMED', 'SERVICE', prefs({ serviceUpdates: false }))).toBe(false);
    expect(preferenceAllows('BOOKING_CONFIRMED', 'SERVICE', prefs())).toBe(true);
  });

  it('honours the follow preference but never suppresses connection requests', () => {
    expect(preferenceAllows('FOLLOW', 'SOCIAL', prefs({ follows: false }))).toBe(false);
    expect(preferenceAllows('CONNECTION_REQUEST', 'SOCIAL', prefs({ follows: false }))).toBe(true);
    expect(preferenceAllows('CONNECTION_ACCEPTED', 'SOCIAL', prefs({ follows: false }))).toBe(true);
  });

  it('never suppresses system or account-critical notifications', () => {
    expect(preferenceAllows('ACCOUNT_SECURITY', 'SYSTEM', prefs({ classUpdates: false }))).toBe(true);
    expect(preferenceAllows('CLASS_MEMBERSHIP', 'CLASS', prefs({ classUpdates: false }))).toBe(true);
    expect(preferenceAllows('MODERATION_DECISION', 'SYSTEM', prefs())).toBe(true);
  });

  it('suppresses ordinary class updates when the preference is off', () => {
    expect(preferenceAllows('CLASS_UPDATE', 'CLASS', prefs({ classUpdates: false }))).toBe(false);
  });
});

describe('quiet hours', () => {
  const at = (hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 8, 16, hour - 2, minute)); // local UTC+2

  it('detects an overnight window that wraps midnight', () => {
    expect(inQuietHours(at(23), '22:00', '07:00')).toBe(true);
    expect(inQuietHours(at(3), '22:00', '07:00')).toBe(true);
    expect(inQuietHours(at(9), '22:00', '07:00')).toBe(false);
  });

  it('detects a same-day window', () => {
    expect(inQuietHours(at(14), '13:00', '15:00')).toBe(true);
    expect(inQuietHours(at(16), '13:00', '15:00')).toBe(false);
  });

  it('treats absent, equal or malformed bounds as no quiet hours', () => {
    expect(inQuietHours(at(23), null, '07:00')).toBe(false);
    expect(inQuietHours(at(23), '22:00', null)).toBe(false);
    expect(inQuietHours(at(23), '22:00', '22:00')).toBe(false);
    expect(inQuietHours(at(23), 'bedtime', '07:00')).toBe(false);
    expect(inQuietHours(at(23), '25:00', '07:00')).toBe(false);
  });

  it('suppresses push inside quiet hours unless the notification is critical', () => {
    expect(quietHoursSuppressPush('NORMAL', at(23), '22:00', '07:00')).toBe(true);
    expect(quietHoursSuppressPush('HIGH', at(23), '22:00', '07:00')).toBe(true);
    expect(quietHoursSuppressPush('CRITICAL', at(23), '22:00', '07:00')).toBe(false);
    expect(quietHoursSuppressPush('NORMAL', at(9), '22:00', '07:00')).toBe(false);
  });
});

describe('notificationDeepLink', () => {
  it('prefers an explicit deep link, then the attached object', () => {
    expect(
      notificationDeepLink({ sourceType: 'BOOKING', sourceId: 'bkg_1', deepLink: '/app/services/bookings/bkg_1' }),
    ).toBe('/app/services/bookings/bkg_1');
    expect(notificationDeepLink({ sourceType: 'OTHER', sourceId: 'x', announcementId: 'ann_1' })).toBe(
      '/app/learn/announcement/ann_1',
    );
    expect(notificationDeepLink({ sourceType: 'OTHER', sourceId: 'x', resourceId: 'res_1' })).toBe(
      '/app/learn/resource/res_1',
    );
  });

  it('routes each known source type', () => {
    expect(notificationDeepLink({ sourceType: 'CONVERSATION', sourceId: 'conv_1' })).toBe('/app/messages/conv_1');
    expect(notificationDeepLink({ sourceType: 'EVENT', sourceId: 'event_1' })).toBe('/app/explore/event/event_1');
    expect(notificationDeepLink({ sourceType: 'PERSON', sourceId: 'person_1' })).toBe('/app/profile/person_1');
    expect(notificationDeepLink({ sourceType: 'BOOKING', sourceId: 'bkg_1' })).toBe(
      '/app/services/bookings/bkg_1',
    );
    expect(notificationDeepLink({ sourceType: 'SERVICE', sourceId: 'svc_1' })).toBe(
      '/app/explore/service/svc_1',
    );
    expect(notificationDeepLink({ sourceType: 'STUDY_GROUP', sourceId: 'sg_pe' })).toBe(
      '/app/learn/study-group/sg_pe',
    );
    expect(notificationDeepLink({ sourceType: 'MYSTERY', sourceId: 'x' })).toBe('/app/notifications');
  });
});

describe('notificationIdempotencyKey', () => {
  it('is unique per source event, recipient and type', () => {
    expect(notificationIdempotencyKey('msg_1', 'person_1', 'DIRECT_MESSAGE')).toBe(
      'msg_1:person_1:DIRECT_MESSAGE',
    );
    expect(notificationIdempotencyKey('msg_1', 'person_1', 'DIRECT_MESSAGE')).not.toBe(
      notificationIdempotencyKey('msg_1', 'person_2', 'DIRECT_MESSAGE'),
    );
  });
});
