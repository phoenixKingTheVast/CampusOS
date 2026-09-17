import {
  accessibilitySummary,
  authorizeLocationAction,
  canTransitionLocation,
  conflictBlocksAuthorization,
  hierarchyAllowed,
  locationChangeEffects,
  locationConflict,
  locationDiscoveryGrantsObjectAccess,
  locationHistoricallyValid,
  locationListLabel,
  mapFeatureOwnsLocation,
  mayRequestLiveLocation,
  nearbyResults,
  offlineLocationFreshness,
  openingAt,
  orderedObjectLocations,
  validateLocationImport,
  venueToLocationRef,
  visibleAssociations,
  CONTINUOUS_LOCATION_TRACKING_REQUIRED,
  PRECISE_LOCATION_ANALYTICS_FORBIDDEN,
} from './location-policy';

const student = { kind: 'STUDENT' as const, campusMember: true, contextIds: ['course_eee401'] };
const outsider = { kind: 'STUDENT' as const, campusMember: false, contextIds: [] };
const admin = { kind: 'ADMIN' as const, campusMember: true, contextIds: [] };

describe('location policy', () => {
  it('keeps campus hierarchy configurable rather than UZ-specific', () => {
    expect(hierarchyAllowed({ type: 'CAMPUS', parentType: null })).toBe(true);
    expect(hierarchyAllowed({ type: 'BUILDING', parentType: 'CAMPUS' })).toBe(true);
    expect(hierarchyAllowed({ type: 'FLOOR', parentType: 'BUILDING' })).toBe(true);
    expect(hierarchyAllowed({ type: 'ROOM', parentType: 'FLOOR' })).toBe(true);
    expect(hierarchyAllowed({ type: 'ROOM', parentType: 'CAMPUS' })).toBe(false);
    expect(
      hierarchyAllowed({
        type: 'ANNEX',
        parentType: 'BUILDING',
        configured: { ANNEX: ['BUILDING'] },
      }),
    ).toBe(true);
  });

  it('keeps temporarily closed locations historically valid', () => {
    expect(canTransitionLocation('ACTIVE', 'TEMPORARILY_CLOSED')).toBe(true);
    expect(canTransitionLocation('TEMPORARILY_CLOSED', 'ACTIVE')).toBe(true);
    expect(canTransitionLocation('ARCHIVED', 'TEMPORARILY_CLOSED')).toBe(false);
    expect(locationHistoricallyValid('TEMPORARILY_CLOSED')).toBe(true);
    expect(locationHistoricallyValid('ARCHIVED')).toBe(true);
  });

  it('lets students view campus buildings but not edit or open restricted offices', () => {
    expect(
      authorizeLocationAction({
        actor: student,
        visibility: 'CAMPUS_ONLY',
        status: 'ACTIVE',
        action: 'VIEW',
      }).allowed,
    ).toBe(true);
    expect(
      authorizeLocationAction({
        actor: student,
        visibility: 'CAMPUS_ONLY',
        status: 'ACTIVE',
        action: 'EDIT',
      }).reason,
    ).toBe('Official campus locations are managed by administrators.');
    expect(
      authorizeLocationAction({
        actor: student,
        visibility: 'RESTRICTED',
        status: 'ACTIVE',
        action: 'VIEW',
      }).allowed,
    ).toBe(false);
    expect(
      authorizeLocationAction({
        actor: student,
        visibility: 'CONTEXT_ONLY',
        status: 'ACTIVE',
        action: 'VIEW',
        locationContextId: 'course_eee401',
      }).allowed,
    ).toBe(true);
    expect(
      authorizeLocationAction({
        actor: outsider,
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        action: 'VIEW',
      }).allowed,
    ).toBe(true);
  });

  it('never treats discovering a building as access to objects inside it', () => {
    expect(locationDiscoveryGrantsObjectAccess()).toBe(false);
    expect(
      visibleAssociations([
        { objectType: 'EVENT', objectId: 'evt_public', authorized: true },
        { objectType: 'EVENT', objectId: 'evt_private', authorized: false },
        { objectType: 'SERVICE', objectId: 'svc_1', authorized: true },
      ]).map((item) => item.objectId),
    ).toEqual(['evt_public', 'svc_1']);
  });

  it('orders multiple object locations without inventing locationId2 fields', () => {
    const ordered = orderedObjectLocations([
      { objectType: 'EVENT', objectId: 'fair', locationId: 'courtyard', role: 'ALTERNATIVE', sequence: 3 },
      { objectType: 'EVENT', objectId: 'fair', locationId: 'gate', role: 'START', sequence: 1 },
      { objectType: 'EVENT', objectId: 'fair', locationId: 'centre', role: 'PRIMARY', sequence: 2 },
    ]);
    expect(ordered.map((item) => item.role)).toEqual(['START', 'PRIMARY', 'ALTERNATIVE']);
  });

  it('describes accessibility as useful information rather than a single flag', () => {
    expect(
      accessibilitySummary({
        wheelchairAccessible: false,
        accessibleEntrance: 'Accessible entrance is on the east side.',
        liftAvailable: true,
        accessibleToilet: true,
        hearingSupport: null,
        visualGuidance: null,
        additionalInformation: 'Main entrance has stairs.',
      }),
    ).toBe('Accessible entrance is on the east side. Lift available. Main entrance has stairs.');
  });

  it('lets opening exceptions override the weekly schedule', () => {
    const schedules = [{ dayOfWeek: 1, openMinute: 7 * 60, closeMinute: 22 * 60 }];
    expect(
      openingAt({
        schedules,
        exceptions: [],
        date: '2026-03-16',
        dayOfWeek: 1,
        minuteOfDay: 18 * 60,
      }).label,
    ).toBe('Open until 22:00');
    expect(
      openingAt({
        schedules,
        exceptions: [{ date: '2026-03-16', status: 'CLOSED', reason: 'MAINTENANCE' }],
        date: '2026-03-16',
        dayOfWeek: 1,
        minuteOfDay: 18 * 60,
      }).label,
    ).toBe('Closed today for maintenance.');
  });

  it('warns on overlapping bookings without turning the overlap into an authorization failure', () => {
    const lecture = {
      locationId: 'lt1',
      objectId: 'eeng401',
      startsAt: new Date('2026-03-16T10:00:00Z'),
      endsAt: new Date('2026-03-16T12:00:00Z'),
    };
    const overlap = {
      locationId: 'lt1',
      objectId: 'eeng402',
      startsAt: new Date('2026-03-16T11:00:00Z'),
      endsAt: new Date('2026-03-16T13:00:00Z'),
    };
    expect(locationConflict(lecture, overlap)).toBe('WARNING');
    expect(conflictBlocksAuthorization('CONFLICT')).toBe(false);
    expect(
      locationConflict(lecture, {
        ...overlap,
        startsAt: new Date('2026-03-16T10:00:00Z'),
        endsAt: new Date('2026-03-16T12:00:00Z'),
      }),
    ).toBe('CONFLICT');
  });

  it('validates location imports before they become campus data', () => {
    const issues = validateLocationImport([
      { id: 'uz', name: 'University of Zimbabwe', type: 'CAMPUS' },
      { id: 'eng', name: 'Engineering Building', type: 'BUILDING', parentId: 'uz' },
      { id: 'e204', name: 'E204', type: 'ROOM', parentId: 'eng' },
      { id: 'e204b', name: 'E204', type: 'ROOM', parentId: 'eng' },
      { id: 'ghost', name: 'Ghost', type: 'ROOM', parentId: 'missing' },
      { id: 'bad', name: 'Bad coords', type: 'LANDMARK', parentId: 'uz', latitude: 200, longitude: 30 },
      { id: 'weird', name: 'Spaceship', type: 'SPACESHIP', parentId: 'uz' },
    ]);
    expect(issues.map((item) => item.reason).sort()).toEqual([
      'Duplicate room name.',
      'Invalid coordinates.',
      'Missing parent.',
      'Unsupported location type.',
    ]);
  });

  it('keeps map features as presentation of locations, not the source of truth', () => {
    expect(mapFeatureOwnsLocation()).toBe(false);
    expect(venueToLocationRef({ id: 'venue_eng', name: 'Engineering Block' })).toEqual({
      locationId: 'venue_eng',
      displayName: 'Engineering Block',
    });
  });

  it('never tracks live location by default and never leaks people through nearby', () => {
    expect(CONTINUOUS_LOCATION_TRACKING_REQUIRED).toBe(false);
    expect(PRECISE_LOCATION_ANALYTICS_FORBIDDEN).toBe(true);
    expect(mayRequestLiveLocation('ANALYTICS')).toBe(false);
    expect(mayRequestLiveLocation('NEARBY')).toBe(true);
    const origin = { latitude: -17.784, longitude: 31.053 };
    const results = nearbyResults({
      origin,
      radiusMeters: 400,
      candidates: [
        { id: 'library', latitude: -17.7841, longitude: 31.0531, authorized: true, isPerson: false },
        { id: 'secret-lab', latitude: -17.7841, longitude: 31.0531, authorized: false, isPerson: false },
        { id: 'student-matthew', latitude: -17.7841, longitude: 31.0531, authorized: true, isPerson: true },
        { id: 'far-cafeteria', latitude: -17.8, longitude: 31.1, authorized: true, isPerson: false },
      ],
    });
    expect(results.map((item) => item.id)).toEqual(['library']);
    expect(nearbyResults({ origin: null, radiusMeters: 400, candidates: results })).toEqual([]);
  });

  it('updates the activity relationship when a venue changes rather than creating a new event', () => {
    expect(locationChangeEffects()).toEqual({
      updateRelationship: true,
      invalidateCaches: true,
      audit: true,
      notifyParticipants: true,
      updateCalendar: true,
      updateDeepLinks: true,
      recreateEvent: false,
    });
  });

  it('gives VoiceOver a semantic alternative to the visual map', () => {
    expect(locationListLabel({ name: 'Engineering Building', type: 'BUILDING', distanceMeters: 250 })).toBe(
      'Engineering Building — 250 m away',
    );
  });

  it('marks cached maps as possibly outdated while offline', () => {
    expect(
      offlineLocationFreshness({
        online: false,
        fetchedAt: new Date('2026-03-10T00:00:00Z'),
        now: new Date('2026-03-12T00:00:00Z'),
      }).label,
    ).toBe('Offline — map information may be outdated.');
  });

  it('lets students report a correction without granting them edit rights', () => {
    expect(
      authorizeLocationAction({
        actor: student,
        visibility: 'CAMPUS_ONLY',
        status: 'ACTIVE',
        action: 'REPORT',
      }).allowed,
    ).toBe(true);
    expect(
      authorizeLocationAction({
        actor: admin,
        visibility: 'RESTRICTED',
        status: 'ACTIVE',
        action: 'ARCHIVE',
      }).allowed,
    ).toBe(true);
  });
});
