export type UpNextCandidate = {
  id: string;
  status: string;
  startTime: Date;
  relevanceWeight: number;
};

export function formatYmd(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return asUtc - date.getTime();
}

export function zonedWallTime(ymd: string, hms: string, timeZone: string): Date {
  const utcGuess = new Date(`${ymd}T${hms}Z`);
  const offset = timeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

export function zonedDayBounds(now: Date, timeZone: string, calendarDate?: string) {
  const ymd = calendarDate ?? formatYmd(now, timeZone);
  const start = zonedWallTime(ymd, '00:00:00', timeZone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, ymd };
}

export function isFirstTimeHome(input: {
  enrollmentCount: number;
  membershipCount: number;
}): boolean {
  return input.enrollmentCount === 0 && input.membershipCount === 0;
}

export function selectUpNext(activities: UpNextCandidate[], now: Date): UpNextCandidate | null {
  const viable = activities.filter(
    (item) => item.status !== 'CANCELLED' && item.status !== 'COMPLETED',
  );
  if (viable.length === 0) {
    return null;
  }

  const ongoing = viable.filter((item) => item.status === 'ONGOING');
  if (ongoing.length > 0) {
    ongoing.sort((a, b) => b.relevanceWeight - a.relevanceWeight);
    return ongoing[0] ?? null;
  }

  const windowMs = 36 * 60 * 60 * 1000;
  const scored = viable.map((item) => {
    const delta = item.startTime.getTime() - now.getTime();
    const soonBoost = delta >= 0 && delta < windowMs ? 25 : 0;
    const ongoingBoost = item.status === 'ONGOING' ? 40 : 0;
    const recencyPenalty = Math.min(30, Math.max(0, delta / (60 * 60 * 1000)));
    return {
      item,
      score: item.relevanceWeight + soonBoost + ongoingBoost - recencyPenalty,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.item ?? null;
}

export function relativeTiming(start: Date, end: Date, status: string, now: Date): string {
  if (status === 'ONGOING' || (start <= now && end >= now)) {
    return 'Happening now';
  }
  if (status === 'CANCELLED') {
    return 'Cancelled';
  }
  const startDelta = start.getTime() - now.getTime();
  if (startDelta > 0 && startDelta < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(startDelta / 60000));
    return `Starts in ${minutes} min`;
  }
  return 'Upcoming';
}

export type AttentionCard = {
  id: string;
  priority: string;
  title: string;
  subtitle?: string | null;
  actionLabel?: string | null;
  sourceType: string;
  sourceId: string;
  route: string;
};

const priorityRank: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export function mergeAttention(items: AttentionCard[], limit = 5): AttentionCard[] {
  const seen = new Set<string>();
  const unique: AttentionCard[] = [];
  for (const item of items) {
    const key = `${item.sourceType}:${item.sourceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  unique.sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));
  return unique.slice(0, limit);
}

export function discoverWhen(startsAt: Date, timeZone: string, location?: string | null): string {
  const ymd = formatYmd(startsAt, timeZone);
  const today = formatYmd(new Date(), timeZone);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(startsAt);
  const day = ymd === today ? 'Tonight' : ymd;
  return location ? `${day} · ${location}` : `${day} · ${time}`;
}
