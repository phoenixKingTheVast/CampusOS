import {
  approvalSatisfied,
  approvalState,
  approvalTierFor,
  canRecordApproval,
  requiredApprovals,
} from './approval-policy';

describe('class approval policy', () => {
  it('scales required approvals with the representative count', () => {
    expect(requiredApprovals('NORMAL', 3)).toBe(1);
    expect(requiredApprovals('SENSITIVE', 3)).toBe(2);
    expect(requiredApprovals('IRREVERSIBLE', 3)).toBe(3);
    expect(requiredApprovals('SENSITIVE', 1)).toBe(1);
  });

  it('treats removing a class member as sensitive', () => {
    expect(approvalTierFor('REMOVE_CLASS_MEMBER')).toBe('SENSITIVE');
    expect(approvalTierFor('APPROVE_CLASS_MEMBERSHIP')).toBe('NORMAL');
  });

  it('requires two of three representatives to remove a student', () => {
    const representativeIds = ['rep_a', 'rep_b', 'rep_c'];
    const oneApproval = approvalSatisfied({
      tier: 'SENSITIVE',
      representativeIds,
      targetPersonId: 'student_1',
      approvals: [{ approverId: 'rep_a', approvedAt: new Date() }],
    });
    const twoApprovals = approvalSatisfied({
      tier: 'SENSITIVE',
      representativeIds,
      targetPersonId: 'student_1',
      approvals: [
        { approverId: 'rep_a', approvedAt: new Date() },
        { approverId: 'rep_b', approvedAt: new Date() },
      ],
    });
    expect(oneApproval).toBe(false);
    expect(twoApprovals).toBe(true);
  });

  it('refuses duplicate approvals and self-approval by the target', () => {
    const representativeIds = ['rep_a', 'rep_b', 'rep_c'];
    expect(
      canRecordApproval({
        approverId: 'rep_a',
        representativeIds,
        targetPersonId: 'student_1',
        existing: [{ approverId: 'rep_a', approvedAt: new Date() }],
      }),
    ).toEqual({ allowed: false, reason: 'You have already approved this request.' });

    expect(
      canRecordApproval({
        approverId: 'rep_c',
        representativeIds,
        targetPersonId: 'rep_c',
        existing: [],
      }).allowed,
    ).toBe(false);

    expect(
      canRecordApproval({
        approverId: 'student_1',
        representativeIds,
        targetPersonId: 'student_2',
        existing: [],
      }).allowed,
    ).toBe(false);
  });

  it('expires an unresolved request after the approval window', () => {
    const createdAt = new Date('2026-09-10T08:00:00Z');
    expect(
      approvalState({
        approvals: [],
        tier: 'SENSITIVE',
        representativeIds: ['rep_a', 'rep_b', 'rep_c'],
        createdAt,
        now: new Date('2026-09-14T08:00:00Z'),
      }),
    ).toBe('EXPIRED');
    expect(
      approvalState({
        approvals: [],
        tier: 'SENSITIVE',
        representativeIds: ['rep_a', 'rep_b', 'rep_c'],
        createdAt,
        now: new Date('2026-09-11T08:00:00Z'),
      }),
    ).toBe('PENDING');
  });
});
