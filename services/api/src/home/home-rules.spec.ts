import {
  formatYmd,
  isFirstTimeHome,
  relativeTiming,
  selectUpNext,
  zonedDayBounds,
  mergeAttention,
  discoverWhen,
} from './home-rules';

describe('home rules', () => {
  it('computes Africa/Harare midnight as UTC-2 hours', () => {
    const bounds = zonedDayBounds(new Date('2026-09-15T12:00:00Z'), 'Africa/Harare', '2026-09-15');
    expect(bounds.start.toISOString()).toBe('2026-09-14T22:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-09-15T22:00:00.000Z');
    expect(formatYmd(new Date('2026-09-15T21:30:00Z'), 'Africa/Harare')).toBe('2026-09-15');
  });

  it('selects a high-relevance academic deadline over an earlier low-value event', () => {
    const now = new Date('2026-09-15T07:00:00Z');
    const chosen = selectUpNext(
      [
        {
          id: 'society',
          status: 'SCHEDULED',
          startTime: new Date('2026-09-15T08:00:00Z'),
          relevanceWeight: 10,
        },
        {
          id: 'assignment',
          status: 'SCHEDULED',
          startTime: new Date('2026-09-15T12:00:00Z'),
          relevanceWeight: 90,
        },
      ],
      now,
    );
    expect(chosen?.id).toBe('assignment');
  });

  it('drops cancelled and completed activities from Up Next', () => {
    const now = new Date('2026-09-15T07:00:00Z');
    expect(
      selectUpNext(
        [
          {
            id: 'done',
            status: 'COMPLETED',
            startTime: new Date('2026-09-15T08:00:00Z'),
            relevanceWeight: 99,
          },
          {
            id: 'cancelled',
            status: 'CANCELLED',
            startTime: new Date('2026-09-15T08:05:00Z'),
            relevanceWeight: 99,
          },
        ],
        now,
      ),
    ).toBeNull();
  });

  it('prefers an ongoing activity', () => {
    const now = new Date('2026-09-15T10:10:00Z');
    const chosen = selectUpNext(
      [
        {
          id: 'later',
          status: 'SCHEDULED',
          startTime: new Date('2026-09-15T12:00:00Z'),
          relevanceWeight: 80,
        },
        {
          id: 'now',
          status: 'ONGOING',
          startTime: new Date('2026-09-15T10:00:00Z'),
          relevanceWeight: 50,
        },
      ],
      now,
    );
    expect(chosen?.id).toBe('now');
  });

  it('marks first-time Home when the person has no academic membership', () => {
    expect(isFirstTimeHome({ enrollmentCount: 0, membershipCount: 0 })).toBe(true);
    expect(isFirstTimeHome({ enrollmentCount: 1, membershipCount: 0 })).toBe(false);
  });

  it('describes relative timing without relying on colour', () => {
    const now = new Date('2026-09-15T09:25:00Z');
    expect(
      relativeTiming(
        new Date('2026-09-15T10:00:00Z'),
        new Date('2026-09-15T11:00:00Z'),
        'SCHEDULED',
        now,
      ),
    ).toBe('Starts in 35 min');
    expect(
      relativeTiming(
        new Date('2026-09-15T09:00:00Z'),
        new Date('2026-09-15T10:00:00Z'),
        'ONGOING',
        now,
      ),
    ).toBe('Happening now');
  });

  it('keeps attention bounded and de-duplicated by source', () => {
    const merged = mergeAttention([
      {
        id: '1',
        priority: 'NORMAL',
        title: 'Announcement',
        sourceType: 'ANNOUNCEMENT',
        sourceId: 'ann_1',
        route: '/a',
      },
      {
        id: '2',
        priority: 'HIGH',
        title: 'Assignment',
        sourceType: 'ASSIGNMENT',
        sourceId: 'asg_1',
        route: '/b',
      },
      {
        id: '3',
        priority: 'HIGH',
        title: 'Assignment again',
        sourceType: 'ASSIGNMENT',
        sourceId: 'asg_1',
        route: '/b',
      },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('2');
  });

  it('formats Discover timing without exposing ISO timestamps', () => {
    expect(
      discoverWhen(new Date('2026-09-15T17:00:00Z'), 'Africa/Harare', 'Student Centre'),
    ).toMatch(/Student Centre/);
    expect(
      discoverWhen(new Date('2026-09-15T17:00:00Z'), 'Africa/Harare', 'Student Centre'),
    ).not.toMatch(/T17:00:00/);
  });
});
