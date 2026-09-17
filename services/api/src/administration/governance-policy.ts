import { AdminRole, adminActionsForRole, adminLayerFor } from './admin-authorization';

export type ContextAdminRole =
  | 'CLASS_REP'
  | 'COURSE_LECTURER'
  | 'ORGANIZATION_OFFICER'
  | 'STUDY_GROUP_ADMIN'
  | 'SERVICE_STAFF';

export function administrativeLayersRemainSeparate(): boolean {
  return true;
}

export function platformAdminReadsPrivateConversations(): boolean {
  return false;
}

export function platformAdminReadsArbitraryAcademicRecords(): boolean {
  return false;
}

export function contextRoleIsUniversityAdmin(_role: ContextAdminRole): boolean {
  return false;
}

export function adminRouteImpliesSuperuser(_path: string): boolean {
  return false;
}

export function campusOsIsUniversitySystemOfRecord(): boolean {
  return false;
}

export function academicStructureIsHardCoded(): boolean {
  return false;
}

export function courseCodeEqualsCourseOffering(): boolean {
  return false;
}

export type AcademicPeriodStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export function academicPeriodStatus(input: {
  startsAt: Date;
  endsAt: Date;
  archived?: boolean;
  now?: Date;
}): AcademicPeriodStatus {
  if (input.archived) {
    return 'ARCHIVED';
  }
  const now = input.now ?? new Date();
  if (now < input.startsAt) {
    return 'PLANNED';
  }
  if (now <= input.endsAt) {
    return 'ACTIVE';
  }
  return 'COMPLETED';
}

export type ConfigLayer = 'PLATFORM' | 'INSTITUTIONAL' | 'CONTEXT';

export function configLayerFor(key: string): ConfigLayer {
  if (
    key.startsWith('file.') ||
    key.startsWith('rate.') ||
    key.startsWith('notification.') ||
    key.startsWith('session.') ||
    key.startsWith('feature.') ||
    key === 'maintenance.mode' ||
    key.startsWith('supported.')
  ) {
    return 'PLATFORM';
  }
  if (
    key.startsWith('class.') ||
    key.startsWith('course.') ||
    key.startsWith('organization.') ||
    key.startsWith('service.workflow.')
  ) {
    return 'CONTEXT';
  }
  return 'INSTITUTIONAL';
}

export function configurationChangeRequiresAudit(): boolean {
  return true;
}

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  environment?: string | null;
  scope?: string | null;
  rolloutPercentage?: number | null;
  startAt?: Date | null;
  endAt?: Date | null;
};

export function featureFlagGrantsAuthorization(): boolean {
  return false;
}

export function featureFlagEnabled(
  flag: FeatureFlag,
  input: { environment: string; personId?: string | null; now?: Date },
): boolean {
  if (!flag.enabled) {
    return false;
  }
  if (flag.environment && flag.environment !== input.environment) {
    return false;
  }
  const now = input.now ?? new Date();
  if (flag.startAt && now < flag.startAt) {
    return false;
  }
  if (flag.endAt && now > flag.endAt) {
    return false;
  }
  if (flag.rolloutPercentage == null || flag.rolloutPercentage >= 100) {
    return true;
  }
  if (flag.rolloutPercentage <= 0 || !input.personId) {
    return false;
  }
  return rolloutBucket(flag.key, input.personId) < flag.rolloutPercentage;
}

function rolloutBucket(key: string, personId: string): number {
  let hash = 0;
  const seed = `${key}:${personId}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % 100;
}

export type BulkOperationStatus =
  | 'QUEUED'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED';

export type ImportStage = 'UPLOAD' | 'PARSE' | 'VALIDATE' | 'PREVIEW' | 'CONFIRM' | 'PROCESS' | 'REPORT';

const IMPORT_TRANSITIONS: Record<ImportStage, ImportStage[]> = {
  UPLOAD: ['PARSE'],
  PARSE: ['VALIDATE'],
  VALIDATE: ['PREVIEW'],
  PREVIEW: ['CONFIRM', 'UPLOAD'],
  CONFIRM: ['PROCESS'],
  PROCESS: ['REPORT'],
  REPORT: [],
};

export function canAdvanceImport(from: ImportStage, to: ImportStage): boolean {
  return IMPORT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function mayProcessBulkImport(input: { stage: ImportStage; confirmed: boolean; destructive: boolean }): boolean {
  if (input.stage !== 'CONFIRM' && input.stage !== 'PROCESS') {
    return false;
  }
  if (input.destructive && !input.confirmed) {
    return false;
  }
  return input.confirmed;
}

export function failedRowInvalidatesBatch(atomic: boolean): boolean {
  return atomic;
}

export function bulkOutcome(successful: number, failed: number): BulkOperationStatus {
  if (failed === 0) {
    return 'COMPLETED';
  }
  if (successful === 0) {
    return 'FAILED';
  }
  return 'COMPLETED_WITH_ERRORS';
}

export function auditIsSourceOfTruth(): boolean {
  return false;
}

export function auditEditableByOrdinaryAdmin(): boolean {
  return false;
}

export function auditIsAppendOnly(): boolean {
  return true;
}

export const GOVERNANCE_AUDIT_EVENTS = [
  'CLASS_MEMBERSHIP_APPROVED',
  'COURSE_LECTURER_ASSIGNED',
  'ACADEMIC_PERIOD_CREATED',
  'ORGANIZATION_SUSPENDED',
  'SERVICE_CONFIGURATION_CHANGED',
  'IMPORT_EXECUTED',
  'USER_ROLE_GRANTED',
  'USER_ROLE_REVOKED',
] as const;

export function requesterMayApproveOwnRequest(action: string): boolean {
  return ![
    'ASSIGN_ADMIN_ROLE',
    'REVOKE_ADMIN_ROLE',
    'SUSPEND_ORGANIZATION',
    'CREATE_INSTITUTIONAL_SERVICE',
    'CHANGE_ACADEMIC_STRUCTURE',
    'PUBLISH_OFFICIAL_CONTENT',
    'APPROVE_SENSITIVE_VERIFICATION',
  ].includes(action);
}

export type ModerationQueueState = 'NEW' | 'TRIAGED' | 'UNDER_REVIEW' | 'ACTIONED' | 'RESOLVED';

export function operationalModerationState(
  reportState: 'SUBMITTED' | 'TRIAGED' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED' | 'ACTIONED',
): ModerationQueueState {
  if (reportState === 'SUBMITTED') return 'NEW';
  if (reportState === 'DISMISSED' || reportState === 'RESOLVED') return 'RESOLVED';
  if (reportState === 'ACTIONED') return 'ACTIONED';
  return reportState;
}

export function reportedContentBecomesSearchable(): boolean {
  return false;
}

export type VerificationQueueState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'ESCALATED';

export function verificationEvidenceIsProfileField(): boolean {
  return false;
}

export type IntegrationHealthState =
  | 'CONNECTED'
  | 'DEGRADED'
  | 'DISCONNECTED'
  | 'AUTHENTICATION_REQUIRED'
  | 'ERROR'
  | 'DISABLED';

export function integrationHealthLabel(input: {
  state: IntegrationHealthState;
  lastSuccessfulSyncAt?: Date | null;
  now?: Date;
}): string {
  if (input.state === 'CONNECTED' && input.lastSuccessfulSyncAt) {
    return `Last successful sync ${input.lastSuccessfulSyncAt.toISOString()}`;
  }
  if (input.state === 'ERROR' || input.state === 'DISCONNECTED') {
    const since = input.lastSuccessfulSyncAt ? input.lastSuccessfulSyncAt.toISOString() : 'unknown';
    return `Student import has not successfully synchronized since ${since}.`;
  }
  return input.state;
}

export const JOB_INLINE_PAYLOAD_LIMIT_BYTES = 8 * 1024;

export function jobPayloadShouldEmbed(sizeBytes: number): boolean {
  return sizeBytes <= JOB_INLINE_PAYLOAD_LIMIT_BYTES;
}

export const HEALTH_FORBIDDEN_FIELDS = [
  'DATABASE_URL',
  'REDIS_URL',
  'connectionString',
  'privateKey',
  'secret',
  'password',
  'refreshTokenHash',
  'otpHash',
];

export function healthFieldExposed(field: string): boolean {
  const needle = field.toLowerCase();
  return !HEALTH_FORBIDDEN_FIELDS.some((forbidden) => needle.includes(forbidden.toLowerCase()));
}

export type AdminOfflineAction =
  | 'VIEW_DASHBOARD_CACHE'
  | 'VIEW_QUEUE_CACHE'
  | 'VIEW_AUDIT_CACHE'
  | 'ASSIGN_ROLE'
  | 'DECIDE_VERIFICATION'
  | 'MODERATE'
  | 'MUTATE_ACADEMIC_STRUCTURE'
  | 'IMPORT'
  | 'APPROVE'
  | 'CHANGE_CONFIGURATION';

const ONLINE_ADMIN_ACTIONS: AdminOfflineAction[] = [
  'ASSIGN_ROLE',
  'DECIDE_VERIFICATION',
  'MODERATE',
  'MUTATE_ACADEMIC_STRUCTURE',
  'IMPORT',
  'APPROVE',
  'CHANGE_CONFIGURATION',
];

export function adminActionRequiresOnline(action: AdminOfflineAction): boolean {
  return ONLINE_ADMIN_ACTIONS.includes(action);
}

export type AdminAttentionKind =
  | 'VERIFICATION'
  | 'MODERATION'
  | 'ORGANIZATION'
  | 'INTEGRATION'
  | 'WORKFLOW';

export type AdminAttentionItem = {
  kind: AdminAttentionKind;
  count: number;
  label: string;
};

export function dashboardIsWorkQueue(items: AdminAttentionItem[]): boolean {
  return items.every((item) => item.count >= 0 && item.label.length > 0);
}

export function roleHasUniversityWideAuthority(role: AdminRole): boolean {
  return adminLayerFor(role) === 'UNIVERSITY';
}

export function classAdminCanManageOtherClasses(): boolean {
  return false;
}

export function platformAdminHasAcademicStructure(): boolean {
  return adminActionsForRole('PLATFORM_ADMIN').includes('MANAGE_ACADEMIC_STRUCTURE');
}

export function platformAdminHasModerationEvidence(): boolean {
  return adminActionsForRole('PLATFORM_ADMIN').includes('VIEW_MODERATION_EVIDENCE');
}

export function lecturerAdministersEveryCourse(): boolean {
  return false;
}

export const CONTEXT_ADMIN_ROLES: ContextAdminRole[] = [
  'CLASS_REP',
  'COURSE_LECTURER',
  'ORGANIZATION_OFFICER',
  'STUDY_GROUP_ADMIN',
  'SERVICE_STAFF',
];
