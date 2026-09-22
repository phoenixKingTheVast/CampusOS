export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export function canEditMessage(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= MESSAGE_EDIT_WINDOW_MS;
}

/**
 * Conversation kinds whose participants are derived from domain membership
 * rather than stored in ConversationParticipant. Membership of the domain
 * object is the single source of truth for these.
 */
export const DERIVED_PARTICIPANT_KINDS = ['CLASS', 'COURSE', 'STUDY_GROUP', 'ORGANIZATION'];

export function hasDerivedParticipants(kind: string): boolean {
  return DERIVED_PARTICIPANT_KINDS.includes(kind);
}

export function directContextKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function messageNotificationType(kind: string): string {
  if (kind === 'DIRECT') return 'DIRECT_MESSAGE';
  if (kind === 'STUDY_GROUP') return 'STUDY_GROUP_MESSAGE';
  return 'GROUP_MESSAGE';
}

export function messagePreview(body: string, messageType: string, removedAt: Date | null): string {
  if (removedAt) {
    return 'Message removed';
  }
  if (messageType === 'SHARED_OBJECT') {
    return 'Shared an item';
  }
  if (messageType === 'FILE') {
    return 'Sent a file';
  }
  const text = body.trim().replace(/\s+/g, ' ');
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

/**
 * Explains why a derived conversation cannot simply be left: the person has to
 * leave the underlying class, course, organization or study group instead.
 */
export function leaveBlockedMessage(kind: string): string | null {
  switch (kind) {
    case 'CLASS':
      return 'You are in this conversation because you are in the class. Leave the class to leave this conversation.';
    case 'COURSE':
      return 'You are in this conversation because you are enrolled in the course.';
    case 'STUDY_GROUP':
      return 'Leave the study group to leave this conversation.';
    case 'ORGANIZATION':
      return 'Leave the organization to leave this conversation.';
    case 'DIRECT':
      return 'Direct conversations cannot be left. You can mute or block instead.';
    default:
      return null;
  }
}

export function conversationThreadId(kind: string, contextId?: string | null, conversationId?: string): string {
  if (kind === 'CLASS' && contextId) {
    return `campusos.class.${contextId}`;
  }
  if (kind === 'COURSE' && contextId) {
    return `campusos.course.${contextId}`;
  }
  if (kind === 'ORGANIZATION' && contextId) {
    return `campusos.organization.${contextId}`;
  }
  if (kind === 'STUDY_GROUP' && contextId) {
    return `campusos.study-group.${contextId}`;
  }
  if (kind === 'DIRECT' || kind === 'GROUP') {
    return `campusos.conversation.${conversationId}`;
  }
  return `campusos.conversation.${conversationId}`;
}
