export type FileSecurityClass = 'PUBLIC' | 'AUTHENTICATED' | 'PRIVATE' | 'SENSITIVE';

export type FileLifecycleState =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'AVAILABLE'
  | 'RESTRICTED'
  | 'ARCHIVED'
  | 'DELETED'
  | 'FAILED';

const FILE_TRANSITIONS: Record<FileLifecycleState, FileLifecycleState[]> = {
  UPLOADING: ['PROCESSING', 'FAILED'],
  PROCESSING: ['AVAILABLE', 'FAILED'],
  AVAILABLE: ['RESTRICTED', 'ARCHIVED'],
  RESTRICTED: ['AVAILABLE', 'ARCHIVED'],
  ARCHIVED: ['DELETED', 'RESTRICTED'],
  DELETED: [],
  FAILED: ['UPLOADING'],
};

export function canTransitionFile(from: FileLifecycleState, to: FileLifecycleState): boolean {
  return FILE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function fileReadable(state: FileLifecycleState): boolean {
  return state === 'AVAILABLE';
}

export type FileAction = 'VIEW' | 'DOWNLOAD' | 'SHARE' | 'SAVE_OFFLINE';

const ACTIONS_BY_CLASS: Record<FileSecurityClass, FileAction[]> = {
  PUBLIC: ['VIEW', 'DOWNLOAD', 'SHARE', 'SAVE_OFFLINE'],
  AUTHENTICATED: ['VIEW', 'DOWNLOAD', 'SHARE', 'SAVE_OFFLINE'],
  PRIVATE: ['VIEW', 'DOWNLOAD', 'SAVE_OFFLINE'],
  SENSITIVE: ['VIEW'],
};

export function actionPermittedForClass(securityClass: FileSecurityClass, action: FileAction): boolean {
  return ACTIONS_BY_CLASS[securityClass].includes(action);
}

export function authorizeFileAction(input: {
  securityClass: FileSecurityClass;
  lifecycleState: FileLifecycleState;
  action: FileAction;
  domainGrants: FileAction[];
  authenticated: boolean;
}): { allowed: boolean; reason?: string } {
  if (!input.authenticated && input.securityClass !== 'PUBLIC') {
    return { allowed: false, reason: 'Please sign in to continue.' };
  }
  if (!fileReadable(input.lifecycleState)) {
    return { allowed: false, reason: 'This content is no longer available to you.' };
  }
  if (!actionPermittedForClass(input.securityClass, input.action)) {
    return { allowed: false, reason: "You don't have permission to do that." };
  }
  if (!input.domainGrants.includes(input.action)) {
    return { allowed: false, reason: "You don't have permission to do that." };
  }
  return { allowed: true };
}

const SIGNED_URL_TTL_SECONDS: Record<FileSecurityClass, number> = {
  PUBLIC: 24 * 60 * 60,
  AUTHENTICATED: 60 * 60,
  PRIVATE: 5 * 60,
  SENSITIVE: 60,
};

export function signedUrlTtlSeconds(securityClass: FileSecurityClass): number {
  return SIGNED_URL_TTL_SECONDS[securityClass];
}

export function permanentUrlAllowed(securityClass: FileSecurityClass): boolean {
  return securityClass === 'PUBLIC';
}

export function offlineCacheAllowed(securityClass: FileSecurityClass): boolean {
  return securityClass !== 'SENSITIVE';
}

export function exifStripRequired(input: { securityClass: FileSecurityClass; mimeType: string }): boolean {
  if (!input.mimeType.startsWith('image/')) {
    return false;
  }
  return input.securityClass === 'PUBLIC' || input.securityClass === 'AUTHENTICATED';
}

export type UploadContext =
  | 'PROFILE_MEDIA'
  | 'MESSAGE_ATTACHMENT'
  | 'RESOURCE'
  | 'EVENT_MEDIA'
  | 'ORGANIZATION_MEDIA'
  | 'SERVICE_MEDIA'
  | 'BOOKING_ATTACHMENT'
  | 'VERIFICATION_EVIDENCE'
  | 'POST_MEDIA';

const MB = 1024 * 1024;

const QUOTAS: Record<UploadContext, { maxBytes: number; mimeTypes: string[] }> = {
  PROFILE_MEDIA: { maxBytes: 8 * MB, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] },
  MESSAGE_ATTACHMENT: { maxBytes: 25 * MB, mimeTypes: [] },
  RESOURCE: { maxBytes: 100 * MB, mimeTypes: [] },
  EVENT_MEDIA: { maxBytes: 12 * MB, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  ORGANIZATION_MEDIA: { maxBytes: 12 * MB, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  SERVICE_MEDIA: { maxBytes: 12 * MB, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
  BOOKING_ATTACHMENT: { maxBytes: 50 * MB, mimeTypes: [] },
  VERIFICATION_EVIDENCE: { maxBytes: 15 * MB, mimeTypes: ['image/jpeg', 'image/png', 'application/pdf'] },
  POST_MEDIA: { maxBytes: 25 * MB, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
};

const CONTEXT_SECURITY: Record<UploadContext, FileSecurityClass> = {
  PROFILE_MEDIA: 'AUTHENTICATED',
  MESSAGE_ATTACHMENT: 'PRIVATE',
  RESOURCE: 'AUTHENTICATED',
  EVENT_MEDIA: 'AUTHENTICATED',
  ORGANIZATION_MEDIA: 'AUTHENTICATED',
  SERVICE_MEDIA: 'AUTHENTICATED',
  BOOKING_ATTACHMENT: 'PRIVATE',
  VERIFICATION_EVIDENCE: 'SENSITIVE',
  POST_MEDIA: 'PRIVATE',
};

export function securityClassFor(context: UploadContext): FileSecurityClass {
  return CONTEXT_SECURITY[context];
}

export function validateUpload(input: {
  context: UploadContext;
  sizeBytes: number;
  mimeType: string;
}): { valid: boolean; reason?: string } {
  const quota = QUOTAS[input.context];
  if (input.sizeBytes <= 0) {
    return { valid: false, reason: 'That file appears to be empty.' };
  }
  if (input.sizeBytes > quota.maxBytes) {
    const limitMb = Math.round(quota.maxBytes / MB);
    return { valid: false, reason: `Files here must be ${limitMb} MB or smaller.` };
  }
  if (quota.mimeTypes.length > 0 && !quota.mimeTypes.includes(input.mimeType)) {
    return { valid: false, reason: "That file type isn't supported here." };
  }
  return { valid: true };
}

export type DuplicateOutcome = {
  reuseStorage: boolean;
  reuseFileId: string | null;
  createsNewProvenance: boolean;
};

export function duplicateOutcome(input: {
  checksum: string;
  existing: { id: string; checksum: string; securityClass: FileSecurityClass } | null;
  context: UploadContext;
}): DuplicateOutcome {
  const target = securityClassFor(input.context);
  const matches =
    input.existing !== null &&
    input.existing.checksum === input.checksum &&
    input.existing.securityClass === target;
  return {
    reuseStorage: matches,
    reuseFileId: matches ? input.existing!.id : null,
    createsNewProvenance: true,
  };
}

export function derivativeSecurityClass(source: FileSecurityClass): FileSecurityClass {
  return source;
}

export function processingFailureAffectsDomain(): boolean {
  return false;
}

export const LOGGABLE_FILE_EVENTS = [
  'file_uploaded',
  'file_accessed',
  'file_downloaded',
  'file_shared',
  'file_restricted',
  'file_archived',
  'file_processing_failed',
];

export const NEVER_LOGGED_FILE_FIELDS = [
  'contents',
  'buffer',
  'accessUrl',
  'signedUrl',
  'storageKey',
  'accessToken',
  'evidenceImage',
];

export function requiresAccessAudit(securityClass: FileSecurityClass): boolean {
  return securityClass === 'SENSITIVE' || securityClass === 'PRIVATE';
}

export function canSurfaceInDiscovery(securityClass: FileSecurityClass | string): boolean {
  return securityClass !== 'SENSITIVE' && securityClass !== 'D';
}

export function asSecurityClass(value: string | null | undefined): FileSecurityClass {
  if (value === 'PUBLIC' || value === 'AUTHENTICATED' || value === 'PRIVATE' || value === 'SENSITIVE') {
    return value;
  }
  if (value === 'D') return 'SENSITIVE';
  if (value === 'A') return 'PUBLIC';
  if (value === 'B') return 'AUTHENTICATED';
  if (value === 'C') return 'PRIVATE';
  return 'PRIVATE';
}

export function asLifecycleState(file: {
  lifecycleState?: string | null;
  processingState?: string | null;
}): FileLifecycleState {
  const lifecycle = file.lifecycleState;
  if (
    lifecycle === 'UPLOADING' ||
    lifecycle === 'PROCESSING' ||
    lifecycle === 'AVAILABLE' ||
    lifecycle === 'RESTRICTED' ||
    lifecycle === 'ARCHIVED' ||
    lifecycle === 'DELETED' ||
    lifecycle === 'FAILED'
  ) {
    if (lifecycle === 'UPLOADING' && file.processingState === 'READY') {
      return 'AVAILABLE';
    }
    return lifecycle;
  }
  switch (file.processingState) {
    case 'READY':
    case 'AVAILABLE':
      return 'AVAILABLE';
    case 'FAILED':
      return 'FAILED';
    case 'SCANNING':
    case 'PROCESSING':
      return 'PROCESSING';
    case 'RESTRICTED':
      return 'RESTRICTED';
    case 'ARCHIVED':
      return 'ARCHIVED';
    case 'DELETED':
      return 'DELETED';
    default:
      return 'UPLOADING';
  }
}

export function persistProcessingState(lifecycle: FileLifecycleState): string {
  if (lifecycle === 'AVAILABLE') return 'READY';
  if (lifecycle === 'UPLOADING') return 'UPLOADING';
  if (lifecycle === 'PROCESSING') return 'SCANNING';
  return lifecycle;
}
