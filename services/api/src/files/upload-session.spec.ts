import {
  canTransitionSession,
  chunkCount,
  jobBlocksPublication,
  nextChunkIndex,
  offlineDisposition,
  processingJobsFor,
  resolveCompletion,
  resumableRequired,
  sessionExpired,
  uploadIdempotencyKey,
  uploadUiState,
} from './upload-session';

describe('upload sessions', () => {
  it('resumes from the first missing chunk after a network loss', () => {
    const total = chunkCount(20 * 1024 * 1024);
    expect(total).toBe(4);
    expect(nextChunkIndex([0, 1, 2], total)).toBe(3);
    expect(nextChunkIndex([0, 1, 2, 3], total)).toBeNull();
    expect(resumableRequired(20 * 1024 * 1024)).toBe(true);
    expect(resumableRequired(1024)).toBe(false);
  });

  it('keeps upload sessions independent of the UI lifecycle', () => {
    expect(canTransitionSession('IN_PROGRESS', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionSession('COMPLETING', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionSession('COMPLETED', 'IN_PROGRESS')).toBe(false);
    const started = new Date('2026-01-01T00:00:00Z');
    expect(sessionExpired(started, new Date('2026-01-01T12:00:00Z'))).toBe(false);
    expect(sessionExpired(started, new Date('2026-01-03T00:00:00Z'))).toBe(true);
  });

  it('never creates a duplicate File when completion is retried', () => {
    const key = uploadIdempotencyKey({ personId: 'p1', clientActionId: 'a1' });
    expect(key).toBe(uploadIdempotencyKey({ personId: 'p1', clientActionId: 'a1' }));
    expect(key).not.toBe(uploadIdempotencyKey({ personId: 'p2', clientActionId: 'a1' }));

    expect(
      resolveCompletion({
        sessionState: 'COMPLETING',
        existingFileId: 'file_1',
        receivedChunks: [0],
        totalChunks: 1,
        checksumMatches: true,
      }),
    ).toEqual({ kind: 'EXISTING', fileId: 'file_1' });
  });

  it('rejects completion for incomplete or corrupted uploads', () => {
    expect(
      resolveCompletion({
        sessionState: 'COMPLETING',
        existingFileId: null,
        receivedChunks: [0, 2],
        totalChunks: 3,
        checksumMatches: true,
      }).kind,
    ).toBe('REJECTED');
    expect(
      resolveCompletion({
        sessionState: 'COMPLETING',
        existingFileId: null,
        receivedChunks: [0, 1, 2],
        totalChunks: 3,
        checksumMatches: false,
      }).kind,
    ).toBe('REJECTED');
    expect(
      resolveCompletion({
        sessionState: 'COMPLETING',
        existingFileId: null,
        receivedChunks: [0, 1, 2],
        totalChunks: 3,
        checksumMatches: true,
      }).kind,
    ).toBe('CREATED');
  });

  it('never shows a file as ready before the backend confirms it', () => {
    expect(uploadUiState({ sessionState: 'IN_PROGRESS', fileState: 'UPLOADING' })).toBe('UPLOADING');
    expect(uploadUiState({ sessionState: 'COMPLETED', fileState: 'PROCESSING' })).toBe('PROCESSING');
    expect(uploadUiState({ sessionState: 'COMPLETED', fileState: 'AVAILABLE' })).toBe('READY');
    expect(uploadUiState({ sessionState: 'ABORTED', fileState: null })).toBe('FAILED');
    expect(uploadUiState({ sessionState: 'COMPLETED', fileState: 'FAILED' })).toBe('FAILED');
  });

  it('queues background jobs by type and blocks publication on the security scan', () => {
    expect(processingJobsFor('image/jpeg')).toEqual([
      'SECURITY_SCAN',
      'METADATA_EXTRACTION',
      'THUMBNAIL',
      'PREVIEW',
      'INDEXING',
    ]);
    expect(processingJobsFor('video/mp4')).toContain('THUMBNAIL');
    expect(processingJobsFor('application/zip')).toEqual(['SECURITY_SCAN', 'METADATA_EXTRACTION', 'INDEXING']);
    expect(jobBlocksPublication('SECURITY_SCAN')).toBe(true);
    expect(jobBlocksPublication('THUMBNAIL')).toBe(false);
  });

  it('removes offline copies when access is revoked and never caches sensitive files', () => {
    const now = new Date('2026-01-10T00:00:00Z');
    expect(
      offlineDisposition({
        securityClass: 'AUTHENTICATED',
        stillAuthorized: false,
        lastValidatedAt: now,
        now,
      }),
    ).toBe('REMOVED');
    expect(
      offlineDisposition({
        securityClass: 'SENSITIVE',
        stillAuthorized: true,
        lastValidatedAt: now,
        now,
      }),
    ).toBe('REMOVED');
  });

  it('tolerates temporary connectivity failures but not indefinitely', () => {
    const now = new Date('2026-01-10T00:00:00Z');
    expect(
      offlineDisposition({
        securityClass: 'PRIVATE',
        stillAuthorized: null,
        lastValidatedAt: new Date('2026-01-09T18:00:00Z'),
        now,
      }),
    ).toBe('AUTHORIZED');
    expect(
      offlineDisposition({
        securityClass: 'PRIVATE',
        stillAuthorized: null,
        lastValidatedAt: new Date('2026-01-07T00:00:00Z'),
        now,
      }),
    ).toBe('STALE');
    expect(
      offlineDisposition({
        securityClass: 'PRIVATE',
        stillAuthorized: null,
        lastValidatedAt: new Date('2025-12-01T00:00:00Z'),
        now,
      }),
    ).toBe('REMOVED');
  });
});
