export type ReportState = 'SUBMITTED' | 'TRIAGED' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export type CaseState = 'OPEN' | 'ASSIGNED' | 'UNDER_REVIEW' | 'AWAITING_APPROVAL' | 'RESOLVED';

export type ModerationReasonKey =
  | 'SPAM'
  | 'HARASSMENT'
  | 'THREATENING_CONTENT'
  | 'INAPPROPRIATE'
  | 'IMPERSONATION'
  | 'ACADEMIC_MISCONDUCT'
  | 'COPYRIGHT'
  | 'FRAUD'
  | 'SAFETY_CONCERN'
  | 'MISLEADING'
  | 'OTHER';

export type ModerationDecision =
  | 'DISMISS'
  | 'WARN'
  | 'RESTRICT_CONTENT'
  | 'REMOVE_CONTENT'
  | 'RESTRICT_USER'
  | 'SUSPEND_USER'
  | 'SUSPEND_SERVICE'
  | 'SUSPEND_ORGANIZATION'
  | 'REFER';

export type ModerationTargetType =
  | 'MESSAGE'
  | 'DISCUSSION'
  | 'DISCUSSION_REPLY'
  | 'ORGANIZATION_POST'
  | 'RESOURCE'
  | 'EVENT'
  | 'PERSON'
  | 'SERVICE'
  | 'SERVICE_REVIEW'
  | 'BOOKING';

const REPORT_TRANSITIONS: Record<ReportState, ReportState[]> = {
  SUBMITTED: ['TRIAGED', 'DISMISSED'],
  TRIAGED: ['UNDER_REVIEW', 'DISMISSED'],
  UNDER_REVIEW: ['RESOLVED', 'DISMISSED'],
  RESOLVED: [],
  DISMISSED: [],
};

const CASE_TRANSITIONS: Record<CaseState, CaseState[]> = {
  OPEN: ['ASSIGNED', 'RESOLVED'],
  ASSIGNED: ['UNDER_REVIEW', 'OPEN', 'RESOLVED'],
  UNDER_REVIEW: ['AWAITING_APPROVAL', 'RESOLVED'],
  AWAITING_APPROVAL: ['RESOLVED', 'UNDER_REVIEW'],
  RESOLVED: [],
};

const DECISIONS_REQUIRING_APPROVAL = new Set<ModerationDecision>([
  'SUSPEND_USER',
  'SUSPEND_SERVICE',
  'SUSPEND_ORGANIZATION',
]);

const MODERATOR_DECISIONS = new Set<ModerationDecision>([
  'DISMISS',
  'WARN',
  'RESTRICT_CONTENT',
  'REMOVE_CONTENT',
  'REFER',
]);

export function canTransitionReport(from: ReportState, to: ReportState): boolean {
  return REPORT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionCase(from: CaseState, to: CaseState): boolean {
  return CASE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function decisionRequiresApproval(decision: ModerationDecision): boolean {
  return DECISIONS_REQUIRING_APPROVAL.has(decision);
}

export function decisionAvailableTo(
  decision: ModerationDecision,
  capabilities: { canRestrictUser: boolean; canSuspendUser: boolean; canSuspendProvider: boolean; canSuspendOrganization: boolean },
): boolean {
  if (MODERATOR_DECISIONS.has(decision)) {
    return true;
  }
  if (decision === 'RESTRICT_USER') return capabilities.canRestrictUser;
  if (decision === 'SUSPEND_USER') return capabilities.canSuspendUser;
  if (decision === 'SUSPEND_SERVICE') return capabilities.canSuspendProvider;
  if (decision === 'SUSPEND_ORGANIZATION') return capabilities.canSuspendOrganization;
  return false;
}

export function decisionRequiresReason(decision: ModerationDecision): boolean {
  return decision !== 'DISMISS';
}

export const MESSAGE_EVIDENCE_CONTEXT = 5;

export type MessageEvidenceScope = {
  conversationId: string;
  messageIds: string[];
  beforeLimit: number;
  afterLimit: number;
};

export function messageEvidenceScope(input: {
  conversationId: string;
  reportedMessageId: string;
  conversationMessageIds: string[];
  context?: number;
}): MessageEvidenceScope {
  const context = input.context ?? MESSAGE_EVIDENCE_CONTEXT;
  const index = input.conversationMessageIds.indexOf(input.reportedMessageId);
  if (index === -1) {
    return {
      conversationId: input.conversationId,
      messageIds: [input.reportedMessageId],
      beforeLimit: 0,
      afterLimit: 0,
    };
  }
  const start = Math.max(0, index - context);
  const end = Math.min(input.conversationMessageIds.length, index + context + 1);
  return {
    conversationId: input.conversationId,
    messageIds: input.conversationMessageIds.slice(start, end),
    beforeLimit: index - start,
    afterLimit: end - index - 1,
  };
}

export function evidenceReadable(input: {
  scope: MessageEvidenceScope;
  conversationId: string;
  messageId: string;
}): boolean {
  if (input.conversationId !== input.scope.conversationId) {
    return false;
  }
  return input.scope.messageIds.includes(input.messageId);
}

export function reporterIdentityVisible(targetType: ModerationTargetType): boolean {
  return targetType !== 'PERSON';
}
