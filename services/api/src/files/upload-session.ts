export type UploadSessionState = 'INITIATED' | 'IN_PROGRESS' | 'COMPLETING' | 'COMPLETED' | 'EXPIRED' | 'ABORTED';

const SESSION_TRANSITIONS: Record<UploadSessionState, UploadSessionState[]> = {
  INITIATED: ['IN_PROGRESS', 'EXPIRED', 'ABORTED'],
  IN_PROGRESS: ['IN_PROGRESS', 'COMPLETING', 'EXPIRED', 'ABORTED'],
  COMPLETING: ['COMPLETED', 'IN_PROGRESS', 'ABORTED'],
  COMPLETED: [],
  EXPIRED: [],
  ABORTED: [],
};

export function canTransitionSession(from: UploadSessionState, to: UploadSessionState): boolean {
  return SESSION_TRANSITIONS[from]?.includes(to) ?? false;
}

export const UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024;
export const RESUMABLE_THRESHOLD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function resumableRequired(sizeBytes: number): boolean {
  return sizeBytes > RESUMABLE_THRESHOLD_BYTES;
}

export function chunkCount(sizeBytes: number): number {
  if (sizeBytes <= 0) return 0;
  return Math.ceil(sizeBytes / UPLOAD_CHUNK_BYTES);
}

export function nextChunkIndex(receivedChunks: number[], totalChunks: number): number | null {
  for (let index = 0; index < totalChunks; index += 1) {
    if (!receivedChunks.includes(index)) {
      return index;
    }
  }
  return null;
}

export function sessionComplete(receivedChunks: number[], totalChunks: number): boolean {
  return totalChunks > 0 && nextChunkIndex(receivedChunks, totalChunks) === null;
}

export function sessionExpired(startedAt: Date, now: Date): boolean {
  return now.getTime() - startedAt.getTime() > UPLOAD_SESSION_TTL_MS;
}

export function uploadIdempotencyKey(input: { personId: string; clientActionId: string }): string {
  return `upload:${input.personId}:${input.clientActionId}`;
}

export type CompletionOutcome =
  | { kind: 'CREATED' }
  | { kind: 'EXISTING'; fileId: string }
  | { kind: 'REJECTED'; reason: string };

export function resolveCompletion(input: {
  sessionState: UploadSessionState;
  existingFileId: string | null;
  receivedChunks: number[];
  totalChunks: number;
  checksumMatches: boolean;
}): CompletionOutcome {
  if (input.existingFileId) {
    return { kind: 'EXISTING', fileId: input.existingFileId };
  }
  if (input.sessionState === 'EXPIRED' || input.sessionState === 'ABORTED') {
    return { kind: 'REJECTED', reason: 'That upload expired. Please try again.' };
  }
  if (!sessionComplete(input.receivedChunks, input.totalChunks)) {
    return { kind: 'REJECTED', reason: 'The upload is incomplete.' };
  }
  if (!input.checksumMatches) {
    return { kind: 'REJECTED', reason: "The upload didn't finish correctly. Please try again." };
  }
  return { kind: 'CREATED' };
}

export type UploadUiState = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';

export function uploadUiState(input: {
  sessionState: UploadSessionState;
  fileState: 'UPLOADING' | 'PROCESSING' | 'AVAILABLE' | 'RESTRICTED' | 'ARCHIVED' | 'DELETED' | 'FAILED' | null;
}): UploadUiState {
  if (input.fileState === 'AVAILABLE') return 'READY';
  if (input.fileState === 'FAILED') return 'FAILED';
  if (input.sessionState === 'EXPIRED' || input.sessionState === 'ABORTED') return 'FAILED';
  if (input.fileState === 'PROCESSING' || input.sessionState === 'COMPLETING' || input.sessionState === 'COMPLETED') {
    return 'PROCESSING';
  }
  return 'UPLOADING';
}

export type ProcessingJobKind =
  | 'SECURITY_SCAN'
  | 'METADATA_EXTRACTION'
  | 'THUMBNAIL'
  | 'PREVIEW'
  | 'INDEXING';

export function processingJobsFor(mimeType: string): ProcessingJobKind[] {
  const jobs: ProcessingJobKind[] = ['SECURITY_SCAN', 'METADATA_EXTRACTION'];
  if (mimeType.startsWith('image/')) {
    jobs.push('THUMBNAIL', 'PREVIEW');
  } else if (mimeType === 'application/pdf') {
    jobs.push('THUMBNAIL', 'PREVIEW');
  } else if (mimeType.startsWith('video/')) {
    jobs.push('THUMBNAIL');
  }
  jobs.push('INDEXING');
  return jobs;
}

export function jobBlocksPublication(job: ProcessingJobKind): boolean {
  return job === 'SECURITY_SCAN';
}

export type OfflineFileState = 'AUTHORIZED' | 'STALE' | 'REMOVED';

export const OFFLINE_REVALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const OFFLINE_STALE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function offlineDisposition(input: {
  securityClass: 'PUBLIC' | 'AUTHENTICATED' | 'PRIVATE' | 'SENSITIVE';
  stillAuthorized: boolean | null;
  lastValidatedAt: Date;
  now: Date;
}): OfflineFileState {
  if (input.securityClass === 'SENSITIVE') {
    return 'REMOVED';
  }
  if (input.stillAuthorized === false) {
    return 'REMOVED';
  }
  if (input.stillAuthorized === true) {
    return 'AUTHORIZED';
  }
  const age = input.now.getTime() - input.lastValidatedAt.getTime();
  if (age > OFFLINE_STALE_GRACE_MS) {
    return 'REMOVED';
  }
  if (age > OFFLINE_REVALIDATION_INTERVAL_MS) {
    return 'STALE';
  }
  return 'AUTHORIZED';
}
