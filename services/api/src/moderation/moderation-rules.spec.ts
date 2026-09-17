import {
  canTransitionCase,
  canTransitionReport,
  decisionAvailableTo,
  decisionRequiresApproval,
  evidenceReadable,
  messageEvidenceScope,
} from './moderation-rules';

const MODERATOR_ONLY = {
  canRestrictUser: false,
  canSuspendUser: false,
  canSuspendProvider: false,
  canSuspendOrganization: false,
};

describe('moderation rules', () => {
  it('enforces the report state machine', () => {
    expect(canTransitionReport('SUBMITTED', 'TRIAGED')).toBe(true);
    expect(canTransitionReport('SUBMITTED', 'RESOLVED')).toBe(false);
    expect(canTransitionReport('RESOLVED', 'UNDER_REVIEW')).toBe(false);
  });

  it('enforces the case state machine', () => {
    expect(canTransitionCase('ASSIGNED', 'UNDER_REVIEW')).toBe(true);
    expect(canTransitionCase('OPEN', 'AWAITING_APPROVAL')).toBe(false);
  });

  it('separates content removal from account suspension', () => {
    expect(decisionAvailableTo('REMOVE_CONTENT', MODERATOR_ONLY)).toBe(true);
    expect(decisionAvailableTo('SUSPEND_USER', MODERATOR_ONLY)).toBe(false);
    expect(decisionAvailableTo('SUSPEND_USER', { ...MODERATOR_ONLY, canSuspendUser: true })).toBe(true);
    expect(decisionRequiresApproval('SUSPEND_USER')).toBe(true);
    expect(decisionRequiresApproval('REMOVE_CONTENT')).toBe(false);
  });

  it('limits message evidence to a bounded window around the reported message', () => {
    const conversationMessageIds = Array.from({ length: 40 }, (_, index) => `msg_${index}`);
    const scope = messageEvidenceScope({
      conversationId: 'conv_1',
      reportedMessageId: 'msg_20',
      conversationMessageIds,
    });
    expect(scope.messageIds).toHaveLength(11);
    expect(scope.messageIds[0]).toBe('msg_15');
    expect(scope.messageIds.at(-1)).toBe('msg_25');
    expect(evidenceReadable({ scope, conversationId: 'conv_1', messageId: 'msg_18' })).toBe(true);
    expect(evidenceReadable({ scope, conversationId: 'conv_1', messageId: 'msg_2' })).toBe(false);
  });

  it('never exposes messages from an unrelated conversation', () => {
    const scope = messageEvidenceScope({
      conversationId: 'conv_1',
      reportedMessageId: 'msg_2',
      conversationMessageIds: ['msg_1', 'msg_2', 'msg_3'],
    });
    expect(evidenceReadable({ scope, conversationId: 'conv_other', messageId: 'msg_2' })).toBe(false);
  });

  it('falls back to the single reported message when the surrounding thread is unavailable', () => {
    const scope = messageEvidenceScope({
      conversationId: 'conv_1',
      reportedMessageId: 'msg_missing',
      conversationMessageIds: ['msg_1', 'msg_2'],
    });
    expect(scope.messageIds).toEqual(['msg_missing']);
  });
});
