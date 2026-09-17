import {
  API_PREFIX,
  AUTHORIZATION_CHAIN,
  BUILD_PHASES,
  CANONICAL_OBJECTS,
  IMPLEMENTATION_SEQUENCE,
  MVP_LOOP,
  architectureIsFrozen,
  campusOsRebuildsUniversityErp,
  existingObjectFor,
  featuresMayDeliverNotificationsDirectly,
  frontendIsFinalAuthority,
  isPrematureSystem,
  offlineCapableNotAuthoritative,
  onePersonOneIdentity,
  postgresIsAuthoritativeStore,
  privateFileUrlsArePermanent,
  privateMetadataMayLeakThroughSearch,
  queuedMutationRequiresClientActionId,
  screensAreSourceOfTruth,
  searchBypassesAuthorization,
  separateAccountsPerRole,
  shouldIntroduceDomainObject,
  sqliteIsAuthoritativeStore,
  studyGroupIsSecondClass,
  studyGroupIsSecondCourse,
  unauthorizedResultLeaksProtectedInformation,
  verificationIsAuthentication,
  websocketIsAuthoritativeState,
} from './architecture-freeze';

describe('CampusOS master architecture freeze', () => {
  it('freezes the canonical object model and refuses duplicate systems', () => {
    expect(architectureIsFrozen()).toBe(true);
    expect(CANONICAL_OBJECTS).toEqual(
      expect.arrayContaining(['PERSON', 'CLASS', 'COURSE', 'COURSE_OFFERING', 'STUDY_GROUP', 'SERVICE', 'FILE']),
    );
    expect(existingObjectFor('study-group-chat')).toBe('CONVERSATION');
    expect(existingObjectFor('organization-event')).toBe('EVENT');
    expect(existingObjectFor('resource-file')).toBe('FILE');
    expect(existingObjectFor('service-notification')).toBe('NOTIFICATION');
    expect(existingObjectFor('course-membership')).toBe('ENROLLMENT');
    expect(existingObjectFor('event-calendar')).toBe('ACTIVITY');
    expect(studyGroupIsSecondCourse()).toBe(false);
    expect(studyGroupIsSecondClass()).toBe(false);
    expect(
      shouldIntroduceDomainObject({
        existingObjectRepresentsThis: true,
        existingRelationshipRepresentsThis: false,
        existingPermissionCoversThis: false,
        existingWorkflowCoversThis: false,
        canContextualizeExistingObject: true,
      }),
    ).toBe(false);
  });

  it('keeps identity, authorization and state on the server', () => {
    expect(AUTHORIZATION_CHAIN[0]).toBe('PERSON');
    expect(AUTHORIZATION_CHAIN.at(-1)).toBe('ALLOW_OR_DENY');
    expect(frontendIsFinalAuthority()).toBe(false);
    expect(onePersonOneIdentity()).toBe(true);
    expect(separateAccountsPerRole()).toBe(false);
    expect(verificationIsAuthentication()).toBe(false);
    expect(postgresIsAuthoritativeStore()).toBe(true);
    expect(sqliteIsAuthoritativeStore()).toBe(false);
    expect(offlineCapableNotAuthoritative()).toBe(true);
    expect(queuedMutationRequiresClientActionId()).toBe(true);
    expect(websocketIsAuthoritativeState()).toBe(false);
    expect(screensAreSourceOfTruth()).toBe(false);
  });

  it('keeps search, files and notifications on shared infrastructure', () => {
    expect(API_PREFIX).toBe('/api/v1');
    expect(searchBypassesAuthorization()).toBe(false);
    expect(privateMetadataMayLeakThroughSearch()).toBe(false);
    expect(privateFileUrlsArePermanent()).toBe(false);
    expect(featuresMayDeliverNotificationsDirectly()).toBe(false);
    expect(unauthorizedResultLeaksProtectedInformation()).toBe(false);
  });

  it('defines the MVP loop, build order and what must not be built yet', () => {
    expect(MVP_LOOP[0]).toBe('LOGIN');
    expect(MVP_LOOP.at(-1)).toBe('USE_SERVICES');
    expect(BUILD_PHASES[0]).toBe('FOUNDATION');
    expect(BUILD_PHASES.at(-1)).toBe('HARDENING');
    expect(IMPLEMENTATION_SEQUENCE[0]).toBe('ARCHITECTURE');
    expect(IMPLEMENTATION_SEQUENCE.at(-1)).toBe('UZ_PILOT');
    expect(isPrematureSystem('UNIVERSITY_ERP')).toBe(true);
    expect(isPrematureSystem('FULL_ECOMMERCE')).toBe(true);
    expect(campusOsRebuildsUniversityErp()).toBe(false);
  });
});
