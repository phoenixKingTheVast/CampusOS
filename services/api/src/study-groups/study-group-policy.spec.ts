import {
  canTransitionStudyGroup,
  chatIsPersistentKnowledge,
  courseEnrollmentEqualsClassMembership,
  creatorIsPermanentOwner,
  endorsementChangesAuthorship,
  evaluateJoin,
  groupDisappearsWhenCreatorLeaves,
  groupVisibilityRevealsMemberProfiles,
  lastAdminMayLeaveWithoutTransfer,
  leavingDeletesHistory,
  moderatorReadsPrivateMessages,
  recommendStudyGroupIsAcademicDecision,
  resourceAccessAfterLeave,
  studyGroupActionRequiresOnline,
  studyGroupActions,
  studyGroupAdministersCourse,
  studyGroupDiscoverable,
  studyGroupReplacesClass,
  studyGroupReplacesCourse,
  studyGroupShareReference,
  studyGroupRoute,
  studyTaskReplacesAssignment,
  uploaderIsAuthor,
  STUDY_GROUP_NOTIFICATION_TYPES,
  STUDY_GROUP_REPORT_REASONS,
} from './study-group-policy';

const eligible = {
  authenticated: true,
  status: 'ACTIVE' as const,
  visibility: 'COURSE_MEMBERS',
  joinPolicy: 'OPEN' as const,
  enrolledInCourse: true,
  memberOfClass: false,
  invited: false,
  memberCount: 11,
  capacity: 20,
};

describe('study group policy', () => {
  it('keeps study groups from impersonating a course or replacing a class', () => {
    expect(studyGroupReplacesCourse()).toBe(false);
    expect(studyGroupReplacesClass()).toBe(false);
    expect(studyGroupAdministersCourse()).toBe(false);
    expect(courseEnrollmentEqualsClassMembership()).toBe(false);
    expect(studyTaskReplacesAssignment()).toBe(false);
  });

  it('supports a quiet close without deleting history', () => {
    expect(canTransitionStudyGroup('ACTIVE', 'INACTIVE')).toBe(true);
    expect(canTransitionStudyGroup('ACTIVE', 'CLOSED')).toBe(true);
    expect(canTransitionStudyGroup('CLOSED', 'ACTIVE')).toBe(false);
    expect(studyGroupDiscoverable('ACTIVE')).toBe(true);
    expect(studyGroupDiscoverable('ARCHIVED')).toBe(false);
    expect(leavingDeletesHistory()).toBe(false);
  });

  it('lets enrolled course members join an open group and waitlists when full', () => {
    expect(evaluateJoin(eligible).outcome).toBe('JOINED');
    expect(evaluateJoin({ ...eligible, enrolledInCourse: false }).outcome).toBe('DENIED');
    expect(evaluateJoin({ ...eligible, joinPolicy: 'REQUEST_TO_JOIN' }).outcome).toBe('PENDING');
    expect(evaluateJoin({ ...eligible, memberCount: 20, capacity: 20 }).outcome).toBe('WAITLISTED');
    expect(evaluateJoin({ ...eligible, visibility: 'INVITE_ONLY', invited: false }).outcome).toBe('DENIED');
    expect(evaluateJoin({ ...eligible, capacity: null, memberCount: 400 }).outcome).toBe('JOINED');
    expect(
      evaluateJoin({
        ...eligible,
        visibility: 'CAMPUS_ONLY',
        enrolledInCourse: false,
        campusMember: true,
      }).outcome,
    ).toBe('JOINED');
    expect(
      evaluateJoin({
        ...eligible,
        visibility: 'CAMPUS_ONLY',
        enrolledInCourse: false,
        campusMember: false,
      }).outcome,
    ).toBe('DENIED');
    expect(
      evaluateJoin({
        ...eligible,
        visibility: 'CLASS_MEMBERS_ONLY',
        memberOfClass: true,
        enrolledInCourse: false,
      }).outcome,
    ).toBe('JOINED');
  });

  it('allows cross-class groups when the person is on the course offering', () => {
    expect(
      evaluateJoin({
        ...eligible,
        visibility: 'COURSE_MEMBERS_ONLY',
        enrolledInCourse: true,
        memberOfClass: false,
      }).outcome,
    ).toBe('JOINED');
    expect(courseEnrollmentEqualsClassMembership()).toBe(false);
  });

  it('does not make the creator a permanent owner or collapse the group when they leave', () => {
    expect(creatorIsPermanentOwner()).toBe(false);
    expect(groupDisappearsWhenCreatorLeaves()).toBe(false);
    expect(lastAdminMayLeaveWithoutTransfer()).toBe(false);
  });

  it('scopes admin tools to the group, not the course or private DMs', () => {
    const admin = studyGroupActions({ role: 'ADMIN', membership: 'ACTIVE', status: 'ACTIVE' });
    expect(admin).toEqual(
      expect.arrayContaining(['MANAGE_MEMBERS', 'MODERATE', 'TRANSFER_ADMIN', 'CHAT', 'POST']),
    );
    expect(studyGroupAdministersCourse()).toBe(false);
    expect(moderatorReadsPrivateMessages()).toBe(false);
    expect(groupVisibilityRevealsMemberProfiles()).toBe(false);
  });

  it('keeps chat, posts, resources and assignments on their canonical objects', () => {
    expect(chatIsPersistentKnowledge()).toBe(false);
    expect(uploaderIsAuthor()).toBe(false);
    expect(endorsementChangesAuthorship()).toBe(false);
    expect(studyTaskReplacesAssignment()).toBe(false);
    expect(studyGroupShareReference('sg_pe')).toEqual({ objectType: 'STUDY_GROUP', objectId: 'sg_pe' });
    expect(studyGroupRoute('sg_pe')).toBe('/app/learn/study-group/sg_pe');
    expect(studyGroupRoute('sg_pe', 'chat')).toBe('/app/learn/study-group/sg_pe/chat');
    expect(STUDY_GROUP_NOTIFICATION_TYPES).toEqual(
      expect.arrayContaining(['STUDY_GROUP_INVITATION', 'STUDY_GROUP_MESSAGE', 'STUDY_GROUP_POST']),
    );
    expect(STUDY_GROUP_REPORT_REASONS).toEqual(expect.arrayContaining(['SPAM', 'ACADEMIC_MISCONDUCT', 'COPYRIGHT']));
  });

  it('revokes group-only resources when membership ends', () => {
    expect(
      resourceAccessAfterLeave({ stillMember: false, resourceVisibility: 'GROUP', enrolledInCourse: true }),
    ).toBe(false);
    expect(
      resourceAccessAfterLeave({ stillMember: false, resourceVisibility: 'COURSE', enrolledInCourse: true }),
    ).toBe(true);
  });

  it('requires a live connection for join, moderation and protected publishes', () => {
    expect(studyGroupActionRequiresOnline('VIEW_CACHED')).toBe(false);
    expect(studyGroupActionRequiresOnline('DRAFT_POST')).toBe(false);
    expect(studyGroupActionRequiresOnline('JOIN')).toBe(true);
    expect(studyGroupActionRequiresOnline('REMOVE_MEMBER')).toBe(true);
    expect(studyGroupActionRequiresOnline('PUBLISH_RESOURCE')).toBe(true);
    expect(recommendStudyGroupIsAcademicDecision()).toBe(false);
  });
});
