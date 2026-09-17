import {
  ADMIN_AUDIT_EVENTS,
  AdminAction,
  AdminRole,
  adminActionsForRole,
  authorizeAdminAction,
  scopeCovers,
} from './admin-authorization';

const ROLES: AdminRole[] = [
  'PLATFORM_ADMIN',
  'ACADEMIC_ADMIN',
  'CLASS_ADMIN',
  'ORGANIZATION_ADMIN',
  'SERVICE_ADMIN',
  'MODERATOR',
  'SUPPORT_ADMIN',
];

describe('admin authorization', () => {
  it('gives every administrative capability an audit event and at least one role', () => {
    const actions = Object.keys(ADMIN_AUDIT_EVENTS) as AdminAction[];
    const granted = new Set(ROLES.flatMap(adminActionsForRole));
    const orphaned = actions.filter((action) => !granted.has(action));
    expect(orphaned).toEqual([]);
    for (const action of actions) {
      expect(ADMIN_AUDIT_EVENTS[action]).toBeTruthy();
    }
  });

  it('confines a class representative to their own class', () => {
    const assignments = [
      { role: 'CLASS_ADMIN' as AdminRole, scope: { type: 'CLASS' as const, id: 'class_eee41' } },
    ];
    const own = authorizeAdminAction({
      assignments,
      action: 'MANAGE_CLASS',
      target: { type: 'CLASS', id: 'class_eee41' },
    });
    const other = authorizeAdminAction({
      assignments,
      action: 'MANAGE_CLASS',
      target: { type: 'CLASS', id: 'class_eee42' },
      targetAncestors: [{ type: 'PROGRAMME', id: 'programme_bsceee' }],
    });
    expect(own.allowed).toBe(true);
    expect(other.allowed).toBe(false);
    expect(other.reason).toBe('That item is outside your administrative scope.');
  });

  it('does not let a moderator suspend an account', () => {
    const decision = authorizeAdminAction({
      assignments: [{ role: 'MODERATOR', scope: { type: 'PLATFORM', id: null } }],
      action: 'SUSPEND_PERSON',
      target: { type: 'PLATFORM', id: null },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("You don't have permission to do that.");
  });

  it('requires recent re-authentication before viewing verification evidence', () => {
    const assignments = [
      { role: 'ACADEMIC_ADMIN' as AdminRole, scope: { type: 'FACULTY' as const, id: 'faculty_eng' } },
    ];
    const now = new Date('2026-09-16T10:00:00Z');
    const target = { type: 'PROGRAMME' as const, id: 'programme_bsceee' };
    const ancestors = [{ type: 'FACULTY' as const, id: 'faculty_eng' }];

    const stale = authorizeAdminAction({
      assignments,
      action: 'VIEW_VERIFICATION_EVIDENCE',
      target,
      targetAncestors: ancestors,
      reauthenticatedAt: new Date('2026-09-16T09:00:00Z'),
      now,
    });
    const fresh = authorizeAdminAction({
      assignments,
      action: 'VIEW_VERIFICATION_EVIDENCE',
      target,
      targetAncestors: ancestors,
      reauthenticatedAt: new Date('2026-09-16T09:58:00Z'),
      now,
    });

    expect(stale.allowed).toBe(false);
    expect(stale.reason).toBe('Confirm your identity to continue.');
    expect(fresh.allowed).toBe(true);
    expect(fresh.requiresReauthentication).toBe(true);
  });

  it('flags dual approval for role assignment', () => {
    const decision = authorizeAdminAction({
      assignments: [{ role: 'PLATFORM_ADMIN', scope: { type: 'PLATFORM', id: null } }],
      action: 'ASSIGN_ADMIN_ROLE',
      target: { type: 'PLATFORM', id: null },
      reauthenticatedAt: new Date(),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresDualApproval).toBe(true);
    expect(decision.auditEvent).toBe('USER_ROLE_GRANTED');
  });

  it('treats a faculty scope as covering a class beneath it', () => {
    expect(
      scopeCovers({ type: 'FACULTY', id: 'faculty_eng' }, { type: 'CLASS', id: 'class_eee41' }, [
        { type: 'PROGRAMME', id: 'programme_bsceee' },
        { type: 'FACULTY', id: 'faculty_eng' },
      ]),
    ).toBe(true);
    expect(
      scopeCovers({ type: 'FACULTY', id: 'faculty_law' }, { type: 'CLASS', id: 'class_eee41' }, [
        { type: 'FACULTY', id: 'faculty_eng' },
      ]),
    ).toBe(false);
    expect(scopeCovers({ type: 'GLOBAL', id: null }, { type: 'CLASS', id: 'class_eee41' })).toBe(true);
  });
});
