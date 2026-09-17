export type IndexableObjectType =
  | 'PERSON'
  | 'CLASS'
  | 'COURSE'
  | 'COURSE_OFFERING'
  | 'ORGANIZATION'
  | 'EVENT'
  | 'RESOURCE'
  | 'STUDY_GROUP'
  | 'SERVICE'
  | 'LOCATION';

export type SearchDocument = {
  objectType: IndexableObjectType;
  objectId: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  searchableMetadata: Record<string, string | number | boolean | null>;
  context?: string | null;
  visibility: string;
  lifecycleState: string;
  searchTokens: string[];
  rankingMetadata: Record<string, number>;
};

export const NEVER_INDEXED_FIELDS = [
  'registrationNumber',
  'phoneNumber',
  'phone',
  'verificationEvidence',
  'evidenceFileId',
  'studentIdImage',
  'refreshTokenHash',
  'pushToken',
  'otpHash',
  'internalNote',
  'providerNote',
  'moderationNote',
  'auditMetadata',
  'messageBody',
];

export function forbiddenIndexFields(document: { searchableMetadata: Record<string, unknown> }): string[] {
  const forbidden = new Set(NEVER_INDEXED_FIELDS.map((field) => field.toLowerCase()));
  return Object.keys(document.searchableMetadata).filter((key) => forbidden.has(key.toLowerCase()));
}

const DISCOVERABLE_STATES: Record<IndexableObjectType, string[]> = {
  PERSON: ['ACTIVE', 'RESTRICTED'],
  CLASS: ['ACTIVE'],
  COURSE: ['ACTIVE'],
  COURSE_OFFERING: ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
  ORGANIZATION: ['ACTIVE'],
  EVENT: ['PUBLISHED', 'ONGOING', 'COMPLETED'],
  RESOURCE: ['ACTIVE', 'PUBLISHED'],
  STUDY_GROUP: ['ACTIVE', 'INACTIVE'],
  SERVICE: ['PUBLISHED', 'AVAILABLE'],
  LOCATION: ['ACTIVE', 'TEMPORARILY_CLOSED', 'RESTRICTED'],
};

export function isDiscoverableState(objectType: IndexableObjectType, lifecycleState: string): boolean {
  return DISCOVERABLE_STATES[objectType]?.includes(lifecycleState) ?? false;
}

export type IndexOperation = 'UPSERT' | 'REMOVE';

export function indexOperationFor(input: {
  objectType: IndexableObjectType;
  lifecycleState: string;
}): IndexOperation {
  return isDiscoverableState(input.objectType, input.lifecycleState) ? 'UPSERT' : 'REMOVE';
}

export type SearchProvider = {
  name: string;
  upsert(document: SearchDocument): Promise<void>;
  remove(objectType: IndexableObjectType, objectId: string): Promise<void>;
  query(input: { query: string; types: IndexableObjectType[]; limit: number }): Promise<SearchDocument[]>;
};

export type RankingContext = {
  query: string;
  enrolledOfferingIds: string[];
  classIds: string[];
  organizationIds: string[];
};

export type RankingCandidate = {
  objectType: IndexableObjectType;
  objectId: string;
  title: string;
  code?: string | null;
  courseOfferingId?: string | null;
  classId?: string | null;
  organizationId?: string | null;
  historical?: boolean;
  startsAt?: Date | null;
};

export function relevanceScore(candidate: RankingCandidate, context: RankingContext): number {
  const query = context.query.trim().toLowerCase();
  const title = candidate.title.toLowerCase();
  const code = candidate.code?.toLowerCase();

  let score = 0;
  if (code && code === query) {
    score += 120;
  }
  if (title === query) {
    score += 100;
  } else if (title.startsWith(query)) {
    score += 60;
  } else if (title.includes(query)) {
    score += 30;
  }

  if (candidate.courseOfferingId && context.enrolledOfferingIds.includes(candidate.courseOfferingId)) {
    score += 25;
  }
  if (candidate.classId && context.classIds.includes(candidate.classId)) {
    score += 20;
  }
  if (candidate.organizationId && context.organizationIds.includes(candidate.organizationId)) {
    score += 15;
  }
  if (candidate.historical) {
    score -= 10;
  }
  return score;
}

export function rankCandidates(candidates: RankingCandidate[], context: RankingContext): RankingCandidate[] {
  return [...candidates].sort((a, b) => relevanceScore(b, context) - relevanceScore(a, context));
}

export type RestrictedResultOutcome = {
  items: unknown[];
  message: string;
};

export const NO_RESULTS_MESSAGE = 'No results found';

export function maskRestrictedResults(input: {
  authorized: unknown[];
  hiddenCount: number;
}): RestrictedResultOutcome {
  return {
    items: input.authorized,
    message: input.authorized.length === 0 ? NO_RESULTS_MESSAGE : '',
  };
}

export const OFFLINE_SEARCHABLE_TYPES: IndexableObjectType[] = [
  'PERSON',
  'CLASS',
  'COURSE',
  'COURSE_OFFERING',
  'ORGANIZATION',
  'EVENT',
  'RESOURCE',
  'SERVICE',
  'LOCATION',
];

export function offlineSearchable(objectType: IndexableObjectType): boolean {
  return OFFLINE_SEARCHABLE_TYPES.includes(objectType);
}

export function indexFailureAffectsDomain(): boolean {
  return false;
}
