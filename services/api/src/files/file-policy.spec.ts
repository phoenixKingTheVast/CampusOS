import {
  FileAction,
  authorizeFileAction,
  canTransitionFile,
  derivativeSecurityClass,
  duplicateOutcome,
  exifStripRequired,
  offlineCacheAllowed,
  permanentUrlAllowed,
  requiresAccessAudit,
  securityClassFor,
  signedUrlTtlSeconds,
  validateUpload,
} from './file-policy';

const ALL_ACTIONS: FileAction[] = ['VIEW', 'DOWNLOAD', 'SHARE', 'SAVE_OFFLINE'];

describe('file policy', () => {
  it('enforces the file lifecycle', () => {
    expect(canTransitionFile('UPLOADING', 'PROCESSING')).toBe(true);
    expect(canTransitionFile('PROCESSING', 'AVAILABLE')).toBe(true);
    expect(canTransitionFile('AVAILABLE', 'RESTRICTED')).toBe(true);
    expect(canTransitionFile('UPLOADING', 'AVAILABLE')).toBe(false);
    expect(canTransitionFile('DELETED', 'AVAILABLE')).toBe(false);
  });

  it('separates domain access from file access', () => {
    const viewOnlyGrant = authorizeFileAction({
      securityClass: 'AUTHENTICATED',
      lifecycleState: 'AVAILABLE',
      action: 'DOWNLOAD',
      domainGrants: ['VIEW'],
      authenticated: true,
    });
    expect(viewOnlyGrant.allowed).toBe(false);
    expect(viewOnlyGrant.reason).toBe("You don't have permission to do that.");

    expect(
      authorizeFileAction({
        securityClass: 'AUTHENTICATED',
        lifecycleState: 'AVAILABLE',
        action: 'DOWNLOAD',
        domainGrants: ['VIEW', 'DOWNLOAD'],
        authenticated: true,
      }).allowed,
    ).toBe(true);
  });

  it('never allows sensitive evidence to be downloaded, shared or cached offline', () => {
    for (const action of ALL_ACTIONS.filter((item) => item !== 'VIEW')) {
      expect(
        authorizeFileAction({
          securityClass: 'SENSITIVE',
          lifecycleState: 'AVAILABLE',
          action,
          domainGrants: ALL_ACTIONS,
          authenticated: true,
        }).allowed,
      ).toBe(false);
    }
    expect(offlineCacheAllowed('SENSITIVE')).toBe(false);
    expect(offlineCacheAllowed('PRIVATE')).toBe(true);
    expect(requiresAccessAudit('SENSITIVE')).toBe(true);
  });

  it('refuses access once a file is restricted or archived', () => {
    for (const state of ['RESTRICTED', 'ARCHIVED', 'PROCESSING', 'DELETED'] as const) {
      expect(
        authorizeFileAction({
          securityClass: 'AUTHENTICATED',
          lifecycleState: state,
          action: 'VIEW',
          domainGrants: ALL_ACTIONS,
          authenticated: true,
        }).allowed,
      ).toBe(false);
    }
  });

  it('only allows permanent URLs for public files and shortens TTL as sensitivity rises', () => {
    expect(permanentUrlAllowed('PUBLIC')).toBe(true);
    expect(permanentUrlAllowed('AUTHENTICATED')).toBe(false);
    expect(permanentUrlAllowed('SENSITIVE')).toBe(false);
    expect(signedUrlTtlSeconds('SENSITIVE')).toBeLessThan(signedUrlTtlSeconds('PRIVATE'));
    expect(signedUrlTtlSeconds('PRIVATE')).toBeLessThan(signedUrlTtlSeconds('AUTHENTICATED'));
  });

  it('classifies verification evidence as sensitive and booking attachments as private', () => {
    expect(securityClassFor('VERIFICATION_EVIDENCE')).toBe('SENSITIVE');
    expect(securityClassFor('BOOKING_ATTACHMENT')).toBe('PRIVATE');
    expect(securityClassFor('MESSAGE_ATTACHMENT')).toBe('PRIVATE');
    expect(securityClassFor('RESOURCE')).toBe('AUTHENTICATED');
  });

  it('validates upload size and type per context', () => {
    expect(validateUpload({ context: 'PROFILE_MEDIA', sizeBytes: 1024, mimeType: 'image/png' }).valid).toBe(true);
    expect(
      validateUpload({ context: 'PROFILE_MEDIA', sizeBytes: 1024, mimeType: 'application/pdf' }).valid,
    ).toBe(false);
    const tooBig = validateUpload({
      context: 'PROFILE_MEDIA',
      sizeBytes: 20 * 1024 * 1024,
      mimeType: 'image/png',
    });
    expect(tooBig.valid).toBe(false);
    expect(tooBig.reason).toBe('Files here must be 8 MB or smaller.');
    expect(validateUpload({ context: 'RESOURCE', sizeBytes: 0, mimeType: 'application/pdf' }).valid).toBe(false);
  });

  it('reuses storage for an identical checksum while keeping provenance distinct', () => {
    const outcome = duplicateOutcome({
      checksum: 'abc123',
      existing: { id: 'file_1', checksum: 'abc123', securityClass: 'AUTHENTICATED' },
      context: 'RESOURCE',
    });
    expect(outcome.reuseStorage).toBe(true);
    expect(outcome.reuseFileId).toBe('file_1');
    expect(outcome.createsNewProvenance).toBe(true);
  });

  it('does not reuse storage across security classes', () => {
    const outcome = duplicateOutcome({
      checksum: 'abc123',
      existing: { id: 'file_1', checksum: 'abc123', securityClass: 'AUTHENTICATED' },
      context: 'VERIFICATION_EVIDENCE',
    });
    expect(outcome.reuseStorage).toBe(false);
    expect(outcome.reuseFileId).toBeNull();
  });

  it('makes derivatives inherit the source classification and strips EXIF from shared images', () => {
    expect(derivativeSecurityClass('SENSITIVE')).toBe('SENSITIVE');
    expect(derivativeSecurityClass('PRIVATE')).toBe('PRIVATE');
    expect(exifStripRequired({ securityClass: 'AUTHENTICATED', mimeType: 'image/jpeg' })).toBe(true);
    expect(exifStripRequired({ securityClass: 'SENSITIVE', mimeType: 'image/jpeg' })).toBe(false);
    expect(exifStripRequired({ securityClass: 'PUBLIC', mimeType: 'application/pdf' })).toBe(false);
  });
});
