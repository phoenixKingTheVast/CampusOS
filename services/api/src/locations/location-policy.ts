export const DEFAULT_LOCATION_TYPES = [
  'CAMPUS',
  'BUILDING',
  'FLOOR',
  'ROOM',
  'LECTURE_HALL',
  'LABORATORY',
  'OFFICE',
  'RESIDENCE',
  'LIBRARY',
  'CAFETERIA',
  'SPORTS_FACILITY',
  'SERVICE_LOCATION',
  'PARKING',
  'ENTRANCE',
  'LANDMARK',
  'OTHER',
] as const;

export type LocationType = (typeof DEFAULT_LOCATION_TYPES)[number] | string;

const PARENT_TYPES: Record<string, string[]> = {
  CAMPUS: [],
  BUILDING: ['CAMPUS'],
  FLOOR: ['BUILDING'],
  ROOM: ['FLOOR', 'BUILDING'],
  LECTURE_HALL: ['FLOOR', 'BUILDING', 'CAMPUS'],
  LABORATORY: ['FLOOR', 'BUILDING'],
  OFFICE: ['FLOOR', 'BUILDING'],
  RESIDENCE: ['CAMPUS'],
  LIBRARY: ['CAMPUS', 'BUILDING'],
  CAFETERIA: ['CAMPUS', 'BUILDING', 'FLOOR'],
  SPORTS_FACILITY: ['CAMPUS'],
  SERVICE_LOCATION: ['CAMPUS', 'BUILDING', 'FLOOR'],
  PARKING: ['CAMPUS'],
  ENTRANCE: ['CAMPUS', 'BUILDING'],
  LANDMARK: ['CAMPUS'],
  OTHER: ['CAMPUS', 'BUILDING', 'FLOOR'],
};

export function allowedParentsFor(type: string, configured: Record<string, string[]> = PARENT_TYPES): string[] {
  return configured[type] ?? ['CAMPUS', 'BUILDING', 'FLOOR'];
}

export function hierarchyAllowed(input: {
  type: string;
  parentType: string | null;
  configured?: Record<string, string[]>;
}): boolean {
  const allowed = allowedParentsFor(input.type, input.configured);
  if (allowed.length === 0) {
    return input.parentType === null;
  }
  return input.parentType !== null && allowed.includes(input.parentType);
}

export type LocationStatus = 'ACTIVE' | 'TEMPORARILY_CLOSED' | 'RESTRICTED' | 'ARCHIVED';

const LOCATION_TRANSITIONS: Record<LocationStatus, LocationStatus[]> = {
  ACTIVE: ['TEMPORARILY_CLOSED', 'RESTRICTED', 'ARCHIVED'],
  TEMPORARILY_CLOSED: ['ACTIVE', 'RESTRICTED', 'ARCHIVED'],
  RESTRICTED: ['ACTIVE', 'TEMPORARILY_CLOSED', 'ARCHIVED'],
  ARCHIVED: ['ACTIVE'],
};

export function canTransitionLocation(from: LocationStatus, to: LocationStatus): boolean {
  return LOCATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function locationHistoricallyValid(status: LocationStatus): boolean {
  return status === 'ACTIVE' || status === 'TEMPORARILY_CLOSED' || status === 'RESTRICTED' || status === 'ARCHIVED';
}

export type LocationVisibility = 'PUBLIC' | 'CAMPUS_ONLY' | 'CONTEXT_ONLY' | 'RESTRICTED';

export type LocationAction = 'VIEW' | 'EDIT' | 'ARCHIVE' | 'CLOSE' | 'RESTORE' | 'IMPORT' | 'REPORT';

export type LocationActor =
  | { kind: 'STUDENT'; campusMember: boolean; contextIds: string[] }
  | { kind: 'ADMIN'; campusMember: boolean; contextIds: string[] };

export function authorizeLocationAction(input: {
  actor: LocationActor;
  visibility: LocationVisibility;
  status: LocationStatus;
  action: LocationAction;
  locationContextId?: string | null;
}): { allowed: boolean; reason?: string } {
  if (input.action === 'REPORT') {
    return input.actor.campusMember || input.actor.kind === 'ADMIN'
      ? { allowed: true }
      : { allowed: false, reason: "You don't have permission to do that." };
  }
  if (input.action !== 'VIEW' && input.actor.kind !== 'ADMIN') {
    return { allowed: false, reason: 'Official campus locations are managed by administrators.' };
  }
  if (input.status === 'ARCHIVED' && input.action === 'VIEW' && input.actor.kind !== 'ADMIN') {
    return { allowed: false, reason: 'This place is no longer in use.' };
  }
  switch (input.visibility) {
    case 'PUBLIC':
      return { allowed: true };
    case 'CAMPUS_ONLY':
      return input.actor.campusMember || input.actor.kind === 'ADMIN'
        ? { allowed: true }
        : { allowed: false, reason: 'Please sign in to continue.' };
    case 'CONTEXT_ONLY':
      if (input.actor.kind === 'ADMIN') return { allowed: true };
      return input.locationContextId && input.actor.contextIds.includes(input.locationContextId)
        ? { allowed: true }
        : { allowed: false, reason: "You don't have permission to do that." };
    case 'RESTRICTED':
      return input.actor.kind === 'ADMIN'
        ? { allowed: true }
        : { allowed: false, reason: "You don't have permission to do that." };
    default:
      return { allowed: false, reason: "You don't have permission to do that." };
  }
}

/**
 * Discovering a building never grants access to the events, services or
 * rooms that happen to sit inside it.
 */
export function locationDiscoveryGrantsObjectAccess(): boolean {
  return false;
}

export type ObjectLocationRole = 'PRIMARY' | 'START' | 'END' | 'MEETING_POINT' | 'ALTERNATIVE';

export type ObjectLocationRef = {
  objectType: string;
  objectId: string;
  locationId: string;
  role: ObjectLocationRole;
  sequence: number;
};

export function orderedObjectLocations(refs: ObjectLocationRef[]): ObjectLocationRef[] {
  const rank: Record<ObjectLocationRole, number> = {
    START: 0,
    PRIMARY: 1,
    MEETING_POINT: 2,
    ALTERNATIVE: 3,
    END: 4,
  };
  return [...refs].sort((a, b) => a.sequence - b.sequence || rank[a.role] - rank[b.role]);
}

export type AssociatedObject = {
  objectType: string;
  objectId: string;
  authorized: boolean;
};

/** Location detail only lists associated objects the viewer may already see. */
export function visibleAssociations(items: AssociatedObject[]): AssociatedObject[] {
  return items.filter((item) => item.authorized);
}

export type AccessibilityInformation = {
  wheelchairAccessible: boolean | null;
  accessibleEntrance: string | null;
  liftAvailable: boolean | null;
  accessibleToilet: boolean | null;
  hearingSupport: boolean | null;
  visualGuidance: boolean | null;
  additionalInformation: string | null;
};

export function accessibilitySummary(info: AccessibilityInformation): string {
  const parts: string[] = [];
  if (info.accessibleEntrance) parts.push(info.accessibleEntrance);
  if (info.liftAvailable) parts.push('Lift available.');
  if (info.wheelchairAccessible === false && !info.accessibleEntrance) {
    parts.push('Wheelchair access is limited.');
  }
  if (info.additionalInformation) parts.push(info.additionalInformation);
  return parts.join(' ').trim();
}

export type OpeningSchedule = {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
};

export type OpeningExceptionStatus = 'CLOSED' | 'OPEN' | 'MODIFIED';

export type OpeningException = {
  date: string;
  status: OpeningExceptionStatus;
  openMinute?: number;
  closeMinute?: number;
  reason: 'HOLIDAY' | 'MAINTENANCE' | 'EXAMINATION' | 'SPECIAL_EVENT' | 'TEMPORARY_CLOSURE' | 'OTHER';
};

export type OpeningDisplay = {
  state: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  label: string;
};

function formatClock(minute: number): string {
  const hours = Math.floor(minute / 60)
    .toString()
    .padStart(2, '0');
  const mins = (minute % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

export function openingAt(input: {
  schedules: OpeningSchedule[];
  exceptions: OpeningException[];
  date: string;
  dayOfWeek: number;
  minuteOfDay: number;
}): OpeningDisplay {
  const exception = input.exceptions.find((item) => item.date === input.date);
  if (exception) {
    if (exception.status === 'CLOSED') {
      return { state: 'CLOSED', label: exception.reason === 'MAINTENANCE' ? 'Closed today for maintenance.' : 'Closed today.' };
    }
    const open = exception.openMinute ?? 0;
    const close = exception.closeMinute ?? 24 * 60;
    if (input.minuteOfDay >= open && input.minuteOfDay < close) {
      return { state: 'OPEN', label: `Open until ${formatClock(close)}` };
    }
    return { state: 'CLOSED', label: 'Closed today.' };
  }
  const schedule = input.schedules.find((item) => item.dayOfWeek === input.dayOfWeek);
  if (!schedule) {
    return { state: 'UNKNOWN', label: 'Hours unavailable.' };
  }
  if (input.minuteOfDay >= schedule.openMinute && input.minuteOfDay < schedule.closeMinute) {
    return { state: 'OPEN', label: `Open until ${formatClock(schedule.closeMinute)}` };
  }
  return { state: 'CLOSED', label: 'Closed.' };
}

export type LocationRelationshipKind =
  | 'PARENT_OF'
  | 'CONTAINS'
  | 'ADJACENT_TO'
  | 'CONNECTED_TO'
  | 'NEAR'
  | 'LOCATED_IN';

export type LocationReportReason =
  | 'WRONG_NAME'
  | 'WRONG_POSITION'
  | 'WRONG_ROOM'
  | 'CLOSED'
  | 'MISSING_LOCATION'
  | 'ACCESSIBILITY_INFORMATION_WRONG'
  | 'OTHER';

export type ConflictSeverity = 'VALID' | 'WARNING' | 'CONFLICT';

export type Occupancy = {
  locationId: string;
  startsAt: Date;
  endsAt: Date;
  objectId: string;
};

export function locationConflict(a: Occupancy, b: Occupancy): ConflictSeverity {
  if (a.locationId !== b.locationId || a.objectId === b.objectId) {
    return 'VALID';
  }
  const overlap = a.startsAt < b.endsAt && b.startsAt < a.endsAt;
  if (!overlap) {
    return 'VALID';
  }
  const contained =
    (a.startsAt >= b.startsAt && a.endsAt <= b.endsAt) || (b.startsAt >= a.startsAt && b.endsAt <= a.endsAt);
  return contained ? 'CONFLICT' : 'WARNING';
}

export function conflictBlocksAuthorization(_severity: ConflictSeverity): boolean {
  return false;
}

export type LocationImportRow = {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ImportIssue = { rowId: string; reason: string };

export function validateLocationImport(
  rows: LocationImportRow[],
  configuredTypes: readonly string[] = DEFAULT_LOCATION_TYPES,
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  const byId = new Map(rows.map((row) => [row.id, row]));
  const names = new Map<string, string>();

  for (const row of rows) {
    if (seen.has(row.id)) {
      issues.push({ rowId: row.id, reason: 'Duplicate identifier.' });
    }
    seen.add(row.id);
    if (!configuredTypes.includes(row.type) && row.type !== 'OTHER') {
      issues.push({ rowId: row.id, reason: 'Unsupported location type.' });
    }
    if (!row.parentId && allowedParentsFor(row.type).length > 0) {
      issues.push({ rowId: row.id, reason: 'Missing parent.' });
    }
    if (row.parentId === row.id) {
      issues.push({ rowId: row.id, reason: 'Invalid hierarchy.' });
    }
    if (row.parentId) {
      const parent = byId.get(row.parentId);
      if (!parent) {
        issues.push({ rowId: row.id, reason: 'Missing parent.' });
      } else if (!hierarchyAllowed({ type: row.type, parentType: parent.type })) {
        issues.push({ rowId: row.id, reason: 'Invalid hierarchy.' });
      }
    }
    if (
      (row.latitude != null && (row.latitude < -90 || row.latitude > 90)) ||
      (row.longitude != null && (row.longitude < -180 || row.longitude > 180))
    ) {
      issues.push({ rowId: row.id, reason: 'Invalid coordinates.' });
    }
    const nameKey = `${row.parentId ?? ''}:${row.name.trim().toLowerCase()}`;
    if (names.has(nameKey)) {
      issues.push({ rowId: row.id, reason: 'Duplicate room name.' });
    }
    names.set(nameKey, row.id);
  }
  return issues;
}

export type MapGeometry = 'POINT' | 'LINE' | 'POLYGON';

export type MapFeature = {
  id: string;
  locationId: string;
  mapId: string;
  geometry: MapGeometry;
  featureType: string;
};

export function mapFeatureOwnsLocation(): boolean {
  return false;
}

export type NearbyCandidate = {
  id: string;
  latitude: number;
  longitude: number;
  authorized: boolean;
  isPerson: boolean;
};

export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nearbyResults(input: {
  origin: { latitude: number; longitude: number } | null;
  candidates: NearbyCandidate[];
  radiusMeters: number;
}): NearbyCandidate[] {
  if (!input.origin) {
    return [];
  }
  return input.candidates.filter((candidate) => {
    if (!candidate.authorized || candidate.isPerson) {
      return false;
    }
    return haversineMeters(input.origin!, candidate) <= input.radiusMeters;
  });
}

export const CONTINUOUS_LOCATION_TRACKING_REQUIRED = false;

export function mayRequestLiveLocation(feature: 'NEARBY' | 'DIRECTIONS' | 'ANALYTICS'): boolean {
  return feature === 'NEARBY' || feature === 'DIRECTIONS';
}

export type LocationChangeEffect = {
  updateRelationship: boolean;
  invalidateCaches: boolean;
  audit: boolean;
  notifyParticipants: boolean;
  updateCalendar: boolean;
  updateDeepLinks: boolean;
  recreateEvent: boolean;
};

export function locationChangeEffects(): LocationChangeEffect {
  return {
    updateRelationship: true,
    invalidateCaches: true,
    audit: true,
    notifyParticipants: true,
    updateCalendar: true,
    updateDeepLinks: true,
    recreateEvent: false,
  };
}

export const LOCATION_ANALYTICS_EVENTS = [
  'map_opened',
  'location_search_started',
  'location_searched',
  'location_opened',
  'location_directions_requested',
  'location_shared',
  'location_saved',
  'nearby_locations_opened',
  'location_report_submitted',
  'map_provider_opened',
];

export const PRECISE_LOCATION_ANALYTICS_FORBIDDEN = true;

export type OfflineLocationFreshness = 'LIVE' | 'CACHED' | 'STALE';

export function offlineLocationFreshness(input: { online: boolean; fetchedAt: Date; now: Date }): {
  state: OfflineLocationFreshness;
  label: string | null;
} {
  if (input.online) {
    return { state: 'LIVE', label: null };
  }
  const stale = input.now.getTime() - input.fetchedAt.getTime() > 24 * 60 * 60 * 1000;
  return {
    state: stale ? 'STALE' : 'CACHED',
    label: 'Offline — map information may be outdated.',
  };
}

export function locationListLabel(input: {
  name: string;
  type: string;
  distanceMeters?: number | null;
}): string {
  if (input.distanceMeters == null) {
    return input.name;
  }
  const meters = Math.round(input.distanceMeters);
  return `${input.name} — ${meters} m away`;
}

export function venueToLocationRef(venue: { id: string; name: string }): { locationId: string; displayName: string } {
  return { locationId: venue.id, displayName: venue.name };
}
