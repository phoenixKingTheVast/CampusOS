import {
  canEditMessage,
  directContextKey,
  hasDerivedParticipants,
  leaveBlockedMessage,
  conversationThreadId,
  MESSAGE_EDIT_WINDOW_MS,
  messageNotificationType,
  messagePreview,
} from './messaging-rules';

describe('canEditMessage', () => {
  const now = new Date('2026-09-16T12:00:00.000Z');

  it('allows editing inside the 15 minute window', () => {
    expect(canEditMessage(new Date(now.getTime() - 60_000), now)).toBe(true);
    expect(canEditMessage(new Date(now.getTime() - MESSAGE_EDIT_WINDOW_MS), now)).toBe(true);
  });

  it('refuses editing once the window has passed', () => {
    expect(canEditMessage(new Date(now.getTime() - MESSAGE_EDIT_WINDOW_MS - 1), now)).toBe(false);
  });
});

describe('derived participants', () => {
  it('derives membership for domain-backed conversations', () => {
    expect(hasDerivedParticipants('CLASS')).toBe(true);
    expect(hasDerivedParticipants('COURSE')).toBe(true);
    expect(hasDerivedParticipants('STUDY_GROUP')).toBe(true);
    expect(hasDerivedParticipants('ORGANIZATION')).toBe(true);
  });

  it('stores participants for direct, group and service conversations', () => {
    expect(hasDerivedParticipants('DIRECT')).toBe(false);
    expect(hasDerivedParticipants('GROUP')).toBe(false);
    expect(hasDerivedParticipants('SERVICE')).toBe(false);
  });
});

describe('directContextKey', () => {
  it('is stable regardless of argument order', () => {
    expect(directContextKey('person_b', 'person_a')).toBe('person_a:person_b');
    expect(directContextKey('person_a', 'person_b')).toBe('person_a:person_b');
  });
});

describe('messageNotificationType', () => {
  it('separates direct messages from every group context', () => {
    expect(messageNotificationType('DIRECT')).toBe('DIRECT_MESSAGE');
    expect(messageNotificationType('CLASS')).toBe('GROUP_MESSAGE');
    expect(messageNotificationType('SERVICE')).toBe('GROUP_MESSAGE');
    expect(messageNotificationType('STUDY_GROUP')).toBe('STUDY_GROUP_MESSAGE');
  });
});

describe('messagePreview', () => {
  it('hides the body of removed messages', () => {
    expect(messagePreview('secret', 'TEXT', new Date())).toBe('Message removed');
  });

  it('collapses whitespace and truncates long bodies', () => {
    expect(messagePreview('hello   there\nfriend', 'TEXT', null)).toBe('hello there friend');
    expect(messagePreview('a'.repeat(400), 'TEXT', null)).toHaveLength(140);
  });

  it('describes non-text messages', () => {
    expect(messagePreview('', 'FILE', null)).toBe('Sent a file');
    expect(messagePreview('', 'SHARED_OBJECT', null)).toBe('Shared an item');
  });
});

describe('leaveBlockedMessage', () => {
  it('points at the domain object for derived conversations', () => {
    expect(leaveBlockedMessage('CLASS')).toContain('Leave the class');
    expect(leaveBlockedMessage('ORGANIZATION')).toContain('Leave the organization');
    expect(leaveBlockedMessage('STUDY_GROUP')).toContain('Leave the study group');
    expect(leaveBlockedMessage('GROUP')).toBeNull();
  });
});

describe('conversationThreadId', () => {
  it('keys study-group threads on the group, not a duplicate conversation', () => {
    expect(conversationThreadId('STUDY_GROUP', 'sg_pe', 'conv_other')).toBe('campusos.study-group.sg_pe');
  });
});
