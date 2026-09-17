import { BookingStatus } from '@prisma/client';

export const CAMPUS_TIMEZONE_OFFSET_MINUTES = 120;

export type BookingActorRole = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

type TransitionRule = {
  to: BookingStatus;
  roles: BookingActorRole[];
};

const TRANSITIONS: Record<BookingStatus, TransitionRule[]> = {
  DRAFT: [
    { to: 'REQUESTED', roles: ['CUSTOMER'] },
    { to: 'CANCELLED', roles: ['CUSTOMER', 'ADMIN'] },
  ],
  REQUESTED: [
    { to: 'CONFIRMED', roles: ['PROVIDER', 'ADMIN'] },
    { to: 'DECLINED', roles: ['PROVIDER', 'ADMIN'] },
    { to: 'RESCHEDULED', roles: ['CUSTOMER', 'PROVIDER', 'ADMIN'] },
    { to: 'CANCELLED', roles: ['CUSTOMER', 'PROVIDER', 'ADMIN'] },
  ],
  CONFIRMED: [
    { to: 'IN_PROGRESS', roles: ['PROVIDER', 'ADMIN'] },
    { to: 'RESCHEDULED', roles: ['CUSTOMER', 'PROVIDER', 'ADMIN'] },
    { to: 'CANCELLED', roles: ['CUSTOMER', 'PROVIDER', 'ADMIN'] },
  ],
  IN_PROGRESS: [
    { to: 'COMPLETED', roles: ['PROVIDER', 'ADMIN'] },
    { to: 'CANCELLED', roles: ['PROVIDER', 'ADMIN'] },
  ],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
  RESCHEDULED: [],
};

export const TERMINAL_BOOKING_STATUSES: BookingStatus[] = [
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
  'RESCHEDULED',
];

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return TERMINAL_BOOKING_STATUSES.includes(status);
}

export function allowedBookingTransitions(status: BookingStatus): BookingStatus[] {
  return TRANSITIONS[status].map((rule) => rule.to);
}

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
  role: BookingActorRole,
): boolean {
  return TRANSITIONS[from].some((rule) => rule.to === to && rule.roles.includes(role));
}

/**
 * A slot is only consumed by bookings that are confirmed or already running.
 * REQUESTED bookings are explicitly not holds: requesting is not confirming.
 */
export const SLOT_CONSUMING_STATUSES: BookingStatus[] = ['CONFIRMED', 'IN_PROGRESS'];

export function consumesSlot(status: BookingStatus): boolean {
  return SLOT_CONSUMING_STATUSES.includes(status);
}

export type TimeWindow = {
  start: Date;
  end: Date;
};

export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

export type AvailabilityRule = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  slotMinutes?: number | null;
  capacity?: number | null;
  active?: boolean;
};

export type AvailabilityException = {
  date: Date;
  closed: boolean;
  startMinute?: number | null;
  endMinute?: number | null;
};

export type AvailabilityDecision = {
  available: boolean;
  reason?: string;
  rule?: AvailabilityRule;
};

export function localDayOfWeek(value: Date, offsetMinutes = CAMPUS_TIMEZONE_OFFSET_MINUTES): number {
  return shift(value, offsetMinutes).getUTCDay();
}

export function localMinuteOfDay(
  value: Date,
  offsetMinutes = CAMPUS_TIMEZONE_OFFSET_MINUTES,
): number {
  const local = shift(value, offsetMinutes);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function localDateKey(value: Date, offsetMinutes = CAMPUS_TIMEZONE_OFFSET_MINUTES): string {
  return shift(value, offsetMinutes).toISOString().slice(0, 10);
}

/**
 * Evaluates a requested window against weekly rules and dated exceptions.
 * Exceptions win over rules: a closed exception blocks the day outright and an
 * open exception replaces the weekly window for that date.
 */
export function evaluateAvailability(
  window: TimeWindow,
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[],
  offsetMinutes = CAMPUS_TIMEZONE_OFFSET_MINUTES,
): AvailabilityDecision {
  if (window.end.getTime() <= window.start.getTime()) {
    return { available: false, reason: 'The end time must be after the start time.' };
  }
  if (localDateKey(window.start, offsetMinutes) !== localDateKey(window.end, offsetMinutes)) {
    return { available: false, reason: 'Bookings cannot span more than one day.' };
  }

  const startMinute = localMinuteOfDay(window.start, offsetMinutes);
  const endMinute = localMinuteOfDay(window.end, offsetMinutes);
  const dayKey = localDateKey(window.start, offsetMinutes);
  const exception = exceptions.find((item) => localDateKey(item.date, offsetMinutes) === dayKey);

  if (exception) {
    if (exception.closed) {
      return { available: false, reason: 'This service is closed on that date.' };
    }
    if (exception.startMinute != null && exception.endMinute != null) {
      const fits = startMinute >= exception.startMinute && endMinute <= exception.endMinute;
      return fits
        ? { available: true }
        : { available: false, reason: 'That time is outside the hours for that date.' };
    }
    return { available: true };
  }

  const dayOfWeek = localDayOfWeek(window.start, offsetMinutes);
  const active = rules.filter((rule) => rule.active !== false && rule.dayOfWeek === dayOfWeek);
  if (active.length === 0) {
    return { available: false, reason: 'This service is not available on that day.' };
  }
  const rule = active.find((item) => startMinute >= item.startMinute && endMinute <= item.endMinute);
  if (!rule) {
    return { available: false, reason: 'That time is outside the available hours.' };
  }
  if (rule.slotMinutes && startMinute % rule.slotMinutes !== rule.startMinute % rule.slotMinutes) {
    return { available: false, reason: 'Pick one of the offered start times.' };
  }
  return { available: true, rule };
}

export type CapacityInput = {
  capacityType: 'SINGLE' | 'LIMITED' | 'UNLIMITED';
  capacityValue?: number | null;
  ruleCapacity?: number | null;
};

/** Returns the number of concurrent bookings a slot allows, or null for unlimited. */
export function capacityLimit(input: CapacityInput): number | null {
  if (input.capacityType === 'UNLIMITED') {
    return null;
  }
  if (input.capacityType === 'SINGLE') {
    return 1;
  }
  const value = input.ruleCapacity ?? input.capacityValue;
  return value && value > 0 ? value : 1;
}

export type CapacityDecision = {
  available: boolean;
  reason?: string;
  consumed: number;
  limit: number | null;
};

/**
 * Counts the quantity already committed to windows overlapping the candidate.
 * `existing` must only contain slot-consuming bookings.
 */
export function evaluateCapacity(
  candidate: TimeWindow,
  quantity: number,
  existing: Array<TimeWindow & { quantity?: number }>,
  capacity: CapacityInput,
): CapacityDecision {
  const limit = capacityLimit(capacity);
  const consumed = existing
    .filter((item) => windowsOverlap(candidate, item))
    .reduce((total, item) => total + (item.quantity ?? 1), 0);
  if (limit === null) {
    return { available: true, consumed, limit };
  }
  if (consumed + quantity > limit) {
    return {
      available: false,
      reason: 'This booking is no longer available.',
      consumed,
      limit,
    };
  }
  return { available: true, consumed, limit };
}

export function leadTimeSatisfied(
  start: Date,
  leadTimeMinutes: number,
  now = new Date(),
): boolean {
  return start.getTime() - now.getTime() >= leadTimeMinutes * 60_000;
}

export function withinCancellationWindow(
  start: Date | null,
  cancellationWindowMinutes: number,
  now = new Date(),
): boolean {
  if (!start) {
    return true;
  }
  return start.getTime() - now.getTime() >= cancellationWindowMinutes * 60_000;
}

export function bookingActorRole(
  booking: { customerId: string; providerPersonId: string },
  viewerId: string,
  isAdmin = false,
): BookingActorRole | null {
  if (booking.customerId === viewerId) {
    return 'CUSTOMER';
  }
  if (booking.providerPersonId === viewerId) {
    return 'PROVIDER';
  }
  return isAdmin ? 'ADMIN' : null;
}

export function canReadBooking(
  booking: { customerId: string; providerPersonId: string },
  viewerId: string,
  isAdmin = false,
): boolean {
  return bookingActorRole(booking, viewerId, isAdmin) !== null;
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  DRAFT: 'Draft',
  REQUESTED: 'Requested',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
};

export function bookingStatusLabel(status: BookingStatus): string {
  return STATUS_LABELS[status];
}

const NOTIFICATION_TYPES: Partial<Record<BookingStatus, string>> = {
  REQUESTED: 'BOOKING_REQUESTED',
  CONFIRMED: 'BOOKING_CONFIRMED',
  DECLINED: 'BOOKING_DECLINED',
  CANCELLED: 'BOOKING_CANCELLED',
  RESCHEDULED: 'BOOKING_RESCHEDULED',
  IN_PROGRESS: 'BOOKING_STARTED',
  COMPLETED: 'BOOKING_COMPLETED',
};

export function bookingNotificationType(status: BookingStatus): string | null {
  return NOTIFICATION_TYPES[status] ?? null;
}

function shift(value: Date, offsetMinutes: number): Date {
  return new Date(value.getTime() + offsetMinutes * 60_000);
}
