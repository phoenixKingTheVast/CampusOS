export type ApprovalTier = 'NORMAL' | 'SENSITIVE' | 'IRREVERSIBLE';

export type ApprovalRequestState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

const CLASS_ACTION_TIERS: Record<string, ApprovalTier> = {
  APPROVE_CLASS_MEMBERSHIP: 'NORMAL',
  REJECT_CLASS_MEMBERSHIP: 'NORMAL',
  PUBLISH_CLASS_ANNOUNCEMENT: 'NORMAL',
  REMOVE_CLASS_MEMBER: 'SENSITIVE',
  ASSIGN_CLASS_REPRESENTATIVE: 'SENSITIVE',
  REMOVE_CLASS_REPRESENTATIVE: 'SENSITIVE',
  ARCHIVE_CLASS: 'IRREVERSIBLE',
};

export function approvalTierFor(action: string): ApprovalTier {
  return CLASS_ACTION_TIERS[action] ?? 'NORMAL';
}

export function requiredApprovals(tier: ApprovalTier, representativeCount: number): number {
  const total = Math.max(1, representativeCount);
  switch (tier) {
    case 'NORMAL':
      return 1;
    case 'SENSITIVE':
      return Math.min(total, Math.ceil((total * 2) / 3));
    case 'IRREVERSIBLE':
      return total;
    default:
      return 1;
  }
}

export type ApprovalRecord = {
  approverId: string;
  approvedAt: Date;
  reason?: string | null;
};

export function eligibleApprovers(input: {
  representativeIds: string[];
  targetPersonId?: string | null;
}): string[] {
  return input.representativeIds.filter((id) => id !== input.targetPersonId);
}

export function canRecordApproval(input: {
  approverId: string;
  representativeIds: string[];
  targetPersonId?: string | null;
  existing: ApprovalRecord[];
}): { allowed: boolean; reason?: string } {
  if (!input.representativeIds.includes(input.approverId)) {
    return { allowed: false, reason: "You don't have permission to do that." };
  }
  if (input.approverId === input.targetPersonId) {
    return { allowed: false, reason: 'You cannot approve an action that targets you.' };
  }
  if (input.existing.some((record) => record.approverId === input.approverId)) {
    return { allowed: false, reason: 'You have already approved this request.' };
  }
  return { allowed: true };
}

export function approvalSatisfied(input: {
  tier: ApprovalTier;
  representativeIds: string[];
  targetPersonId?: string | null;
  approvals: ApprovalRecord[];
}): boolean {
  const eligible = eligibleApprovers({
    representativeIds: input.representativeIds,
    targetPersonId: input.targetPersonId,
  });
  const distinct = new Set(
    input.approvals.map((record) => record.approverId).filter((id) => eligible.includes(id)),
  );
  return distinct.size >= requiredApprovals(input.tier, input.representativeIds.length);
}

export function approvalExpiry(createdAt: Date, hours = 72): Date {
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

export function approvalState(input: {
  approvals: ApprovalRecord[];
  tier: ApprovalTier;
  representativeIds: string[];
  targetPersonId?: string | null;
  createdAt: Date;
  now?: Date;
  cancelled?: boolean;
  rejected?: boolean;
}): ApprovalRequestState {
  if (input.cancelled) {
    return 'CANCELLED';
  }
  if (input.rejected) {
    return 'REJECTED';
  }
  if (approvalSatisfied(input)) {
    return 'APPROVED';
  }
  const now = input.now ?? new Date();
  if (now > approvalExpiry(input.createdAt)) {
    return 'EXPIRED';
  }
  return 'PENDING';
}
