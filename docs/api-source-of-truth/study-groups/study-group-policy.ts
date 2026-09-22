export type StudyGroupStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'CLOSED' | 'ARCHIVED';

const GROUP_TRANSITIONS: Record<StudyGroupStatus, StudyGroupStatus[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['INACTIVE', 'CLOSED', 'ARCHIVED'],
  INACTIVE: ['ACTIVE', 'CLOSED', 'ARCHIVED'],
  CLOSED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionStudyGroup(from: StudyGroupStatus, to: StudyGroupStatus): boolean {
  return GROUP_TRANSITIONS[from]?.includes(to) ?? false;
}

export function studyGroupDiscoverable(status: StudyGroupStatus): boolean {
  return status === 'ACTIVE' || status === 'INACTIVE';
}

export type StudyGroupVisibility =
  | 'PUBLIC'
  | 'CAMPUS_ONLY'
  | 'COURSE_MEMBERS_ONLY'
  | 'CLASS_MEMBERS_ONLY'
  | 'INVITE_ONLY'
  | 'COURSE_MEMBERS';

export function normalizeStudyGroupVisibility(value: string): StudyGroupVisibility {
  if (value === 'COURSE_MEMBERS') return 'COURSE_MEMBERS_ONLY';
  if (value === 'CLASS_MEMBERS') return 'CLASS_MEMBERS_ONLY';
  return value as StudyGroupVisibility;
}

export type JoinPolicy = 'OPEN' | 'REQUEST_TO_JOIN' | 'INVITE_ONLY' | 'RESTRICTED';

export function normalizeJoinPolicy(value: string): JoinPolicy {
  if (value === 'INVITATION_ONLY') return 'INVITE_ONLY';
  if (value === 'OPEN' || value === 'REQUEST_TO_JOIN' || value === 'INVITE_ONLY' || value === 'RESTRICTED') {
    return value;
  }
  return 'RESTRICTED';
}

export type MembershipState = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'ENDED' | 'WAITLISTED';

export type StudyGroupRole = 'MEMBER' | 'MODERATOR' | 'ADMIN';

export type EligibilityInput = {
  authenticated: boolean;
  status: StudyGroupStatus;
  visibility: string;
  joinPolicy: JoinPolicy | string;
  enrolledInCourse: boolean;
  memberOfClass: boolean;
  campusMember?: boolean;
  invited: boolean;
  memberCount: number;
  capacity: number | null;
};

export type JoinOutcome = 'JOINED' | 'PENDING' | 'WAITLISTED' | 'DENIED';

export function evaluateJoin(input: EligibilityInput): { outcome: JoinOutcome; reason?: string } {
  if (!input.authenticated) {
    return { outcome: 'DENIED', reason: 'Please sign in to continue.' };
  }
  if (input.status !== 'ACTIVE') {
    return { outcome: 'DENIED', reason: 'This study group is not accepting members.' };
  }
  const visibility = normalizeStudyGroupVisibility(input.visibility);
  const joinPolicy = normalizeJoinPolicy(input.joinPolicy);
  if (visibility === 'INVITE_ONLY' && !input.invited) {
    return { outcome: 'DENIED', reason: 'This group is invite-only.' };
  }
  if (visibility === 'CAMPUS_ONLY' && !input.campusMember) {
    return { outcome: 'DENIED', reason: 'Only campus members can join.' };
  }
  if (visibility === 'COURSE_MEMBERS_ONLY' && !input.enrolledInCourse) {
    return { outcome: 'DENIED', reason: 'Only students on this course can join.' };
  }
  if (visibility === 'CLASS_MEMBERS_ONLY' && !input.memberOfClass) {
    return { outcome: 'DENIED', reason: 'Only class members can join.' };
  }
  const atCapacity = input.capacity != null && input.memberCount >= input.capacity;
  if (joinPolicy === 'INVITE_ONLY' && !input.invited) {
    return { outcome: 'DENIED', reason: 'This group is invite-only.' };
  }
  if (joinPolicy === 'RESTRICTED' && !input.invited) {
    return { outcome: 'DENIED', reason: "You don't have permission to join this group." };
  }
  if (atCapacity) {
    return { outcome: 'WAITLISTED', reason: 'This group is full.' };
  }
  if (joinPolicy === 'REQUEST_TO_JOIN') {
    return { outcome: 'PENDING' };
  }
  return { outcome: 'JOINED' };
}

export function courseEnrollmentEqualsClassMembership(): boolean {
  return false;
}

export function studyGroupReplacesCourse(): boolean {
  return false;
}

export function studyGroupReplacesClass(): boolean {
  return false;
}

export function studyGroupAdministersCourse(): boolean {
  return false;
}

export function creatorIsPermanentOwner(): boolean {
  return false;
}

export function lastAdminMayLeaveWithoutTransfer(): boolean {
  return false;
}

export function groupDisappearsWhenCreatorLeaves(): boolean {
  return false;
}

export type StudyGroupAction =
  | 'VIEW'
  | 'JOIN'
  | 'LEAVE'
  | 'POST'
  | 'CHAT'
  | 'UPLOAD_RESOURCE'
  | 'CREATE_ACTIVITY'
  | 'MANAGE_MEMBERS'
  | 'MODERATE'
  | 'TRANSFER_ADMIN'
  | 'ARCHIVE';

export function studyGroupActions(input: {
  role: StudyGroupRole | null;
  membership: MembershipState | null;
  status: StudyGroupStatus;
}): StudyGroupAction[] {
  if (input.status === 'ARCHIVED') {
    return input.membership === 'ACTIVE' || input.membership === 'ENDED' ? ['VIEW'] : [];
  }
  if (input.membership !== 'ACTIVE' || !input.role) {
    return ['VIEW', 'JOIN'];
  }
  const actions: StudyGroupAction[] = ['VIEW', 'LEAVE', 'POST', 'CHAT'];
  if (input.status === 'ACTIVE') {
    actions.push('UPLOAD_RESOURCE', 'CREATE_ACTIVITY');
  }
  if (input.role === 'MODERATOR' || input.role === 'ADMIN') {
    actions.push('MODERATE', 'MANAGE_MEMBERS');
  }
  if (input.role === 'ADMIN') {
    actions.push('TRANSFER_ADMIN', 'ARCHIVE');
  }
  return actions;
}

export const CONVERSATION_KIND_STUDY_GROUP = 'STUDY_GROUP';
export const POST_CONTEXT_STUDY_GROUP = 'STUDY_GROUP';

export function chatIsPersistentKnowledge(): boolean {
  return false;
}

export function studyTaskReplacesAssignment(): boolean {
  return false;
}

export type StudyTaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export function resourceAccessAfterLeave(input: {
  stillMember: boolean;
  resourceVisibility: 'GROUP' | 'COURSE' | 'PUBLIC';
  enrolledInCourse: boolean;
}): boolean {
  if (input.resourceVisibility === 'PUBLIC') return true;
  if (input.resourceVisibility === 'COURSE') return input.enrolledInCourse;
  return input.stillMember;
}

export function endorsementChangesAuthorship(): boolean {
  return false;
}

export function uploaderIsAuthor(): boolean {
  return false;
}

export function groupVisibilityRevealsMemberProfiles(): boolean {
  return false;
}

export function moderatorReadsPrivateMessages(): boolean {
  return false;
}

export function studyGroupShareReference(studyGroupId: string): {
  objectType: 'STUDY_GROUP';
  objectId: string;
} {
  return { objectType: 'STUDY_GROUP', objectId: studyGroupId };
}

export type StudyGroupRouteTab = 'members' | 'resources' | 'posts' | 'chat' | 'manage';

export function studyGroupRoute(studyGroupId: string, tab?: StudyGroupRouteTab): string {
  const base = `/app/learn/study-group/${studyGroupId}`;
  return tab ? `${base}/${tab}` : base;
}

export const STUDY_GROUP_NOTIFICATION_TYPES = [
  'STUDY_GROUP_INVITATION',
  'STUDY_GROUP_JOIN_REQUEST',
  'STUDY_GROUP_JOIN_APPROVED',
  'STUDY_GROUP_POST',
  'STUDY_GROUP_MENTION',
  'STUDY_GROUP_RESOURCE',
  'STUDY_GROUP_ACTIVITY',
  'STUDY_GROUP_MESSAGE',
] as const;

export const STUDY_GROUP_REPORT_REASONS = [
  'SPAM',
  'HARASSMENT',
  'INAPPROPRIATE',
  'THREAT',
  'ACADEMIC_MISCONDUCT',
  'COPYRIGHT',
  'MISINFORMATION',
  'OTHER',
] as const;

export type StudyGroupOfflineAction =
  | 'VIEW_CACHED'
  | 'DRAFT_POST'
  | 'COMPOSE_MESSAGE'
  | 'PREPARE_UPLOAD'
  | 'JOIN'
  | 'LEAVE'
  | 'APPROVE_MEMBER'
  | 'REMOVE_MEMBER'
  | 'CREATE_ACTIVITY'
  | 'PUBLISH_RESOURCE'
  | 'ADMINISTRATE';

const ONLINE_ACTIONS: StudyGroupOfflineAction[] = [
  'JOIN',
  'LEAVE',
  'APPROVE_MEMBER',
  'REMOVE_MEMBER',
  'CREATE_ACTIVITY',
  'PUBLISH_RESOURCE',
  'ADMINISTRATE',
];

export function studyGroupActionRequiresOnline(action: StudyGroupOfflineAction): boolean {
  return ONLINE_ACTIONS.includes(action);
}

export function leavingDeletesHistory(): boolean {
  return false;
}

export function recommendStudyGroupIsAcademicDecision(): boolean {
  return false;
}

export const STUDY_GROUP_ANALYTICS_EVENTS = [
  'study_groups_opened',
  'study_group_opened',
  'study_group_created',
  'study_group_shared',
  'study_group_join_requested',
  'study_group_joined',
  'study_group_left',
  'study_group_post_created',
  'study_group_resource_opened',
  'study_group_resource_shared',
  'study_group_activity_opened',
  'study_group_task_created',
  'study_group_task_completed',
  'study_group_reported',
];

export const STUDY_GROUP_ANALYTICS_FORBIDDEN = ['messageBody', 'postBody', 'resourceContents'];
