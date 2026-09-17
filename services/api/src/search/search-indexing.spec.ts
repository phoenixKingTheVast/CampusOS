import {
  NO_RESULTS_MESSAGE,
  RankingContext,
  forbiddenIndexFields,
  indexOperationFor,
  isDiscoverableState,
  maskRestrictedResults,
  offlineSearchable,
  rankCandidates,
} from './search-indexing';

const CONTEXT: RankingContext = {
  query: 'eeng401',
  enrolledOfferingIds: ['coe_2026_s2'],
  classIds: ['class_eee41'],
  organizationIds: [],
};

describe('search indexing', () => {
  it('refuses to index sensitive fields', () => {
    expect(
      forbiddenIndexFields({
        searchableMetadata: { programme: 'Electrical Engineering', registrationNumber: 'R123456' },
      }),
    ).toEqual(['registrationNumber']);
    expect(
      forbiddenIndexFields({ searchableMetadata: { courseCode: 'EENG401', semester: '2026 S2' } }),
    ).toEqual([]);
    expect(
      forbiddenIndexFields({ searchableMetadata: { VerificationEvidence: 'file_1', phone: '+263' } }),
    ).toEqual(['VerificationEvidence', 'phone']);
  });

  it('keeps archived course offerings discoverable but drops removed resources', () => {
    expect(isDiscoverableState('COURSE_OFFERING', 'ARCHIVED')).toBe(true);
    expect(isDiscoverableState('RESOURCE', 'REMOVED')).toBe(false);
    expect(isDiscoverableState('ORGANIZATION', 'SUSPENDED')).toBe(false);
    expect(isDiscoverableState('EVENT', 'CANCELLED')).toBe(false);
    expect(isDiscoverableState('SERVICE', 'DISCONTINUED')).toBe(false);
    expect(isDiscoverableState('PERSON', 'DEACTIVATED')).toBe(false);
    expect(isDiscoverableState('LOCATION', 'ACTIVE')).toBe(true);
    expect(isDiscoverableState('LOCATION', 'ARCHIVED')).toBe(false);
    expect(isDiscoverableState('STUDY_GROUP', 'ACTIVE')).toBe(true);
    expect(isDiscoverableState('STUDY_GROUP', 'INACTIVE')).toBe(true);
    expect(isDiscoverableState('STUDY_GROUP', 'ARCHIVED')).toBe(false);
    expect(offlineSearchable('LOCATION')).toBe(true);
  });

  it('removes an object from the index when its lifecycle leaves the discoverable set', () => {
    expect(indexOperationFor({ objectType: 'ORGANIZATION', lifecycleState: 'ACTIVE' })).toBe('UPSERT');
    expect(indexOperationFor({ objectType: 'ORGANIZATION', lifecycleState: 'SUSPENDED' })).toBe('REMOVE');
    expect(indexOperationFor({ objectType: 'RESOURCE', lifecycleState: 'REMOVED' })).toBe('REMOVE');
  });

  it('ranks an exact course code ahead of a partial title match', () => {
    const ranked = rankCandidates(
      [
        { objectType: 'RESOURCE', objectId: 'r1', title: 'EENG401 revision notes' },
        { objectType: 'COURSE', objectId: 'c1', title: 'Control Systems', code: 'EENG401' },
      ],
      CONTEXT,
    );
    expect(ranked[0].objectId).toBe('c1');
  });

  it('lets enrolment reorder results without changing which results exist', () => {
    const candidates = [
      { objectType: 'RESOURCE' as const, objectId: 'other', title: 'Laboratory 4', courseOfferingId: 'coe_other' },
      { objectType: 'RESOURCE' as const, objectId: 'mine', title: 'Laboratory 4', courseOfferingId: 'coe_2026_s2' },
    ];
    const ranked = rankCandidates(candidates, { ...CONTEXT, query: 'laboratory 4' });
    expect(ranked[0].objectId).toBe('mine');
    expect(ranked).toHaveLength(candidates.length);
  });

  it('deprioritises historical results against equal current ones', () => {
    const ranked = rankCandidates(
      [
        { objectType: 'RESOURCE', objectId: 'old', title: 'Tutorial 3', historical: true },
        { objectType: 'RESOURCE', objectId: 'now', title: 'Tutorial 3', historical: false },
      ],
      { ...CONTEXT, query: 'tutorial 3' },
    );
    expect(ranked[0].objectId).toBe('now');
  });

  it('never distinguishes a hidden object from an absent one', () => {
    const hidden = maskRestrictedResults({ authorized: [], hiddenCount: 7 });
    const absent = maskRestrictedResults({ authorized: [], hiddenCount: 0 });
    expect(hidden).toEqual(absent);
    expect(hidden.message).toBe(NO_RESULTS_MESSAGE);
    expect(JSON.stringify(hidden)).not.toContain('7');
  });

  it('limits offline search to cacheable object types', () => {
    expect(offlineSearchable('RESOURCE')).toBe(true);
    expect(offlineSearchable('COURSE')).toBe(true);
    expect(offlineSearchable('STUDY_GROUP')).toBe(false);
  });
});
