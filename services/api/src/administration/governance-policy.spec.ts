import { authorizeAdminAction, adminLayerFor } from './admin-authorization';
import {
  academicPeriodStatus,
  academicStructureIsHardCoded,
  adminActionRequiresOnline,
  adminRouteImpliesSuperuser,
  auditEditableByOrdinaryAdmin,
  auditIsAppendOnly,
  auditIsSourceOfTruth,
  bulkOutcome,
  campusOsIsUniversitySystemOfRecord,
  canAdvanceImport,
  classAdminCanManageOtherClasses,
  configLayerFor,
  contextRoleIsUniversityAdmin,
  courseCodeEqualsCourseOffering,
  failedRowInvalidatesBatch,
  featureFlagEnabled,
  featureFlagGrantsAuthorization,
  healthFieldExposed,
  integrationHealthLabel,
  jobPayloadShouldEmbed,
  lecturerAdministersEveryCourse,
  mayProcessBulkImport,
  operationalModerationState,
  platformAdminHasAcademicStructure,
  platformAdminHasModerationEvidence,
  platformAdminReadsArbitraryAcademicRecords,
  platformAdminReadsPrivateConversations,
  reportedContentBecomesSearchable,
  requesterMayApproveOwnRequest,
  verificationEvidenceIsProfileField,
} from './governance-policy';

describe('administrative governance', () => {
  it('keeps platform, university and context administration as separate layers', () => {
    expect(adminLayerFor('PLATFORM_ADMIN')).toBe('PLATFORM');
    expect(adminLayerFor('ACADEMIC_ADMIN')).toBe('UNIVERSITY');
    expect(adminLayerFor('CLASS_ADMIN')).toBe('CONTEXT');
    expect(adminLayerFor('ORGANIZATION_ADMIN')).toBe('CONTEXT');
    expect(contextRoleIsUniversityAdmin('CLASS_REP')).toBe(false);
    expect(contextRoleIsUniversityAdmin('COURSE_LECTURER')).toBe(false);
    expect(classAdminCanManageOtherClasses()).toBe(false);
    expect(lecturerAdministersEveryCourse()).toBe(false);
    expect(adminRouteImpliesSuperuser('/api/v1/admin/dashboard')).toBe(false);
  });

  it('does not let a platform administrator read private conversations or arbitrary academic records', () => {
    expect(platformAdminReadsPrivateConversations()).toBe(false);
    expect(platformAdminReadsArbitraryAcademicRecords()).toBe(false);
    expect(platformAdminHasAcademicStructure()).toBe(false);
    expect(platformAdminHasModerationEvidence()).toBe(false);
    expect(campusOsIsUniversitySystemOfRecord()).toBe(false);
  });

  it('stops authorizing an assignment once it expires', () => {
    const now = new Date('2026-09-17T12:00:00Z');
    const expired = authorizeAdminAction({
      assignments: [
        {
          role: 'ACADEMIC_ADMIN',
          scope: { type: 'FACULTY', id: 'faculty_eng' },
          expiresAt: new Date('2026-09-01T00:00:00Z'),
        },
      ],
      action: 'MANAGE_COURSE_OFFERING',
      target: { type: 'COURSE_OFFERING', id: 'coe_eeng401' },
      targetAncestors: [{ type: 'FACULTY', id: 'faculty_eng' }],
      now,
    });
    const current = authorizeAdminAction({
      assignments: [
        {
          role: 'ACADEMIC_ADMIN',
          scope: { type: 'FACULTY', id: 'faculty_eng' },
          expiresAt: new Date('2026-11-01T00:00:00Z'),
        },
      ],
      action: 'MANAGE_COURSE_OFFERING',
      target: { type: 'COURSE_OFFERING', id: 'coe_eeng401' },
      targetAncestors: [{ type: 'FACULTY', id: 'faculty_eng' }],
      now,
    });
    expect(expired.allowed).toBe(false);
    expect(current.allowed).toBe(true);
  });

  it('treats academic periods as independent of a course code', () => {
    expect(courseCodeEqualsCourseOffering()).toBe(false);
    expect(academicStructureIsHardCoded()).toBe(false);
    expect(
      academicPeriodStatus({
        startsAt: new Date('2026-02-01T00:00:00Z'),
        endsAt: new Date('2026-06-30T00:00:00Z'),
        now: new Date('2026-03-01T00:00:00Z'),
      }),
    ).toBe('ACTIVE');
    expect(
      academicPeriodStatus({
        startsAt: new Date('2027-02-01T00:00:00Z'),
        endsAt: new Date('2027-06-30T00:00:00Z'),
        now: new Date('2026-09-17T00:00:00Z'),
      }),
    ).toBe('PLANNED');
  });

  it('validates bulk imports before processing and keeps valid rows when a row fails', () => {
    expect(canAdvanceImport('UPLOAD', 'PROCESS')).toBe(false);
    expect(canAdvanceImport('PREVIEW', 'CONFIRM')).toBe(true);
    expect(mayProcessBulkImport({ stage: 'UPLOAD', confirmed: false, destructive: true })).toBe(false);
    expect(mayProcessBulkImport({ stage: 'CONFIRM', confirmed: true, destructive: true })).toBe(true);
    expect(failedRowInvalidatesBatch(false)).toBe(false);
    expect(failedRowInvalidatesBatch(true)).toBe(true);
    expect(bulkOutcome(1817, 7)).toBe('COMPLETED_WITH_ERRORS');
    expect(bulkOutcome(1842, 0)).toBe('COMPLETED');
  });

  it('keeps feature flags from substituting authorization and audit from substituting domain state', () => {
    expect(featureFlagGrantsAuthorization()).toBe(false);
    expect(
      featureFlagEnabled(
        { key: 'new_feed.enabled', enabled: true, rolloutPercentage: 0 },
        { environment: 'production', personId: 'person_1' },
      ),
    ).toBe(false);
    expect(auditIsSourceOfTruth()).toBe(false);
    expect(auditEditableByOrdinaryAdmin()).toBe(false);
    expect(auditIsAppendOnly()).toBe(true);
    expect(requesterMayApproveOwnRequest('ASSIGN_ADMIN_ROLE')).toBe(false);
    expect(configLayerFor('maintenance.mode')).toBe('PLATFORM');
    expect(configLayerFor('faculty.engineering.code')).toBe('INSTITUTIONAL');
    expect(configLayerFor('class.moderation.settings')).toBe('CONTEXT');
  });

  it('keeps moderation, verification and operations on their existing engines', () => {
    expect(operationalModerationState('SUBMITTED')).toBe('NEW');
    expect(operationalModerationState('RESOLVED')).toBe('RESOLVED');
    expect(reportedContentBecomesSearchable()).toBe(false);
    expect(verificationEvidenceIsProfileField()).toBe(false);
    expect(jobPayloadShouldEmbed(2048)).toBe(true);
    expect(jobPayloadShouldEmbed(80_000)).toBe(false);
    expect(healthFieldExposed('apiLatencyMs')).toBe(true);
    expect(healthFieldExposed('DATABASE_URL')).toBe(false);
    expect(
      integrationHealthLabel({
        state: 'ERROR',
        lastSuccessfulSyncAt: new Date('2026-09-17T06:42:00Z'),
      }),
    ).toContain('06:42');
    expect(adminActionRequiresOnline('VIEW_DASHBOARD_CACHE')).toBe(false);
    expect(adminActionRequiresOnline('IMPORT')).toBe(true);
    expect(adminActionRequiresOnline('DECIDE_VERIFICATION')).toBe(true);
  });
});
