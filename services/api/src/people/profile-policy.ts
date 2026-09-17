import { audienceAllows, AudienceContext } from './social-rules';
import { authorAttribution, AccountLifecycleState } from '../settings/account-lifecycle';
import { blockRemovesInstitutionalRelationship } from '../settings/settings-policy';

export type ProfileAudience = 'PUBLIC' | 'CAMPUS_ONLY' | 'CONNECTIONS' | 'CONTEXT_ONLY' | 'PRIVATE' | string;

export function normalizeProfileAudience(value: string): string {
  switch (value) {
    case 'PUBLIC':
      return 'EVERYONE';
    case 'CAMPUS_ONLY':
    case 'CAMPUS':
      return 'CAMPUS';
    case 'PRIVATE':
    case 'ONLY_ME':
      return 'ONLY_ME';
    default:
      return value;
  }
}

export type ProfileField =
  | 'DISPLAY_NAME'
  | 'USERNAME'
  | 'BIO'
  | 'HEADLINE'
  | 'PHOTO'
  | 'FACULTY'
  | 'PROGRAMME'
  | 'YEAR'
  | 'PRIMARY_CLASS'
  | 'COURSES'
  | 'ORGANIZATIONS'
  | 'STUDY_GROUPS'
  | 'SERVICES'
  | 'POSTS'
  | 'CONNECTIONS'
  | 'FOLLOWERS'
  | 'FOLLOWING'
  | 'CONTACT'
  | 'REGISTRATION_NUMBER'
  | 'LEGAL_NAME'
  | 'PHONE';

export const DEFAULT_FIELD_VISIBILITY: Record<ProfileField, ProfileAudience> = {
  DISPLAY_NAME: 'CAMPUS_ONLY',
  USERNAME: 'PUBLIC',
  BIO: 'PUBLIC',
  HEADLINE: 'CAMPUS_ONLY',
  PHOTO: 'CAMPUS_ONLY',
  FACULTY: 'CAMPUS_ONLY',
  PROGRAMME: 'CAMPUS_ONLY',
  YEAR: 'CAMPUS_ONLY',
  PRIMARY_CLASS: 'CAMPUS_ONLY',
  COURSES: 'CONNECTIONS',
  ORGANIZATIONS: 'CAMPUS_ONLY',
  STUDY_GROUPS: 'CONTEXT_ONLY',
  SERVICES: 'CAMPUS_ONLY',
  POSTS: 'CAMPUS_ONLY',
  CONNECTIONS: 'CONNECTIONS',
  FOLLOWERS: 'CAMPUS_ONLY',
  FOLLOWING: 'CAMPUS_ONLY',
  CONTACT: 'PRIVATE',
  REGISTRATION_NUMBER: 'PRIVATE',
  LEGAL_NAME: 'PRIVATE',
  PHONE: 'PRIVATE',
};

const NEVER_PUBLIC: ProfileField[] = ['REGISTRATION_NUMBER', 'LEGAL_NAME', 'PHONE', 'CONTACT'];

export function fieldVisible(input: {
  field: ProfileField;
  visibility?: ProfileAudience;
  context: AudienceContext;
}): boolean {
  const requested = input.visibility ?? DEFAULT_FIELD_VISIBILITY[input.field];
  if (NEVER_PUBLIC.includes(input.field) && !input.context.self) {
    return false;
  }
  return audienceAllows(normalizeProfileAudience(requested), input.context);
}

export function viewingProfileRevealsAllFields(): boolean {
  return false;
}

export const EDITABLE_PROFILE_FIELDS: ProfileField[] = [
  'DISPLAY_NAME',
  'USERNAME',
  'BIO',
  'HEADLINE',
  'PHOTO',
];

export const SYSTEM_PROFILE_FIELDS: ProfileField[] = [
  'FACULTY',
  'PROGRAMME',
  'YEAR',
  'PRIMARY_CLASS',
  'COURSES',
  'ORGANIZATIONS',
  'REGISTRATION_NUMBER',
  'LEGAL_NAME',
];

export function canEditProfileField(field: ProfileField): boolean {
  return EDITABLE_PROFILE_FIELDS.includes(field);
}

export type AcademicMembership = {
  programmeName: string;
  yearLabel: string;
  verified: boolean;
};

export function derivedAcademicHeadline(membership: AcademicMembership | null): string | null {
  if (!membership?.verified) {
    return null;
  }
  return `${membership.programmeName} · ${membership.yearLabel}`;
}

export function typedAcademicContextTrusted(): boolean {
  return false;
}

export function registrationNumberIsUsername(): boolean {
  return false;
}

export type ContextualRole = {
  role: 'STUDENT' | 'CLASS_REPRESENTATIVE' | 'LECTURER' | 'OFFICER' | 'PROVIDER' | 'ADMIN';
  contextType: 'CLASS' | 'COURSE' | 'ORGANIZATION' | 'SERVICE' | 'PLATFORM';
  contextId: string;
  contextLabel: string;
};

export function roleBadge(role: ContextualRole): { title: string; context: string } {
  const titles: Record<ContextualRole['role'], string> = {
    STUDENT: 'Student',
    CLASS_REPRESENTATIVE: 'Class Representative',
    LECTURER: 'Lecturer',
    OFFICER: 'Officer',
    PROVIDER: 'Service Provider',
    ADMIN: 'Administrator',
  };
  return { title: titles[role.role], context: role.contextLabel };
}

export function clientClaimedRoleTrusted(): boolean {
  return false;
}

export function classRepCapabilities(input: { classId: string; targetClassId: string }): {
  moderateClass: boolean;
  readPrivateMessages: boolean;
  readPrivateProfile: boolean;
  otherClasses: boolean;
} {
  const same = input.classId === input.targetClassId;
  return {
    moderateClass: same,
    readPrivateMessages: false,
    readPrivateProfile: false,
    otherClasses: false,
  };
}

export function primaryClassReplacesMembership(): boolean {
  return false;
}

export function followGrantsMessaging(): boolean {
  return false;
}

export function connectionRevealsPrivateFields(): boolean {
  return false;
}

export function membershipIsSocialRelationship(): boolean {
  return false;
}

export function blockRemovesEnrollment(): boolean {
  return blockRemovesInstitutionalRelationship('COURSE_ENROLLMENT');
}

export function personReportAutoSuspends(): boolean {
  return false;
}

export function profileShareReference(personId: string): { objectType: 'PERSON'; objectId: string } {
  return { objectType: 'PERSON', objectId: personId };
}

export function profilePhotoUsesFile(): boolean {
  return true;
}

export const OFFLINE_PROFILE_FIELDS: ProfileField[] = ['DISPLAY_NAME', 'USERNAME', 'PHOTO'];

export function offlineProfileMayCache(field: ProfileField): boolean {
  return OFFLINE_PROFILE_FIELDS.includes(field);
}

export function formerUserLabel(state: AccountLifecycleState, displayName: string | null): string {
  if (state === 'DELETED' || state === 'DELETION_PROCESSING') {
    return 'Former CampusOS User';
  }
  return authorAttribution({ state, displayName });
}

export function searchabilityIndependentOfVisibility(): boolean {
  return true;
}

export type PeopleSearchDocument = {
  displayName?: string;
  username?: string;
  programme?: string;
  registrationNumber?: string;
  phoneNumber?: string;
  legalName?: string;
};

export function peopleSearchForbiddenKeys(document: PeopleSearchDocument): string[] {
  return (Object.keys(document) as Array<keyof PeopleSearchDocument>).filter((key) =>
    ['registrationNumber', 'phoneNumber', 'legalName'].includes(key),
  );
}

export const PROFILE_ANALYTICS_EVENTS = [
  'profile_opened',
  'profile_shared',
  'profile_edited',
  'profile_photo_changed',
  'people_search_started',
  'people_searched',
  'person_followed',
  'person_unfollowed',
  'connection_requested',
  'connection_accepted',
  'connection_declined',
  'connection_removed',
  'person_blocked',
  'person_unblocked',
  'person_reported',
  'profile_privacy_changed',
];

export const PROFILE_ANALYTICS_FORBIDDEN = [
  'bio',
  'registrationNumber',
  'phoneNumber',
  'legalName',
  'contact',
];

export type ProfileSection =
  | 'HEADER'
  | 'ACADEMIC'
  | 'ORGANIZATIONS'
  | 'COURSES'
  | 'STUDY_GROUPS'
  | 'SERVICES'
  | 'POSTS'
  | 'CONNECTIONS';

export function visibleProfileSections(
  visibilities: Partial<Record<ProfileField, ProfileAudience>>,
  context: AudienceContext,
): ProfileSection[] {
  const sections: Array<{ section: ProfileSection; field: ProfileField }> = [
    { section: 'HEADER', field: 'DISPLAY_NAME' },
    { section: 'ACADEMIC', field: 'PROGRAMME' },
    { section: 'ORGANIZATIONS', field: 'ORGANIZATIONS' },
    { section: 'COURSES', field: 'COURSES' },
    { section: 'STUDY_GROUPS', field: 'STUDY_GROUPS' },
    { section: 'SERVICES', field: 'SERVICES' },
    { section: 'POSTS', field: 'POSTS' },
    { section: 'CONNECTIONS', field: 'CONNECTIONS' },
  ];
  return sections
    .filter((item) => fieldVisible({ field: item.field, visibility: visibilities[item.field], context }))
    .map((item) => item.section);
}
