import { campusOsIsUniversitySystemOfRecord } from '../administration/governance-policy';
import { studyGroupReplacesClass, studyGroupReplacesCourse } from '../study-groups/study-group-policy';

export const ARCHITECTURE_STATUS = 'FROZEN' as const;

export const CANONICAL_OBJECTS = [
  'PERSON',
  'CLASS',
  'COURSE',
  'COURSE_OFFERING',
  'ORGANIZATION',
  'EVENT',
  'RESOURCE',
  'STUDY_GROUP',
  'SERVICE',
  'ACTIVITY',
  'CONVERSATION',
  'POST',
  'COMMENT',
  'NOTIFICATION',
  'FILE',
  'MEDIA',
  'LOCATION',
  'SERVICE_REQUEST',
  'BOOKING',
  'ASSIGNMENT',
  'ANNOUNCEMENT',
  'ASSESSMENT',
  'ENROLLMENT',
  'MEMBERSHIP',
  'RELATIONSHIP',
  'PERMISSION',
  'ROLE',
  'ROLE_ASSIGNMENT',
  'AUDIT_EVENT',
  'INTEGRATION',
] as const;

export type CanonicalObject = (typeof CANONICAL_OBJECTS)[number];

const EXISTING_OBJECT_FOR: Record<string, CanonicalObject> = {
  'study-group-chat': 'CONVERSATION',
  'organization-event': 'EVENT',
  'resource-file': 'FILE',
  'service-notification': 'NOTIFICATION',
  'course-membership': 'ENROLLMENT',
  'event-calendar': 'ACTIVITY',
  'organization-post': 'POST',
  'study-group-post': 'POST',
  'profile-photo': 'FILE',
  'verification-evidence': 'FILE',
  'class-membership': 'MEMBERSHIP',
};

export function existingObjectFor(concept: string): CanonicalObject | null {
  return EXISTING_OBJECT_FOR[concept] ?? null;
}

export function shouldIntroduceDomainObject(input: {
  existingObjectRepresentsThis: boolean;
  existingRelationshipRepresentsThis: boolean;
  existingPermissionCoversThis: boolean;
  existingWorkflowCoversThis: boolean;
  canContextualizeExistingObject: boolean;
}): boolean {
  return !(
    input.existingObjectRepresentsThis ||
    input.existingRelationshipRepresentsThis ||
    input.existingPermissionCoversThis ||
    input.existingWorkflowCoversThis ||
    input.canContextualizeExistingObject
  );
}

export const AUTHORIZATION_CHAIN = [
  'PERSON',
  'AUTHENTICATION',
  'ROLE',
  'RELATIONSHIP_OR_MEMBERSHIP',
  'SCOPE',
  'OBJECT',
  'OBJECT_STATE',
  'PERMISSION',
  'PRIVACY_OR_POLICY',
  'APPROVAL',
  'ALLOW_OR_DENY',
] as const;

export function frontendIsFinalAuthority(): boolean {
  return false;
}

export function onePersonOneIdentity(): boolean {
  return true;
}

export function separateAccountsPerRole(): boolean {
  return false;
}

export function verificationIsAuthentication(): boolean {
  return false;
}

export const API_PREFIX = '/api/v1';

export function postgresIsAuthoritativeStore(): boolean {
  return true;
}

export function sqliteIsAuthoritativeStore(): boolean {
  return false;
}

export function offlineCapableNotAuthoritative(): boolean {
  return true;
}

export function queuedMutationRequiresClientActionId(): boolean {
  return true;
}

export function searchBypassesAuthorization(): boolean {
  return false;
}

export function privateMetadataMayLeakThroughSearch(): boolean {
  return false;
}

export function privateFileUrlsArePermanent(): boolean {
  return false;
}

export function featuresMayDeliverNotificationsDirectly(): boolean {
  return false;
}

export function websocketIsAuthoritativeState(): boolean {
  return false;
}

export function applicationLogsAreAuditRecords(): boolean {
  return false;
}

export function campusOsRebuildsUniversityErp(): boolean {
  return campusOsIsUniversitySystemOfRecord();
}

export function studyGroupIsSecondCourse(): boolean {
  return studyGroupReplacesCourse();
}

export function studyGroupIsSecondClass(): boolean {
  return studyGroupReplacesClass();
}

export const MVP_LOOP = [
  'LOGIN',
  'VERIFY',
  'JOIN_CLASS',
  'SEE_CAMPUS_AND_ACADEMIC_CONTENT',
  'ACCESS_COURSES',
  'COMMUNICATE',
  'DISCOVER_EVENTS_AND_ORGANIZATIONS',
  'USE_SERVICES',
] as const;

export const BUILD_PHASES = [
  'FOUNDATION',
  'IDENTITY',
  'ACADEMIC_FOUNDATION',
  'STUDENT_UTILITY',
  'COMMUNICATION',
  'COMMUNITY',
  'SERVICES',
  'ADMINISTRATION',
  'HARDENING',
] as const;

export const PREMATURE_SYSTEMS = [
  'UNIVERSITY_ERP',
  'BANKING',
  'COMPLETE_LMS_REPLACEMENT',
  'HOSPITAL_INFORMATION_SYSTEM',
  'GIANT_SOCIAL_NETWORK',
  'PROJECT_MANAGEMENT_PLATFORM',
  'RIDE_HAILING',
  'FULL_ECOMMERCE',
  'REPLACEMENT_FOR_EVERY_UZ_DATABASE',
] as const;

export function isPrematureSystem(system: string): boolean {
  return (PREMATURE_SYSTEMS as readonly string[]).includes(system);
}

export const IMPLEMENTATION_SEQUENCE = [
  'ARCHITECTURE',
  'REPOSITORY',
  'DATABASE_SCHEMA',
  'BACKEND_FOUNDATION',
  'FLUTTER_FOUNDATION',
  'AUTHENTICATION',
  'ACADEMIC_CORE',
  'MVP',
  'TESTING',
  'UZ_PILOT',
] as const;

export const SENSITIVE_DATA_CLASSES = [
  'VERIFICATION_EVIDENCE',
  'REGISTRATION_NUMBER',
  'PRIVATE_MESSAGE',
  'PROTECTED_FILE',
  'ADMINISTRATIVE_RECORD',
  'AUTHENTICATION_MATERIAL',
] as const;

export const SECURITY_UNAUTHORIZED_CASES = [
  'STUDENT_A_PRIVATE_RESOURCE_OF_STUDENT_B',
  'OTHER_CLASS_PRIVATE_CONTENT',
  'FORMER_MEMBER_RESTRICTED_GROUP',
  'BLOCKED_PERSON_DM',
  'EXPIRED_ADMIN_ROLE',
  'LECTURER_OTHER_COURSE',
  'CLASS_REP_UNIVERSITY_ADMIN',
  'EXPIRED_SIGNED_FILE_URL',
  'FORGED_CLIENT_ACTION_ID',
  'DUPLICATE_MUTATION',
  'REPLAY_SENSITIVE_OPERATION',
  'MALFORMED_UPLOAD',
  'OVERSIZED_UPLOAD',
  'RATE_LIMIT_BYPASS',
] as const;

export function unauthorizedResultLeaksProtectedInformation(): boolean {
  return false;
}

export const ENVIRONMENTS = ['development', 'staging', 'production'] as const;

export function productionCredentialsInDevelopment(): boolean {
  return false;
}

export function productionStudentDataInOrdinaryDevelopment(): boolean {
  return false;
}

export function screensAreSourceOfTruth(): boolean {
  return false;
}

export function architectureIsFrozen(): boolean {
  return ARCHITECTURE_STATUS === 'FROZEN';
}
