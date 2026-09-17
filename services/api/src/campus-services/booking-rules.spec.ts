import {
  allowedBookingTransitions,
  bookingActorRole,
  bookingNotificationType,
  canReadBooking,
  canTransitionBooking,
  capacityLimit,
  consumesSlot,
  evaluateAvailability,
  evaluateCapacity,
  isTerminalBookingStatus,
  leadTimeSatisfied,
  localDateKey,
  localDayOfWeek,
  localMinuteOfDay,
  windowsOverlap,
  withinCancellationWindow,
} from './booking-rules';

// Africa/Harare is UTC+2 with no daylight saving, so 08:00 local is 06:00Z.
const local = (isoDay: string, hours: number, minutes = 0) =>
  new Date(Date.UTC(
    Number(isoDay.slice(0, 4)),
    Number(isoDay.slice(5, 7)) - 1,
    Number(isoDay.slice(8, 10)),
    hours - 2,
    minutes,
  ));

describe('booking state transitions', () => {
  it('walks the happy path DRAFT -> REQUESTED -> CONFIRMED -> IN_PROGRESS -> COMPLETED', () => {
    expect(canTransitionBooking('DRAFT', 'REQUESTED', 'CUSTOMER')).toBe(true);
    expect(canTransitionBooking('REQUESTED', 'CONFIRMED', 'PROVIDER')).toBe(true);
    expect(canTransitionBooking('CONFIRMED', 'IN_PROGRESS', 'PROVIDER')).toBe(true);
    expect(canTransitionBooking('IN_PROGRESS', 'COMPLETED', 'PROVIDER')).toBe(true);
  });

  it('never lets a request confirm itself', () => {
    expect(canTransitionBooking('REQUESTED', 'CONFIRMED', 'CUSTOMER')).toBe(false);
    expect(canTransitionBooking('REQUESTED', 'IN_PROGRESS', 'PROVIDER')).toBe(false);
    expect(canTransitionBooking('DRAFT', 'CONFIRMED', 'PROVIDER')).toBe(false);
  });

  it('lets either side cancel a live booking but only the provider decline', () => {
    expect(canTransitionBooking('CONFIRMED', 'CANCELLED', 'CUSTOMER')).toBe(true);
    expect(canTransitionBooking('CONFIRMED', 'CANCELLED', 'PROVIDER')).toBe(true);
    expect(canTransitionBooking('REQUESTED', 'DECLINED', 'PROVIDER')).toBe(true);
    expect(canTransitionBooking('REQUESTED', 'DECLINED', 'CUSTOMER')).toBe(false);
  });

  it('treats completed, declined, cancelled and rescheduled as terminal', () => {
    for (const status of ['COMPLETED', 'DECLINED', 'CANCELLED', 'RESCHEDULED'] as const) {
      expect(isTerminalBookingStatus(status)).toBe(true);
      expect(allowedBookingTransitions(status)).toHaveLength(0);
    }
    expect(isTerminalBookingStatus('CONFIRMED')).toBe(false);
  });

  it('only counts confirmed and running bookings as holding a slot', () => {
    expect(consumesSlot('CONFIRMED')).toBe(true);
    expect(consumesSlot('IN_PROGRESS')).toBe(true);
    // Requesting is not confirming: a request must never hold a slot.
    expect(consumesSlot('REQUESTED')).toBe(false);
    expect(consumesSlot('CANCELLED')).toBe(false);
  });

  it('maps each transition to the spec notification type', () => {
    expect(bookingNotificationType('REQUESTED')).toBe('BOOKING_REQUESTED');
    expect(bookingNotificationType('CONFIRMED')).toBe('BOOKING_CONFIRMED');
    expect(bookingNotificationType('IN_PROGRESS')).toBe('BOOKING_STARTED');
    expect(bookingNotificationType('COMPLETED')).toBe('BOOKING_COMPLETED');
    expect(bookingNotificationType('DRAFT')).toBeNull();
  });
});

describe('booking readership', () => {
  const booking = { customerId: 'person_matthew', providerPersonId: 'person_hub' };

  it('admits only the customer, the owning provider and admins', () => {
    expect(bookingActorRole(booking, 'person_matthew')).toBe('CUSTOMER');
    expect(bookingActorRole(booking, 'person_hub')).toBe('PROVIDER');
    expect(bookingActorRole(booking, 'person_tawanda')).toBeNull();
    expect(bookingActorRole(booking, 'person_admin', true)).toBe('ADMIN');
    expect(canReadBooking(booking, 'person_tawanda')).toBe(false);
  });
});

describe('local campus time helpers', () => {
  it('reads the local day and minute at UTC+2', () => {
    expect(localMinuteOfDay(local('2026-09-16', 8, 30))).toBe(8 * 60 + 30);
    expect(localDateKey(local('2026-09-16', 8))).toBe('2026-09-16');
    // 2026-09-16 is a Wednesday.
    expect(localDayOfWeek(local('2026-09-16', 8))).toBe(3);
  });

  it('keeps late local evenings on the local date', () => {
    expect(localDateKey(local('2026-09-16', 23, 30))).toBe('2026-09-16');
  });
});

describe('evaluateAvailability', () => {
  const rules = [
    { dayOfWeek: 3, startMinute: 8 * 60, endMinute: 17 * 60, slotMinutes: 30, active: true },
  ];

  it('accepts a window inside the weekly rule', () => {
    const decision = evaluateAvailability(
      { start: local('2026-09-16', 9), end: local('2026-09-16', 9, 30) },
      rules,
      [],
    );
    expect(decision.available).toBe(true);
    expect(decision.rule).toBe(rules[0]);
  });

  it('rejects a window outside the opening hours', () => {
    const decision = evaluateAvailability(
      { start: local('2026-09-16', 19), end: local('2026-09-16', 19, 30) },
      rules,
      [],
    );
    expect(decision.available).toBe(false);
    expect(decision.reason).toBe('That time is outside the available hours.');
  });

  it('rejects a day with no rule', () => {
    const decision = evaluateAvailability(
      { start: local('2026-09-17', 9), end: local('2026-09-17', 9, 30) },
      rules,
      [],
    );
    expect(decision.available).toBe(false);
    expect(decision.reason).toBe('This service is not available on that day.');
  });

  it('rejects start times that do not land on a slot boundary', () => {
    const decision = evaluateAvailability(
      { start: local('2026-09-16', 9, 10), end: local('2026-09-16', 9, 40) },
      rules,
      [],
    );
    expect(decision.available).toBe(false);
    expect(decision.reason).toBe('Pick one of the offered start times.');
  });

  it('lets a closed exception override the weekly rule', () => {
    const decision = evaluateAvailability(
      { start: local('2026-09-16', 9), end: local('2026-09-16', 9, 30) },
      rules,
      [{ date: local('2026-09-16', 12), closed: true }],
    );
    expect(decision.available).toBe(false);
    expect(decision.reason).toBe('This service is closed on that date.');
  });

  it('lets an open exception replace the weekly hours', () => {
    const exceptions = [
      { date: local('2026-09-17', 12), closed: false, startMinute: 10 * 60, endMinute: 12 * 60 },
    ];
    expect(
      evaluateAvailability(
        { start: local('2026-09-17', 10, 30), end: local('2026-09-17', 11) },
        rules,
        exceptions,
      ).available,
    ).toBe(true);
    expect(
      evaluateAvailability(
        { start: local('2026-09-17', 13), end: local('2026-09-17', 13, 30) },
        rules,
        exceptions,
      ).available,
    ).toBe(false);
  });

  it('rejects inverted and multi-day windows', () => {
    expect(
      evaluateAvailability(
        { start: local('2026-09-16', 10), end: local('2026-09-16', 9) },
        rules,
        [],
      ).reason,
    ).toBe('The end time must be after the start time.');
    expect(
      evaluateAvailability(
        { start: local('2026-09-16', 23), end: local('2026-09-17', 1) },
        rules,
        [],
      ).reason,
    ).toBe('Bookings cannot span more than one day.');
  });
});

describe('capacity conflict detection', () => {
  const candidate = { start: local('2026-09-16', 9), end: local('2026-09-16', 9, 30) };

  it('detects overlapping windows and ignores adjacent ones', () => {
    expect(
      windowsOverlap(candidate, {
        start: local('2026-09-16', 9, 15),
        end: local('2026-09-16', 9, 45),
      }),
    ).toBe(true);
    expect(
      windowsOverlap(candidate, {
        start: local('2026-09-16', 9, 30),
        end: local('2026-09-16', 10),
      }),
    ).toBe(false);
  });

  it('derives the concurrency limit from the capacity type', () => {
    expect(capacityLimit({ capacityType: 'SINGLE', capacityValue: 9 })).toBe(1);
    expect(capacityLimit({ capacityType: 'UNLIMITED' })).toBeNull();
    expect(capacityLimit({ capacityType: 'LIMITED', capacityValue: 4 })).toBe(4);
    // A per-rule capacity overrides the service default.
    expect(capacityLimit({ capacityType: 'LIMITED', capacityValue: 4, ruleCapacity: 2 })).toBe(2);
  });

  it('refuses a second booking for a single-capacity slot', () => {
    const decision = evaluateCapacity(candidate, 1, [candidate], { capacityType: 'SINGLE' });
    expect(decision.available).toBe(false);
    expect(decision.reason).toBe('This booking is no longer available.');
    expect(decision.consumed).toBe(1);
    expect(decision.limit).toBe(1);
  });

  it('allows a non-overlapping booking for the same service', () => {
    const decision = evaluateCapacity(
      candidate,
      1,
      [{ start: local('2026-09-16', 10), end: local('2026-09-16', 10, 30) }],
      { capacityType: 'SINGLE' },
    );
    expect(decision.available).toBe(true);
    expect(decision.consumed).toBe(0);
  });

  it('sums quantities against a limited capacity', () => {
    const existing = [{ ...candidate, quantity: 3 }];
    expect(
      evaluateCapacity(candidate, 2, existing, { capacityType: 'LIMITED', capacityValue: 5 })
        .available,
    ).toBe(true);
    expect(
      evaluateCapacity(candidate, 3, existing, { capacityType: 'LIMITED', capacityValue: 5 })
        .available,
    ).toBe(false);
  });

  it('never blocks an unlimited-capacity service', () => {
    const decision = evaluateCapacity(candidate, 50, [{ ...candidate, quantity: 99 }], {
      capacityType: 'UNLIMITED',
    });
    expect(decision.available).toBe(true);
    expect(decision.limit).toBeNull();
  });
});

describe('time windows', () => {
  const now = new Date('2026-09-16T06:00:00.000Z');

  it('enforces the lead time', () => {
    expect(leadTimeSatisfied(new Date('2026-09-16T08:00:00.000Z'), 60, now)).toBe(true);
    expect(leadTimeSatisfied(new Date('2026-09-16T06:30:00.000Z'), 60, now)).toBe(false);
  });

  it('enforces the cancellation window', () => {
    expect(withinCancellationWindow(new Date('2026-09-16T09:00:00.000Z'), 120, now)).toBe(true);
    expect(withinCancellationWindow(new Date('2026-09-16T07:00:00.000Z'), 120, now)).toBe(false);
    expect(withinCancellationWindow(null, 120, now)).toBe(true);
  });
});
