import { AudienceContext } from './social-rules';
import {
  canEditProfileField,
  classRepCapabilities,
  clientClaimedRoleTrusted,
  connectionRevealsPrivateFields,
  derivedAcademicHeadline,
  fieldVisible,
  followGrantsMessaging,
  formerUserLabel,
  membershipIsSocialRelationship,
  offlineProfileMayCache,
  peopleSearchForbiddenKeys,
  personReportAutoSuspends,
  primaryClassReplacesMembership,
  profilePhotoUsesFile,
  profileShareReference,
  registrationNumberIsUsername,
  roleBadge,
  searchabilityIndependentOfVisibility,
  typedAcademicContextTrusted,
  viewingProfileRevealsAllFields,
  visibleProfileSections,
  blockRemovesEnrollment,
} from './profile-policy';

const campusStranger: AudienceContext = {
  self: false,
  sameCampus: true,
  connected: false,
  sameContext: false,
};

const connection: AudienceContext = { ...campusStranger, connected: true };

describe('profile policy', () => {
  it('keeps Person identity separate from Profile presentation', () => {
    expect(canEditProfileField('DISPLAY_NAME')).toBe(true);
    expect(canEditProfileField('USERNAME')).toBe(true);
    expect(canEditProfileField('PROGRAMME')).toBe(false);
    expect(canEditProfileField('REGISTRATION_NUMBER')).toBe(false);
    expect(registrationNumberIsUsername()).toBe(false);
  });

  it('does not reveal every field just because the profile itself is visible', () => {
    expect(viewingProfileRevealsAllFields()).toBe(false);
    expect(fieldVisible({ field: 'BIO', visibility: 'PUBLIC', context: campusStranger })).toBe(true);
    expect(fieldVisible({ field: 'COURSES', visibility: 'CONNECTIONS', context: campusStranger })).toBe(false);
    expect(fieldVisible({ field: 'COURSES', visibility: 'CONNECTIONS', context: connection })).toBe(true);
    expect(fieldVisible({ field: 'REGISTRATION_NUMBER', context: campusStranger })).toBe(false);
    expect(fieldVisible({ field: 'REGISTRATION_NUMBER', context: { ...campusStranger, self: true } })).toBe(true);
    expect(fieldVisible({ field: 'PHONE', visibility: 'PUBLIC', context: campusStranger })).toBe(false);
  });

  it('derives academic headline from verified memberships, not typed copy', () => {
    expect(
      derivedAcademicHeadline({ programmeName: 'Electrical Engineering', yearLabel: 'Year 4', verified: true }),
    ).toBe('Electrical Engineering · Year 4');
    expect(
      derivedAcademicHeadline({ programmeName: 'Electrical Engineering', yearLabel: 'Year 4', verified: false }),
    ).toBeNull();
    expect(typedAcademicContextTrusted()).toBe(false);
    expect(primaryClassReplacesMembership()).toBe(false);
  });

  it('builds role badges from contextual memberships the client cannot claim', () => {
    expect(
      roleBadge({
        role: 'CLASS_REPRESENTATIVE',
        contextType: 'CLASS',
        contextId: 'eee41',
        contextLabel: 'EEE 4.1',
      }),
    ).toEqual({ title: 'Class Representative', context: 'EEE 4.1' });
    expect(clientClaimedRoleTrusted()).toBe(false);
    expect(classRepCapabilities({ classId: 'eee41', targetClassId: 'eee41' })).toEqual({
      moderateClass: true,
      readPrivateMessages: false,
      readPrivateProfile: false,
      otherClasses: false,
    });
  });

  it('keeps follow, connection, membership and messaging as separate layers', () => {
    expect(followGrantsMessaging()).toBe(false);
    expect(connectionRevealsPrivateFields()).toBe(false);
    expect(membershipIsSocialRelationship()).toBe(false);
    expect(blockRemovesEnrollment()).toBe(false);
    expect(personReportAutoSuspends()).toBe(false);
  });

  it('shares a person as a canonical object rather than a raw URL', () => {
    expect(profileShareReference('per_matthew')).toEqual({ objectType: 'PERSON', objectId: 'per_matthew' });
    expect(profilePhotoUsesFile()).toBe(true);
  });

  it('anonymizes deleted accounts and limits what offline cache may keep', () => {
    expect(formerUserLabel('DELETED', 'Matthew D.')).toBe('Former CampusOS User');
    expect(formerUserLabel('ACTIVE', 'Matthew D.')).toBe('Matthew D.');
    expect(offlineProfileMayCache('DISPLAY_NAME')).toBe(true);
    expect(offlineProfileMayCache('REGISTRATION_NUMBER')).toBe(false);
    expect(offlineProfileMayCache('BIO')).toBe(false);
  });

  it('lets searchability be turned off independently of campus profile visibility', () => {
    expect(searchabilityIndependentOfVisibility()).toBe(true);
    expect(
      peopleSearchForbiddenKeys({
        displayName: 'Matthew',
        username: 'matthew',
        registrationNumber: 'R123',
        phoneNumber: '+263',
      }),
    ).toEqual(['registrationNumber', 'phoneNumber']);
  });

  it('hides profile sections the viewer is not allowed to see', () => {
    expect(visibleProfileSections({ COURSES: 'CONNECTIONS', POSTS: 'CAMPUS_ONLY' }, campusStranger)).toEqual(
      expect.arrayContaining(['HEADER', 'ACADEMIC', 'POSTS']),
    );
    expect(visibleProfileSections({ COURSES: 'CONNECTIONS' }, campusStranger)).not.toContain('COURSES');
    expect(visibleProfileSections({ COURSES: 'CONNECTIONS' }, connection)).toContain('COURSES');
  });
});
