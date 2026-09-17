export type SearchHit = {
  id: string;
  objectType: string;
  title: string;
  subtitle?: string | null;
  route?: string | null;
  historical?: boolean;
  kindLabel?: string;
};

export function objectTypeLabel(objectType: string): string {
  switch (objectType) {
    case 'PERSON':
      return 'Person';
    case 'COURSE':
      return 'Course';
    case 'CLASS':
      return 'Class';
    case 'ORGANIZATION':
      return 'Organization';
    case 'EVENT':
      return 'Event';
    case 'RESOURCE':
      return 'Resource';
    case 'STUDY_GROUP':
      return 'Study group';
    case 'SERVICE':
      return 'Service';
    case 'LOCATION':
      return 'Place';
    default:
      return objectType;
  }
}

export function normalizeSearchType(type?: string): string {
  switch ((type ?? 'all').toLowerCase()) {
    case 'people':
    case 'courses':
    case 'classes':
    case 'organizations':
    case 'events':
    case 'resources':
    case 'study_groups':
    case 'services':
    case 'places':
    case 'locations':
      return type!.toLowerCase() === 'locations' ? 'places' : type!.toLowerCase();
    default:
      return 'all';
  }
}

export function rankSearchHits(query: string, hits: SearchHit[]): SearchHit[] {
  const needle = query.trim().toLowerCase();
  const scored = hits.map((hit) => {
    const title = hit.title.toLowerCase();
    const subtitle = (hit.subtitle ?? '').toLowerCase();
    let score = 0;
    if (title === needle) {
      score += 100;
    } else if (title.startsWith(needle)) {
      score += 70;
    } else if (title.includes(needle)) {
      score += 40;
    }
    if (subtitle.includes(needle)) {
      score += 12;
    }
    if (hit.historical) {
      score -= 10;
    }
    return { hit, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.hit);
}

export function canIncludeStudyGroup(input: {
  visibility: string;
  courseOfferingId?: string | null;
  isMember: boolean;
  enrolledOfferingIds: string[];
  campusMember?: boolean;
  classMember?: boolean;
}): boolean {
  if (input.isMember) {
    return true;
  }
  const visibility = input.visibility === 'COURSE_MEMBERS' ? 'COURSE_MEMBERS_ONLY'
    : input.visibility === 'CLASS_MEMBERS' ? 'CLASS_MEMBERS_ONLY'
    : input.visibility;
  if (visibility === 'PUBLIC') {
    return true;
  }
  if (visibility === 'CAMPUS_ONLY') {
    return input.campusMember === true;
  }
  if (visibility === 'CLASS_MEMBERS_ONLY') {
    return input.classMember === true;
  }
  if (visibility === 'INVITE_ONLY') {
    return false;
  }
  if (input.courseOfferingId && input.enrolledOfferingIds.includes(input.courseOfferingId)) {
    return visibility === 'COURSE_MEMBERS_ONLY';
  }
  return false;
}
