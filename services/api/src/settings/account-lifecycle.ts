export type AccountLifecycleState =
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'DEACTIVATED'
  | 'DELETION_REQUESTED'
  | 'DELETION_PROCESSING'
  | 'DELETED';

const LIFECYCLE_TRANSITIONS: Record<AccountLifecycleState, AccountLifecycleState[]> = {
  ACTIVE: ['RESTRICTED', 'SUSPENDED', 'DEACTIVATED', 'DELETION_REQUESTED'],
  RESTRICTED: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETION_REQUESTED'],
  SUSPENDED: ['ACTIVE', 'RESTRICTED', 'DELETION_REQUESTED'],
  DEACTIVATED: ['ACTIVE', 'DELETION_REQUESTED'],
  DELETION_REQUESTED: ['ACTIVE', 'DELETION_PROCESSING'],
  DELETION_PROCESSING: ['DELETED'],
  DELETED: [],
};

export const DELETION_GRACE_PERIOD_DAYS = 30;

export function canTransitionAccount(from: AccountLifecycleState, to: AccountLifecycleState): boolean {
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function deletionGraceEndsAt(requestedAt: Date, days = DELETION_GRACE_PERIOD_DAYS): Date {
  return new Date(requestedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function inDeletionGracePeriod(requestedAt: Date, now = new Date()): boolean {
  return now < deletionGraceEndsAt(requestedAt);
}

export function canCancelDeletion(input: {
  state: AccountLifecycleState;
  requestedAt: Date;
  now?: Date;
}): boolean {
  if (input.state !== 'DELETION_REQUESTED') {
    return false;
  }
  return inDeletionGracePeriod(input.requestedAt, input.now ?? new Date());
}

export function canAuthenticate(state: AccountLifecycleState): boolean {
  return state === 'ACTIVE' || state === 'RESTRICTED' || state === 'DELETION_REQUESTED';
}

export function isDiscoverable(state: AccountLifecycleState): boolean {
  return state === 'ACTIVE' || state === 'RESTRICTED';
}

export function authorAttribution(input: {
  state: AccountLifecycleState;
  displayName: string | null;
}): string {
  if (input.state === 'DELETED' || input.state === 'DELETION_PROCESSING') {
    return 'Deleted account';
  }
  return input.displayName ?? 'CampusOS member';
}

export function retainsHistoricalRecords(_state: AccountLifecycleState): boolean {
  return true;
}

export type DataExportState = 'REQUESTED' | 'PROCESSING' | 'READY' | 'EXPIRED' | 'FAILED';

const EXPORT_TRANSITIONS: Record<DataExportState, DataExportState[]> = {
  REQUESTED: ['PROCESSING', 'FAILED'],
  PROCESSING: ['READY', 'FAILED'],
  READY: ['EXPIRED'],
  EXPIRED: [],
  FAILED: [],
};

export const DATA_EXPORT_TTL_HOURS = 48;

export function canTransitionExport(from: DataExportState, to: DataExportState): boolean {
  return EXPORT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function exportExpiresAt(readyAt: Date, hours = DATA_EXPORT_TTL_HOURS): Date {
  return new Date(readyAt.getTime() + hours * 60 * 60 * 1000);
}

export function exportDownloadable(input: {
  state: DataExportState;
  readyAt: Date | null;
  now?: Date;
}): boolean {
  if (input.state !== 'READY' || !input.readyAt) {
    return false;
  }
  return (input.now ?? new Date()) < exportExpiresAt(input.readyAt);
}
