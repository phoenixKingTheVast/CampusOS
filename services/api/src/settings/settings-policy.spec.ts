import {
  MessagingChannel,
  SettingsMutation,
  blockRemovesInstitutionalRelationship,
  blockSuppresses,
  canQueueOffline,
  isServerAuthoritative,
  messagingAllowed,
  requiresReauthentication,
  unsafeAnalyticsKeys,
} from './settings-policy';

const BASE = {
  whoCanMessage: 'CONNECTIONS',
  blocked: false,
  connected: false,
  sameCampus: true,
  sharedContext: true,
  existingConversation: false,
};

describe('settings policy', () => {
  it('keeps privacy, notifications and account settings server-authoritative', () => {
    expect(isServerAuthoritative('privacy')).toBe(true);
    expect(isServerAuthoritative('account')).toBe(true);
    expect(isServerAuthoritative('notifications')).toBe(true);
    expect(isServerAuthoritative('appearance')).toBe(false);
    expect(isServerAuthoritative('language')).toBe(false);
  });

  it('only lets harmless preferences be queued offline', () => {
    const sensitive: SettingsMutation[] = [
      'UPDATE_PRIVACY',
      'BLOCK_PERSON',
      'REVOKE_SESSION',
      'REQUEST_ACCOUNT_DELETION',
      'CHANGE_PHONE_NUMBER',
    ];
    for (const mutation of sensitive) {
      expect(canQueueOffline(mutation)).toBe(false);
    }
    expect(canQueueOffline('UPDATE_APPEARANCE')).toBe(true);
    expect(canQueueOffline('UPDATE_ACCESSIBILITY')).toBe(true);
  });

  it('requires re-authentication before destructive account actions', () => {
    expect(requiresReauthentication('REQUEST_ACCOUNT_DELETION')).toBe(true);
    expect(requiresReauthentication('DEACTIVATE_ACCOUNT')).toBe(true);
    expect(requiresReauthentication('CHANGE_PHONE_NUMBER')).toBe(true);
    expect(requiresReauthentication('REVOKE_OTHER_SESSIONS')).toBe(true);
    expect(requiresReauthentication('UPDATE_APPEARANCE')).toBe(false);
  });

  it('never lets a messaging privacy setting suppress institutional communication', () => {
    const institutional: MessagingChannel[] = [
      'COURSE_ANNOUNCEMENT',
      'CLASS_ANNOUNCEMENT',
      'ORGANIZATION_ANNOUNCEMENT',
      'SERVICE_BOOKING',
      'SYSTEM',
    ];
    for (const channel of institutional) {
      expect(
        messagingAllowed({ ...BASE, channel, whoCanMessage: 'NOBODY', blocked: true }).allowed,
      ).toBe(true);
    }
  });

  it('applies messaging privacy to ordinary direct messages', () => {
    expect(messagingAllowed({ ...BASE, channel: 'DIRECT' }).allowed).toBe(false);
    expect(messagingAllowed({ ...BASE, channel: 'DIRECT', connected: true }).allowed).toBe(true);
    expect(
      messagingAllowed({ ...BASE, channel: 'DIRECT', whoCanMessage: 'EVERYONE', blocked: true }).allowed,
    ).toBe(false);
    expect(
      messagingAllowed({ ...BASE, channel: 'DIRECT', whoCanMessage: 'EXISTING_ONLY', existingConversation: true })
        .allowed,
    ).toBe(true);
  });

  it('suppresses social capabilities on block but keeps institutional relationships intact', () => {
    expect(blockSuppresses('DIRECT_MESSAGE')).toBe(true);
    expect(blockSuppresses('FOLLOW')).toBe(true);
    expect(blockSuppresses('SOCIAL_DISCOVERY')).toBe(true);
    expect(blockRemovesInstitutionalRelationship('CLASS_MEMBERSHIP')).toBe(false);
    expect(blockRemovesInstitutionalRelationship('COURSE_ENROLLMENT')).toBe(false);
    expect(blockRemovesInstitutionalRelationship('BOOKING')).toBe(false);
  });

  it('rejects analytics payloads carrying sensitive fields', () => {
    expect(
      unsafeAnalyticsKeys({ event: 'settings_opened', section: 'privacy' }),
    ).toEqual([]);
    expect(
      unsafeAnalyticsKeys({ event: 'blocked_person_added', phoneNumber: '+263771234567' }),
    ).toEqual(['phoneNumber']);
    expect(unsafeAnalyticsKeys({ RegistrationNumber: 'R123456' })).toEqual(['RegistrationNumber']);
  });
});
