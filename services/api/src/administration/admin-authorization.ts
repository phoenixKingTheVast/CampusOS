export type AdminRole =
  | 'PLATFORM_ADMIN'
  | 'ACADEMIC_ADMIN'
  | 'CLASS_ADMIN'
  | 'ORGANIZATION_ADMIN'
  | 'SERVICE_ADMIN'
  | 'MODERATOR'
  | 'SUPPORT_ADMIN';

export type AdminScopeType =
  | 'GLOBAL'
  | 'PLATFORM'
  | 'UNIVERSITY'
  | 'FACULTY'
  | 'DEPARTMENT'
  | 'PROGRAMME'
  | 'CLASS'
  | 'COURSE'
  | 'COURSE_OFFERING'
  | 'ORGANIZATION'
  | 'SERVICE_PROVIDER'
  | 'SERVICE'
  | 'BOOKING'
  | 'MODERATION_CASE';

export type AdminLayer = 'PLATFORM' | 'UNIVERSITY' | 'CONTEXT';

export type AdminScope = {
  type: AdminScopeType;
  id: string | null;
};

export type RoleAssignmentStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type AdminRoleAssignment = {
  role: AdminRole;
  scope: AdminScope;
  status?: RoleAssignmentStatus;
  expiresAt?: Date | null;
  grantedBy?: string | null;
};

export type AdminAction =
  | 'VIEW_DASHBOARD'
  | 'VIEW_AUDIT'
  | 'VIEW_SYSTEM_HEALTH'
  | 'MANAGE_PLATFORM_SETTINGS'
  | 'ASSIGN_ADMIN_ROLE'
  | 'REVOKE_ADMIN_ROLE'
  | 'VIEW_PERSON'
  | 'RESTRICT_PERSON'
  | 'SUSPEND_PERSON'
  | 'REINSTATE_PERSON'
  | 'VIEW_STUDENT_VERIFICATION'
  | 'VIEW_VERIFICATION_EVIDENCE'
  | 'DECIDE_STUDENT_VERIFICATION'
  | 'MANAGE_ACADEMIC_STRUCTURE'
  | 'MANAGE_CLASS'
  | 'ASSIGN_CLASS_REPRESENTATIVE'
  | 'REMOVE_CLASS_MEMBER'
  | 'MANAGE_COURSE_OFFERING'
  | 'ASSIGN_COURSE_LECTURER'
  | 'APPROVE_ORGANIZATION'
  | 'MANAGE_ORGANIZATION'
  | 'SUSPEND_ORGANIZATION'
  | 'MODERATE_EVENT'
  | 'APPROVE_SERVICE_PROVIDER'
  | 'VIEW_PROVIDER_VERIFICATION_EVIDENCE'
  | 'SUSPEND_SERVICE_PROVIDER'
  | 'REVOKE_SERVICE_PROVIDER'
  | 'RESTRICT_SERVICE'
  | 'RESOLVE_BOOKING_DISPUTE'
  | 'VIEW_MODERATION_REPORT'
  | 'TRIAGE_MODERATION_REPORT'
  | 'VIEW_MODERATION_EVIDENCE'
  | 'RESOLVE_MODERATION_CASE'
  | 'REMOVE_CONTENT'
  | 'RESTRICT_CONTENT'
  | 'EXPORT_DATA';

const ROLE_ACTIONS: Record<AdminRole, AdminAction[]> = {
  PLATFORM_ADMIN: [
    'VIEW_DASHBOARD',
    'VIEW_AUDIT',
    'VIEW_SYSTEM_HEALTH',
    'MANAGE_PLATFORM_SETTINGS',
    'ASSIGN_ADMIN_ROLE',
    'REVOKE_ADMIN_ROLE',
    'VIEW_PERSON',
    'RESTRICT_PERSON',
    'SUSPEND_PERSON',
    'REINSTATE_PERSON',
    'APPROVE_ORGANIZATION',
    'SUSPEND_ORGANIZATION',
    'EXPORT_DATA',
  ],
  ACADEMIC_ADMIN: [
    'VIEW_DASHBOARD',
    'VIEW_PERSON',
    'VIEW_STUDENT_VERIFICATION',
    'VIEW_VERIFICATION_EVIDENCE',
    'DECIDE_STUDENT_VERIFICATION',
    'MANAGE_ACADEMIC_STRUCTURE',
    'MANAGE_CLASS',
    'ASSIGN_CLASS_REPRESENTATIVE',
    'REMOVE_CLASS_MEMBER',
    'MANAGE_COURSE_OFFERING',
    'ASSIGN_COURSE_LECTURER',
    'EXPORT_DATA',
  ],
  CLASS_ADMIN: ['VIEW_DASHBOARD', 'MANAGE_CLASS', 'REMOVE_CLASS_MEMBER'],
  ORGANIZATION_ADMIN: ['VIEW_DASHBOARD', 'MANAGE_ORGANIZATION', 'MODERATE_EVENT'],
  SERVICE_ADMIN: [
    'VIEW_DASHBOARD',
    'APPROVE_SERVICE_PROVIDER',
    'VIEW_PROVIDER_VERIFICATION_EVIDENCE',
    'SUSPEND_SERVICE_PROVIDER',
    'REVOKE_SERVICE_PROVIDER',
    'RESTRICT_SERVICE',
    'RESOLVE_BOOKING_DISPUTE',
  ],
  MODERATOR: [
    'VIEW_DASHBOARD',
    'VIEW_MODERATION_REPORT',
    'TRIAGE_MODERATION_REPORT',
    'VIEW_MODERATION_EVIDENCE',
    'RESOLVE_MODERATION_CASE',
    'REMOVE_CONTENT',
    'RESTRICT_CONTENT',
    'MODERATE_EVENT',
  ],
  SUPPORT_ADMIN: ['VIEW_DASHBOARD', 'VIEW_PERSON', 'VIEW_STUDENT_VERIFICATION'],
};

const SCOPE_PARENTS: Record<AdminScopeType, AdminScopeType[]> = {
  GLOBAL: [],
  PLATFORM: [],
  UNIVERSITY: ['GLOBAL', 'PLATFORM'],
  FACULTY: ['UNIVERSITY', 'PLATFORM', 'GLOBAL'],
  DEPARTMENT: ['FACULTY', 'UNIVERSITY', 'PLATFORM', 'GLOBAL'],
  PROGRAMME: ['DEPARTMENT', 'FACULTY', 'UNIVERSITY', 'PLATFORM', 'GLOBAL'],
  CLASS: ['PROGRAMME', 'DEPARTMENT', 'FACULTY', 'UNIVERSITY', 'PLATFORM', 'GLOBAL'],
  COURSE: ['DEPARTMENT', 'FACULTY', 'UNIVERSITY', 'PLATFORM', 'GLOBAL'],
  COURSE_OFFERING: ['COURSE', 'DEPARTMENT', 'FACULTY', 'UNIVERSITY', 'PLATFORM', 'GLOBAL'],
  ORGANIZATION: ['UNIVERSITY', 'PLATFORM', 'GLOBAL'],
  SERVICE_PROVIDER: ['PLATFORM', 'GLOBAL'],
  SERVICE: ['SERVICE_PROVIDER', 'PLATFORM', 'GLOBAL'],
  BOOKING: ['SERVICE', 'SERVICE_PROVIDER', 'PLATFORM', 'GLOBAL'],
  MODERATION_CASE: ['PLATFORM', 'GLOBAL'],
};

const HIGH_IMPACT = new Set<AdminAction>([
  'ASSIGN_ADMIN_ROLE',
  'REVOKE_ADMIN_ROLE',
  'SUSPEND_PERSON',
  'REMOVE_CLASS_MEMBER',
  'SUSPEND_ORGANIZATION',
  'SUSPEND_SERVICE_PROVIDER',
  'REVOKE_SERVICE_PROVIDER',
  'MANAGE_PLATFORM_SETTINGS',
  'EXPORT_DATA',
]);

const DUAL_APPROVAL = new Set<AdminAction>([
  'ASSIGN_ADMIN_ROLE',
  'REVOKE_ADMIN_ROLE',
  'SUSPEND_PERSON',
  'REVOKE_SERVICE_PROVIDER',
]);

const REAUTHENTICATION = new Set<AdminAction>([
  'ASSIGN_ADMIN_ROLE',
  'REVOKE_ADMIN_ROLE',
  'SUSPEND_PERSON',
  'REVOKE_SERVICE_PROVIDER',
  'SUSPEND_ORGANIZATION',
  'VIEW_VERIFICATION_EVIDENCE',
  'VIEW_PROVIDER_VERIFICATION_EVIDENCE',
  'EXPORT_DATA',
  'MANAGE_PLATFORM_SETTINGS',
]);

export const ADMIN_AUDIT_EVENTS: Record<AdminAction, string> = {
  VIEW_DASHBOARD: 'ADMIN_DASHBOARD_VIEWED',
  VIEW_AUDIT: 'ADMIN_AUDIT_VIEWED',
  VIEW_SYSTEM_HEALTH: 'ADMIN_SYSTEM_HEALTH_VIEWED',
  MANAGE_PLATFORM_SETTINGS: 'PLATFORM_SETTINGS_CHANGED',
  ASSIGN_ADMIN_ROLE: 'USER_ROLE_GRANTED',
  REVOKE_ADMIN_ROLE: 'USER_ROLE_REVOKED',
  VIEW_PERSON: 'ADMIN_PERSON_VIEWED',
  RESTRICT_PERSON: 'PERSON_RESTRICTED',
  SUSPEND_PERSON: 'PERSON_SUSPENDED',
  REINSTATE_PERSON: 'PERSON_REINSTATED',
  VIEW_STUDENT_VERIFICATION: 'VERIFICATION_CASE_VIEWED',
  VIEW_VERIFICATION_EVIDENCE: 'VERIFICATION_EVIDENCE_ACCESSED',
  DECIDE_STUDENT_VERIFICATION: 'VERIFICATION_DECIDED',
  MANAGE_ACADEMIC_STRUCTURE: 'ACADEMIC_STRUCTURE_CHANGED',
  MANAGE_CLASS: 'CLASS_UPDATED',
  ASSIGN_CLASS_REPRESENTATIVE: 'CLASS_REPRESENTATIVE_ASSIGNED',
  REMOVE_CLASS_MEMBER: 'CLASS_MEMBER_REMOVED',
  MANAGE_COURSE_OFFERING: 'COURSE_OFFERING_UPDATED',
  ASSIGN_COURSE_LECTURER: 'COURSE_LECTURER_ASSIGNED',
  APPROVE_ORGANIZATION: 'ORGANIZATION_APPROVED',
  MANAGE_ORGANIZATION: 'ORGANIZATION_UPDATED',
  SUSPEND_ORGANIZATION: 'ORGANIZATION_SUSPENDED',
  MODERATE_EVENT: 'EVENT_MODERATED',
  APPROVE_SERVICE_PROVIDER: 'SERVICE_PROVIDER_APPROVED',
  VIEW_PROVIDER_VERIFICATION_EVIDENCE: 'PROVIDER_VERIFICATION_EVIDENCE_ACCESSED',
  SUSPEND_SERVICE_PROVIDER: 'SERVICE_PROVIDER_SUSPENDED',
  REVOKE_SERVICE_PROVIDER: 'SERVICE_PROVIDER_REVOKED',
  RESTRICT_SERVICE: 'SERVICE_RESTRICTED',
  RESOLVE_BOOKING_DISPUTE: 'BOOKING_DISPUTE_RESOLVED',
  VIEW_MODERATION_REPORT: 'MODERATION_REPORT_VIEWED',
  TRIAGE_MODERATION_REPORT: 'MODERATION_REPORT_TRIAGED',
  VIEW_MODERATION_EVIDENCE: 'MODERATION_EVIDENCE_ACCESSED',
  RESOLVE_MODERATION_CASE: 'MODERATION_CASE_RESOLVED',
  REMOVE_CONTENT: 'CONTENT_REMOVED',
  RESTRICT_CONTENT: 'CONTENT_RESTRICTED',
  EXPORT_DATA: 'DATA_EXPORTED',
};

export type AdminDecision = {
  allowed: boolean;
  reason?: string;
  requiresReauthentication: boolean;
  requiresDualApproval: boolean;
  auditEvent: string;
};

export function isHighImpact(action: AdminAction): boolean {
  return HIGH_IMPACT.has(action);
}

export function normalizeAdminScope(scope: AdminScope): AdminScope {
  if (scope.type === 'GLOBAL') {
    return { type: 'PLATFORM', id: scope.id };
  }
  return scope;
}

export function assignmentAuthorizes(assignment: AdminRoleAssignment, now = new Date()): boolean {
  if (assignment.status === 'REVOKED' || assignment.status === 'EXPIRED') {
    return false;
  }
  if (assignment.expiresAt && assignment.expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

export function adminLayerFor(role: AdminRole): AdminLayer {
  if (role === 'PLATFORM_ADMIN' || role === 'MODERATOR' || role === 'SUPPORT_ADMIN') {
    return 'PLATFORM';
  }
  if (role === 'ACADEMIC_ADMIN') {
    return 'UNIVERSITY';
  }
  return 'CONTEXT';
}

export function scopeCovers(granted: AdminScope, target: AdminScope, targetAncestors: AdminScope[] = []): boolean {
  const normalizedGranted = normalizeAdminScope(granted);
  if ((normalizedGranted.type === 'PLATFORM' || granted.type === 'GLOBAL') && normalizedGranted.id === null) {
    return true;
  }
  const candidates = [target, ...targetAncestors].map(normalizeAdminScope);
  return candidates.some((candidate) => {
    if (candidate.type !== normalizedGranted.type) {
      return false;
    }
    return normalizedGranted.id === null || normalizedGranted.id === candidate.id;
  });
}

export function scopeAncestorTypes(type: AdminScopeType): AdminScopeType[] {
  return SCOPE_PARENTS[type] ?? [];
}

export function authorizeAdminAction(input: {
  assignments: AdminRoleAssignment[];
  action: AdminAction;
  target: AdminScope;
  targetAncestors?: AdminScope[];
  reauthenticatedAt?: Date | null;
  now?: Date;
  reauthenticationWindowMs?: number;
}): AdminDecision {
  const auditEvent = ADMIN_AUDIT_EVENTS[input.action];
  const requiresDualApproval = DUAL_APPROVAL.has(input.action);
  const requiresReauthentication = REAUTHENTICATION.has(input.action);
  const base = { requiresReauthentication, requiresDualApproval, auditEvent };
  const now = input.now ?? new Date();

  const carriers = input.assignments.filter(
    (assignment) => assignmentAuthorizes(assignment, now) && ROLE_ACTIONS[assignment.role]?.includes(input.action),
  );
  if (carriers.length === 0) {
    return { ...base, allowed: false, reason: "You don't have permission to do that." };
  }

  const inScope = carriers.some((assignment) =>
    scopeCovers(assignment.scope, input.target, input.targetAncestors ?? []),
  );
  if (!inScope) {
    return { ...base, allowed: false, reason: 'That item is outside your administrative scope.' };
  }

  if (requiresReauthentication) {
    const window = input.reauthenticationWindowMs ?? 5 * 60 * 1000;
    const confirmedAt = input.reauthenticatedAt;
    if (!confirmedAt || now.getTime() - confirmedAt.getTime() > window) {
      return { ...base, allowed: false, reason: 'Confirm your identity to continue.' };
    }
  }

  return { ...base, allowed: true };
}

export function adminActionsForRole(role: AdminRole): AdminAction[] {
  return [...ROLE_ACTIONS[role]];
}
