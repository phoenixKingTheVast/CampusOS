export type SettingsSection =
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'accessibility'
  | 'appearance'
  | 'language'
  | 'offline';

export type SettingsMutation =
  | 'CHANGE_PHONE_NUMBER'
  | 'CHANGE_USERNAME'
  | 'UPDATE_PRIVACY'
  | 'UPDATE_NOTIFICATIONS'
  | 'UPDATE_ACCESSIBILITY'
  | 'UPDATE_APPEARANCE'
  | 'UPDATE_LANGUAGE'
  | 'UPDATE_OFFLINE'
  | 'BLOCK_PERSON'
  | 'UNBLOCK_PERSON'
  | 'REVOKE_SESSION'
  | 'REVOKE_OTHER_SESSIONS'
  | 'REQUEST_DATA_EXPORT'
  | 'DEACTIVATE_ACCOUNT'
  | 'REACTIVATE_ACCOUNT'
  | 'REQUEST_ACCOUNT_DELETION'
  | 'CANCEL_ACCOUNT_DELETION';

const CLIENT_CACHEABLE: SettingsSection[] = ['accessibility', 'appearance', 'language', 'offline'];

const REAUTHENTICATION: Set<SettingsMutation> = new Set([
  'CHANGE_PHONE_NUMBER',
  'REVOKE_OTHER_SESSIONS',
  'REQUEST_DATA_EXPORT',
  'DEACTIVATE_ACCOUNT',
  'REQUEST_ACCOUNT_DELETION',
]);

const QUEUEABLE_OFFLINE: Set<SettingsMutation> = new Set([
  'UPDATE_ACCESSIBILITY',
  'UPDATE_APPEARANCE',
  'UPDATE_LANGUAGE',
  'UPDATE_OFFLINE',
]);

const AUDITED: Set<SettingsMutation> = new Set([
  'CHANGE_PHONE_NUMBER',
  'CHANGE_USERNAME',
  'UPDATE_PRIVACY',
  'BLOCK_PERSON',
  'UNBLOCK_PERSON',
  'REVOKE_SESSION',
  'REVOKE_OTHER_SESSIONS',
  'REQUEST_DATA_EXPORT',
  'DEACTIVATE_ACCOUNT',
  'REACTIVATE_ACCOUNT',
  'REQUEST_ACCOUNT_DELETION',
  'CANCEL_ACCOUNT_DELETION',
]);

export function isClientCacheable(section: SettingsSection): boolean {
  return CLIENT_CACHEABLE.includes(section);
}

export function isServerAuthoritative(section: SettingsSection): boolean {
  return !isClientCacheable(section);
}

export function requiresReauthentication(mutation: SettingsMutation): boolean {
  return REAUTHENTICATION.has(mutation);
}

export function canQueueOffline(mutation: SettingsMutation): boolean {
  return QUEUEABLE_OFFLINE.has(mutation);
}

export function isAudited(mutation: SettingsMutation): boolean {
  return AUDITED.has(mutation);
}

export type MessagingChannel =
  | 'DIRECT'
  | 'COURSE_ANNOUNCEMENT'
  | 'CLASS_ANNOUNCEMENT'
  | 'ORGANIZATION_ANNOUNCEMENT'
  | 'SERVICE_BOOKING'
  | 'SYSTEM';

const INSTITUTIONAL_CHANNELS: Set<MessagingChannel> = new Set([
  'COURSE_ANNOUNCEMENT',
  'CLASS_ANNOUNCEMENT',
  'ORGANIZATION_ANNOUNCEMENT',
  'SERVICE_BOOKING',
  'SYSTEM',
]);

export function isInstitutionalChannel(channel: MessagingChannel): boolean {
  return INSTITUTIONAL_CHANNELS.has(channel);
}

export type MessagingContext = {
  channel: MessagingChannel;
  whoCanMessage: string;
  blocked: boolean;
  connected: boolean;
  sameCampus: boolean;
  sharedContext: boolean;
  existingConversation: boolean;
};

export function messagingAllowed(context: MessagingContext): { allowed: boolean; reason?: string } {
  if (isInstitutionalChannel(context.channel)) {
    return { allowed: true };
  }
  if (context.blocked) {
    return { allowed: false, reason: 'You can no longer message this person.' };
  }
  switch (context.whoCanMessage) {
    case 'EVERYONE':
      return { allowed: true };
    case 'CAMPUS':
      return context.sameCampus
        ? { allowed: true }
        : { allowed: false, reason: 'This person only accepts messages from people at their campus.' };
    case 'CONNECTIONS':
      return context.connected
        ? { allowed: true }
        : { allowed: false, reason: 'This person only accepts messages from their connections.' };
    case 'CONTEXT_ONLY':
      return context.sharedContext
        ? { allowed: true }
        : { allowed: false, reason: 'This person only accepts messages from their classes and courses.' };
    case 'EXISTING_ONLY':
      return context.existingConversation
        ? { allowed: true }
        : { allowed: false, reason: 'This person is not accepting new conversations.' };
    case 'NOBODY':
      return { allowed: false, reason: 'This person is not accepting messages.' };
    default:
      return { allowed: false, reason: 'This person is not accepting messages.' };
  }
}

export type SocialCapability =
  | 'FOLLOW'
  | 'CONNECT'
  | 'DIRECT_MESSAGE'
  | 'PROFILE_INTERACTION'
  | 'SOCIAL_DISCOVERY';

export type InstitutionalRelationship =
  | 'CLASS_MEMBERSHIP'
  | 'COURSE_ENROLLMENT'
  | 'COURSE_PERSONNEL'
  | 'ORGANIZATION_MEMBERSHIP'
  | 'BOOKING'
  | 'VERIFICATION';

const BLOCK_SUPPRESSED: Set<SocialCapability> = new Set([
  'FOLLOW',
  'CONNECT',
  'DIRECT_MESSAGE',
  'PROFILE_INTERACTION',
  'SOCIAL_DISCOVERY',
]);

export function blockSuppresses(capability: SocialCapability): boolean {
  return BLOCK_SUPPRESSED.has(capability);
}

export function blockRemovesInstitutionalRelationship(_relationship: InstitutionalRelationship): boolean {
  return false;
}

export const ANALYTICS_FORBIDDEN_KEYS = [
  'phoneNumber',
  'phone',
  'registrationNumber',
  'accessToken',
  'refreshToken',
  'pushToken',
  'otp',
  'password',
  'messageBody',
  'body',
  'verificationEvidence',
  'evidenceFileId',
  'customerNote',
  'providerNote',
  'internalNote',
];

export function unsafeAnalyticsKeys(payload: Record<string, unknown>): string[] {
  const forbidden = new Set(ANALYTICS_FORBIDDEN_KEYS.map((key) => key.toLowerCase()));
  return Object.keys(payload).filter((key) => forbidden.has(key.toLowerCase()));
}
