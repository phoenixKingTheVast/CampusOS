export type SyncScope =
  | 'GLOBAL'
  | 'ACADEMIC'
  | 'MESSAGING'
  | 'CALENDAR'
  | 'ORGANIZATIONS'
  | 'SERVICES'
  | 'NOTIFICATIONS';

export type ChangeOperation = 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTRICT' | 'ACCESS_REVOKED';

export type PendingActionState = 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'REJECTED';

const PENDING_TRANSITIONS: Record<PendingActionState, PendingActionState[]> = {
  PENDING: ['SYNCING'],
  SYNCING: ['COMPLETED', 'FAILED', 'REJECTED'],
  FAILED: ['PENDING', 'SYNCING', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
};

export function canTransitionPendingAction(from: PendingActionState, to: PendingActionState): boolean {
  return PENDING_TRANSITIONS[from]?.includes(to) ?? false;
}

export type SyncErrorClass =
  | 'RETRYABLE'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'PERMANENT';

export function classifySyncError(input: { status?: number; code?: string }): SyncErrorClass {
  if (input.code === 'OFFLINE' || input.code === 'NETWORK_ERROR' || input.code === 'TIMEOUT') {
    return 'RETRYABLE';
  }
  const status = input.status;
  if (status === undefined) {
    return 'RETRYABLE';
  }
  if (status === 401) return 'AUTHENTICATION';
  if (status === 403) return 'AUTHORIZATION';
  if (status === 409) return 'CONFLICT';
  if (status === 400 || status === 422) return 'VALIDATION';
  if (status === 408 || status === 429 || status >= 500) return 'RETRYABLE';
  if (status === 404 || status === 410) return 'PERMANENT';
  return 'PERMANENT';
}

export type SyncActionType =
  | 'SEND_MESSAGE'
  | 'MARK_NOTIFICATION_READ'
  | 'MARK_CONVERSATION_READ'
  | 'CREATE_PERSONAL_ACTIVITY'
  | 'UPDATE_PERSONAL_ACTIVITY'
  | 'SAVE_RESOURCE_OFFLINE'
  | 'UPDATE_APPEARANCE'
  | 'UPDATE_ACCESSIBILITY'
  | 'UPDATE_LANGUAGE'
  | 'RSVP_EVENT'
  | 'CONFIRM_BOOKING'
  | 'CREATE_BOOKING'
  | 'CANCEL_BOOKING'
  | 'FOLLOW_PERSON'
  | 'CONNECT_PERSON'
  | 'BLOCK_PERSON'
  | 'UPDATE_PRIVACY'
  | 'REQUEST_CLASS_MEMBERSHIP'
  | 'APPROVE_CLASS_MEMBERSHIP'
  | 'SUBMIT_VERIFICATION'
  | 'ADMIN_ACTION';

const OFFLINE_ALLOWED: Set<SyncActionType> = new Set([
  'SEND_MESSAGE',
  'MARK_NOTIFICATION_READ',
  'MARK_CONVERSATION_READ',
  'CREATE_PERSONAL_ACTIVITY',
  'UPDATE_PERSONAL_ACTIVITY',
  'SAVE_RESOURCE_OFFLINE',
  'UPDATE_APPEARANCE',
  'UPDATE_ACCESSIBILITY',
  'UPDATE_LANGUAGE',
]);

const DELIBERATE_RETRY_ONLY: Set<SyncActionType> = new Set([
  'CONFIRM_BOOKING',
  'CREATE_BOOKING',
  'CANCEL_BOOKING',
  'SUBMIT_VERIFICATION',
  'APPROVE_CLASS_MEMBERSHIP',
  'ADMIN_ACTION',
  'UPDATE_PRIVACY',
  'BLOCK_PERSON',
]);

export function offlineMutationAllowed(action: SyncActionType): boolean {
  return OFFLINE_ALLOWED.has(action);
}

export const MAX_AUTOMATIC_RETRIES = 5;
export const BASE_BACKOFF_MS = 2_000;
export const MAX_BACKOFF_MS = 5 * 60 * 1000;

export function backoffDelayMs(retryCount: number, base = BASE_BACKOFF_MS, max = MAX_BACKOFF_MS): number {
  if (retryCount <= 0) {
    return base;
  }
  const delay = base * 2 ** retryCount;
  return Math.min(delay, max);
}

export function shouldRetryAutomatically(input: {
  classification: SyncErrorClass;
  action: SyncActionType;
  retryCount: number;
}): boolean {
  if (input.classification !== 'RETRYABLE') {
    return false;
  }
  if (DELIBERATE_RETRY_ONLY.has(input.action)) {
    return false;
  }
  return input.retryCount < MAX_AUTOMATIC_RETRIES;
}

export function resolvedPendingState(classification: SyncErrorClass): PendingActionState {
  switch (classification) {
    case 'RETRYABLE':
    case 'AUTHENTICATION':
      return 'FAILED';
    case 'AUTHORIZATION':
    case 'VALIDATION':
    case 'PERMANENT':
      return 'REJECTED';
    case 'CONFLICT':
      return 'FAILED';
    default:
      return 'FAILED';
  }
}

export type ConflictPolicy =
  | 'SERVER_WINS'
  | 'APPEND_ONLY'
  | 'CLIENT_DRAFT_WINS'
  | 'OPTIMISTIC_VERSION'
  | 'LAST_WRITE_WINS';

const CONFLICT_POLICIES: Record<string, ConflictPolicy> = {
  MESSAGE: 'APPEND_ONLY',
  NOTIFICATION: 'SERVER_WINS',
  ENROLLMENT: 'SERVER_WINS',
  CLASS_MEMBERSHIP: 'SERVER_WINS',
  ORGANIZATION_MEMBERSHIP: 'SERVER_WINS',
  BOOKING: 'SERVER_WINS',
  PERMISSION: 'SERVER_WINS',
  PRIVACY_SETTINGS: 'SERVER_WINS',
  SESSION: 'SERVER_WINS',
  VERIFICATION: 'SERVER_WINS',
  RESOURCE: 'OPTIMISTIC_VERSION',
  ANNOUNCEMENT: 'OPTIMISTIC_VERSION',
  ASSESSMENT: 'OPTIMISTIC_VERSION',
  EVENT: 'OPTIMISTIC_VERSION',
  PROFILE: 'OPTIMISTIC_VERSION',
  SERVICE: 'OPTIMISTIC_VERSION',
  MESSAGE_DRAFT: 'CLIENT_DRAFT_WINS',
  PERSONAL_ACTIVITY: 'CLIENT_DRAFT_WINS',
  APPEARANCE_PREFERENCES: 'LAST_WRITE_WINS',
  ACCESSIBILITY_PREFERENCES: 'LAST_WRITE_WINS',
  LANGUAGE_PREFERENCES: 'LAST_WRITE_WINS',
};

export function conflictPolicyFor(objectType: string): ConflictPolicy {
  return CONFLICT_POLICIES[objectType] ?? 'SERVER_WINS';
}

export function versionConflict(input: { expectedVersion: number; currentVersion: number }): boolean {
  return input.expectedVersion !== input.currentVersion;
}

export type MessageDeliveryState =
  | 'PENDING_SEND'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'REJECTED';

const SERVER_CONFIRMED_STATES: Set<MessageDeliveryState> = new Set(['SENT', 'DELIVERED', 'READ']);

export function clientMayAssertState(state: MessageDeliveryState, serverConfirmed: boolean): boolean {
  if (SERVER_CONFIRMED_STATES.has(state)) {
    return serverConfirmed;
  }
  return true;
}

export type LocalCopyDisposition = 'KEEP' | 'MARK_STALE' | 'REMOVE';

export function localCopyDisposition(operation: ChangeOperation): LocalCopyDisposition {
  switch (operation) {
    case 'CREATE':
    case 'UPDATE':
      return 'KEEP';
    case 'ARCHIVE':
      return 'MARK_STALE';
    case 'DELETE':
    case 'RESTRICT':
    case 'ACCESS_REVOKED':
      return 'REMOVE';
    default:
      return 'KEEP';
  }
}
