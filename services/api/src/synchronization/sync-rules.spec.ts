import {
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  backoffDelayMs,
  canTransitionPendingAction,
  classifySyncError,
  clientMayAssertState,
  conflictPolicyFor,
  localCopyDisposition,
  offlineMutationAllowed,
  resolvedPendingState,
  shouldRetryAutomatically,
  versionConflict,
} from './sync-rules';

describe('synchronization rules', () => {
  it('enforces the pending action state machine', () => {
    expect(canTransitionPendingAction('PENDING', 'SYNCING')).toBe(true);
    expect(canTransitionPendingAction('SYNCING', 'COMPLETED')).toBe(true);
    expect(canTransitionPendingAction('FAILED', 'PENDING')).toBe(true);
    expect(canTransitionPendingAction('PENDING', 'COMPLETED')).toBe(false);
    expect(canTransitionPendingAction('REJECTED', 'PENDING')).toBe(false);
  });

  it('classifies transport, authorization and conflict failures differently', () => {
    expect(classifySyncError({ code: 'OFFLINE' })).toBe('RETRYABLE');
    expect(classifySyncError({ status: 503 })).toBe('RETRYABLE');
    expect(classifySyncError({ status: 429 })).toBe('RETRYABLE');
    expect(classifySyncError({ status: 401 })).toBe('AUTHENTICATION');
    expect(classifySyncError({ status: 403 })).toBe('AUTHORIZATION');
    expect(classifySyncError({ status: 409 })).toBe('CONFLICT');
    expect(classifySyncError({ status: 422 })).toBe('VALIDATION');
    expect(classifySyncError({ status: 404 })).toBe('PERMANENT');
  });

  it('rejects rather than retries a permission failure', () => {
    expect(resolvedPendingState('AUTHORIZATION')).toBe('REJECTED');
    expect(resolvedPendingState('VALIDATION')).toBe('REJECTED');
    expect(resolvedPendingState('RETRYABLE')).toBe('FAILED');
    expect(
      shouldRetryAutomatically({ classification: 'AUTHORIZATION', action: 'SEND_MESSAGE', retryCount: 0 }),
    ).toBe(false);
  });

  it('never auto-retries booking or verification actions', () => {
    expect(
      shouldRetryAutomatically({ classification: 'RETRYABLE', action: 'CONFIRM_BOOKING', retryCount: 0 }),
    ).toBe(false);
    expect(
      shouldRetryAutomatically({ classification: 'RETRYABLE', action: 'SUBMIT_VERIFICATION', retryCount: 0 }),
    ).toBe(false);
    expect(
      shouldRetryAutomatically({ classification: 'RETRYABLE', action: 'SEND_MESSAGE', retryCount: 2 }),
    ).toBe(true);
    expect(
      shouldRetryAutomatically({ classification: 'RETRYABLE', action: 'SEND_MESSAGE', retryCount: 9 }),
    ).toBe(false);
  });

  it('backs off exponentially within a ceiling', () => {
    expect(backoffDelayMs(0)).toBe(BASE_BACKOFF_MS);
    expect(backoffDelayMs(1)).toBe(BASE_BACKOFF_MS * 2);
    expect(backoffDelayMs(3)).toBe(BASE_BACKOFF_MS * 8);
    expect(backoffDelayMs(50)).toBe(MAX_BACKOFF_MS);
  });

  it('only allows low-risk mutations offline', () => {
    expect(offlineMutationAllowed('SEND_MESSAGE')).toBe(true);
    expect(offlineMutationAllowed('CREATE_PERSONAL_ACTIVITY')).toBe(true);
    expect(offlineMutationAllowed('MARK_NOTIFICATION_READ')).toBe(true);
    expect(offlineMutationAllowed('CONFIRM_BOOKING')).toBe(false);
    expect(offlineMutationAllowed('SUBMIT_VERIFICATION')).toBe(false);
    expect(offlineMutationAllowed('APPROVE_CLASS_MEMBERSHIP')).toBe(false);
    expect(offlineMutationAllowed('ADMIN_ACTION')).toBe(false);
  });

  it('picks a conflict policy per object type rather than one global algorithm', () => {
    expect(conflictPolicyFor('MESSAGE')).toBe('APPEND_ONLY');
    expect(conflictPolicyFor('CLASS_MEMBERSHIP')).toBe('SERVER_WINS');
    expect(conflictPolicyFor('BOOKING')).toBe('SERVER_WINS');
    expect(conflictPolicyFor('RESOURCE')).toBe('OPTIMISTIC_VERSION');
    expect(conflictPolicyFor('PERSONAL_ACTIVITY')).toBe('CLIENT_DRAFT_WINS');
    expect(conflictPolicyFor('APPEARANCE_PREFERENCES')).toBe('LAST_WRITE_WINS');
    expect(conflictPolicyFor('SOMETHING_UNMAPPED')).toBe('SERVER_WINS');
  });

  it('detects a stale optimistic write', () => {
    expect(versionConflict({ expectedVersion: 8, currentVersion: 9 })).toBe(true);
    expect(versionConflict({ expectedVersion: 9, currentVersion: 9 })).toBe(false);
  });

  it('forbids the client claiming delivery before the server confirms', () => {
    expect(clientMayAssertState('PENDING_SEND', false)).toBe(true);
    expect(clientMayAssertState('SENDING', false)).toBe(true);
    expect(clientMayAssertState('DELIVERED', false)).toBe(false);
    expect(clientMayAssertState('SENT', false)).toBe(false);
    expect(clientMayAssertState('READ', true)).toBe(true);
  });

  it('removes local copies when access is revoked', () => {
    expect(localCopyDisposition('ACCESS_REVOKED')).toBe('REMOVE');
    expect(localCopyDisposition('RESTRICT')).toBe('REMOVE');
    expect(localCopyDisposition('DELETE')).toBe('REMOVE');
    expect(localCopyDisposition('ARCHIVE')).toBe('MARK_STALE');
    expect(localCopyDisposition('UPDATE')).toBe('KEEP');
  });
});
