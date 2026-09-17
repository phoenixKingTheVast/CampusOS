import { canIncludeStudyGroup, normalizeSearchType, objectTypeLabel, rankSearchHits } from './search-rules';

describe('search rules', () => {
  it('normalizes unknown types to all', () => {
    expect(normalizeSearchType('weird')).toBe('all');
    expect(normalizeSearchType('resources')).toBe('resources');
    expect(normalizeSearchType('places')).toBe('places');
    expect(normalizeSearchType('locations')).toBe('places');
  });

  it('ranks exact title matches ahead of partial matches', () => {
    const ranked = rankSearchHits('power electronics', [
      { id: '2', objectType: 'COURSE', title: 'Machines and Power Electronics' },
      { id: '1', objectType: 'COURSE', title: 'Power Electronics' },
    ]);
    expect(ranked[0].id).toBe('1');
  });

  it('does not surface historical results ahead of current ones when titles match equally', () => {
    const ranked = rankSearchHits('tutorial', [
      { id: 'old', objectType: 'RESOURCE', title: 'Tutorial 3', historical: true },
      { id: 'now', objectType: 'RESOURCE', title: 'Tutorial 3', historical: false },
    ]);
    expect(ranked[0].id).toBe('now');
  });

  it('excludes private study groups the person cannot access', () => {
    expect(
      canIncludeStudyGroup({
        visibility: 'PRIVATE',
        courseOfferingId: 'coe-other',
        isMember: false,
        enrolledOfferingIds: ['coe-mine'],
      }),
    ).toBe(false);
    expect(
      canIncludeStudyGroup({
        visibility: 'COURSE_MEMBERS_ONLY',
        courseOfferingId: 'coe-mine',
        isMember: false,
        enrolledOfferingIds: ['coe-mine'],
      }),
    ).toBe(true);
    expect(
      canIncludeStudyGroup({
        visibility: 'INVITE_ONLY',
        courseOfferingId: 'coe-mine',
        isMember: false,
        enrolledOfferingIds: ['coe-mine'],
      }),
    ).toBe(false);
    expect(
      canIncludeStudyGroup({
        visibility: 'CAMPUS_ONLY',
        isMember: false,
        enrolledOfferingIds: ['coe-mine'],
        campusMember: true,
      }),
    ).toBe(true);
  });

  it('labels domain types for result cards', () => {
    expect(objectTypeLabel('COURSE')).toBe('Course');
    expect(objectTypeLabel('LOCATION')).toBe('Place');
  });
});
