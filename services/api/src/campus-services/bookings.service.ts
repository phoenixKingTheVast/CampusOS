import { Injectable } from '@nestjs/common';
import { ActivityStatus, BookingStatus, Prisma, ReportReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagingService } from '../messaging/messaging.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import {
  BookingActorRole,
  bookingActorRole,
  bookingNotificationType,
  bookingStatusLabel,
  canTransitionBooking,
  evaluateAvailability,
  evaluateCapacity,
  isTerminalBookingStatus,
  leadTimeSatisfied,
  SLOT_CONSUMING_STATUSES,
  withinCancellationWindow,
} from './booking-rules';
import {
  bookingPolicyAllowsBooking,
  bookingPolicyAutoConfirms,
  defaultBookingTypeFor,
  formatPrice,
  isServiceBookable,
  validateBookingFields,
} from './service-rules';

const SLOT_TAKEN_MESSAGE = 'This booking is no longer available.';

const bookingInclude = {
  service: {
    include: {
      category: true,
      provider: { include: { person: { select: { id: true, displayName: true, username: true } } } },
      bookingFields: { orderBy: { sortOrder: 'asc' as const } },
      availabilityRules: true,
      availabilityExceptions: true,
    },
  },
  provider: { include: { person: { select: { id: true, displayName: true, username: true } } } },
  customer: { select: { id: true, displayName: true, username: true, photoFileId: true } },
  location: true,
  fieldValues: true,
  review: true,
} satisfies Prisma.BookingInclude;

type BookingRecord = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly messaging: MessagingService,
  ) {}

  async listForCustomer(personId: string, query?: { status?: string; cursor?: string }) {
    const statuses = parseStatuses(query?.status);
    const rows = await this.prisma.booking.findMany({
      where: {
        customerId: personId,
        ...(statuses.length ? { status: { in: statuses } } : {}),
      },
      include: bookingInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: 30,
      ...(query?.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return {
      items: rows.map((row) => this.serialize(row, 'CUSTOMER')),
      nextCursor: rows.length === 30 ? rows[rows.length - 1].id : null,
    };
  }

  async listForProvider(personId: string, query?: { status?: string; cursor?: string }) {
    const provider = await this.requireOwnProvider(personId);
    const statuses = parseStatuses(query?.status);
    const rows = await this.prisma.booking.findMany({
      where: {
        providerId: provider.id,
        ...(statuses.length ? { status: { in: statuses } } : {}),
      },
      include: bookingInclude,
      orderBy: [{ status: 'asc' }, { requestedStart: 'asc' }, { createdAt: 'desc' }],
      take: 30,
      ...(query?.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return {
      items: rows.map((row) => this.serialize(row, 'PROVIDER')),
      nextCursor: rows.length === 30 ? rows[rows.length - 1].id : null,
    };
  }

  async get(personId: string, bookingId: string) {
    const { booking, role } = await this.requireBooking(personId, bookingId);
    return this.serialize(booking, role);
  }

  async conversation(personId: string, bookingId: string) {
    const { booking } = await this.requireBooking(personId, bookingId);
    const conversation = await this.ensureConversation(booking);
    return { conversationId: conversation.id, route: `/app/messages/${conversation.id}` };
  }

  async create(
    personId: string,
    input: {
      serviceId: string;
      requestedStart?: string;
      requestedEnd?: string;
      quantity?: number;
      customerNotes?: string;
      fieldValues?: Record<string, unknown>;
      clientActionId?: string;
      locationId?: string;
    },
  ) {
    if (input.clientActionId) {
      const existing = await this.prisma.booking.findUnique({
        where: {
          customerId_clientActionId: {
            customerId: personId,
            clientActionId: input.clientActionId,
          },
        },
        include: bookingInclude,
      });
      if (existing) {
        return { ...this.serialize(existing, 'CUSTOMER'), deduplicated: true };
      }
    }

    const service = await this.prisma.service.findUnique({
      where: { id: input.serviceId },
      include: {
        provider: { include: { person: { select: { id: true, displayName: true } } } },
        bookingFields: { orderBy: { sortOrder: 'asc' } },
        availabilityRules: true,
        availabilityExceptions: true,
      },
    });
    if (!service) {
      throw Errors.notFound('This service is no longer available.');
    }
    if (service.provider.personId === personId) {
      throw Errors.validation("You can't book your own service.");
    }
    if (!isServiceBookable(service.status) || service.provider.status !== 'ACTIVE') {
      throw Errors.conflict('This service is not currently taking bookings.');
    }
    if (!bookingPolicyAllowsBooking(service.bookingPolicy)) {
      throw Errors.validation('Message this provider to arrange this service.');
    }

    const quantity = Math.max(1, input.quantity ?? 1);
    const requiresTime = service.serviceMode === 'APPOINTMENT' || service.bookingType === 'APPOINTMENT';
    let start: Date | null = null;
    let end: Date | null = null;
    if (input.requestedStart) {
      start = new Date(input.requestedStart);
      if (Number.isNaN(start.getTime())) {
        throw Errors.validation('Choose a valid start time.');
      }
      end = input.requestedEnd
        ? new Date(input.requestedEnd)
        : new Date(start.getTime() + (service.durationMinutes ?? 60) * 60_000);
      const decision = evaluateAvailability(
        { start, end },
        service.availabilityRules,
        service.availabilityExceptions,
      );
      if (!decision.available) {
        throw Errors.validation(decision.reason ?? 'That time is not available.');
      }
      if (!leadTimeSatisfied(start, service.leadTimeMinutes)) {
        throw Errors.validation('That time is too soon for this service.');
      }
    } else if (requiresTime) {
      throw Errors.validation('Choose a time for this booking.');
    }

    const validation = validateBookingFields(service.bookingFields, input.fieldValues ?? {});
    if (validation.errors.length > 0) {
      throw Errors.validation(validation.errors[0].message, { fields: validation.errors });
    }

    const now = new Date();
    let booking: BookingRecord;
    try {
      booking = await this.prisma.booking.create({
        data: {
          id: newId('bkg'),
          serviceId: service.id,
          providerId: service.providerId,
          customerId: personId,
          bookingType: defaultBookingTypeFor(service.bookingPolicy, service.bookingType),
          status: 'REQUESTED',
          requestedStart: start,
          requestedEnd: end,
          quantity,
          customerNotes: input.customerNotes?.trim() || null,
          locationId: input.locationId ?? service.locationId,
          clientActionId: input.clientActionId,
          requestedAt: now,
          fieldValues: {
            create: validation.values.map((value) => ({
              id: newId('bfv'),
              fieldId: value.fieldId,
              key: value.key,
              label: value.label,
              valueText: value.valueText,
              valueNumber: value.valueNumber,
              valueBoolean: value.valueBoolean,
              valueDate: value.valueDate,
              valueJson: value.valueJson as Prisma.InputJsonValue | undefined,
              fileId: value.fileId,
            })),
          },
          statusHistory: {
            create: [
              {
                id: newId('bsh'),
                actorId: personId,
                fromStatus: 'DRAFT',
                toStatus: 'REQUESTED',
              },
            ],
          },
        },
        include: bookingInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.clientActionId
      ) {
        const raced = await this.prisma.booking.findUnique({
          where: {
            customerId_clientActionId: {
              customerId: personId,
              clientActionId: input.clientActionId,
            },
          },
          include: bookingInclude,
        });
        if (raced) {
          return { ...this.serialize(raced, 'CUSTOMER'), deduplicated: true };
        }
      }
      throw error;
    }

    // Booking creation opens (or reuses) the one Conversation engine, kind SERVICE.
    await this.ensureConversation(booking);
    await this.audit(personId, 'BOOKING_REQUESTED', {
      providerId: booking.providerId,
      serviceId: booking.serviceId,
      bookingId: booking.id,
    });
    await this.notifyTransition(booking, 'REQUESTED', personId);

    // OPEN_BOOKING still goes through the transactional confirm path so capacity
    // is re-validated the same way a provider confirmation would be.
    if (bookingPolicyAutoConfirms(service.bookingPolicy) && start) {
      try {
        return await this.confirm(service.provider.personId, booking.id, {}, { automatic: true });
      } catch (error) {
        void error;
        const reloaded = await this.prisma.booking.findUnique({
          where: { id: booking.id },
          include: bookingInclude,
        });
        return this.serialize(reloaded ?? booking, 'CUSTOMER');
      }
    }

    return this.serialize(booking, 'CUSTOMER');
  }

  /**
   * Transactionally confirms a booking. Everything is re-validated inside the
   * transaction — provider status, service status, availability rules and
   * exceptions, and slot capacity against other confirmed bookings — so a
   * REQUESTED booking never silently behaves as if it were already held.
   */
  async confirm(
    personId: string,
    bookingId: string,
    input: { message?: string; start?: string; end?: string; internalNotes?: string },
    options: { automatic?: boolean } = {},
  ) {
    const { booking, role } = await this.requireBooking(personId, bookingId);
    this.assertTransition(booking.status, 'CONFIRMED', role);

    const result = await this.prisma.$transaction(async (tx) => {
      // Bumping the service row takes a row-level write lock, which serialises
      // concurrent confirmations for the same service. The second transaction
      // therefore reads the first one's committed booking and loses on capacity.
      await tx.service.update({
        where: { id: booking.serviceId },
        data: { version: { increment: 1 } },
      });

      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          location: true,
          service: {
            include: {
              provider: true,
              location: true,
              availabilityRules: true,
              availabilityExceptions: true,
            },
          },
        },
      });
      if (!current) {
        throw Errors.notFound('This booking is no longer available.');
      }
      if (!canTransitionBooking(current.status, 'CONFIRMED', role)) {
        throw Errors.conflict(SLOT_TAKEN_MESSAGE);
      }
      if (current.service.provider.status !== 'ACTIVE') {
        throw Errors.conflict('This provider is not currently accepting bookings.');
      }
      if (!isServiceBookable(current.service.status)) {
        throw Errors.conflict('This service is not currently taking bookings.');
      }

      const start = input.start ? new Date(input.start) : current.requestedStart;
      if (!start) {
        throw Errors.validation('Set a time before confirming this booking.');
      }
      const end = input.end
        ? new Date(input.end)
        : current.requestedEnd ??
          new Date(start.getTime() + (current.service.durationMinutes ?? 60) * 60_000);

      const availability = evaluateAvailability(
        { start, end },
        current.service.availabilityRules,
        current.service.availabilityExceptions,
      );
      if (!availability.available) {
        throw Errors.conflict(availability.reason ?? SLOT_TAKEN_MESSAGE);
      }

      const competing = await tx.booking.findMany({
        where: {
          serviceId: current.serviceId,
          id: { not: current.id },
          status: { in: SLOT_CONSUMING_STATUSES },
          confirmedStart: { lt: end },
          confirmedEnd: { gt: start },
        },
        select: { confirmedStart: true, confirmedEnd: true, quantity: true },
      });
      const capacity = evaluateCapacity(
        { start, end },
        current.quantity,
        competing.map((row) => ({
          start: row.confirmedStart as Date,
          end: row.confirmedEnd as Date,
          quantity: row.quantity,
        })),
        {
          capacityType: current.service.capacityType,
          capacityValue: current.service.capacityValue,
          ruleCapacity: availability.rule?.capacity ?? null,
        },
      );
      if (!capacity.available) {
        throw Errors.conflict(SLOT_TAKEN_MESSAGE);
      }

      const guarded = await tx.booking.updateMany({
        where: { id: current.id, status: current.status, version: current.version },
        data: {
          status: 'CONFIRMED',
          confirmedStart: start,
          confirmedEnd: end,
          confirmedAt: new Date(),
          providerMessage: input.message?.trim() || current.providerMessage,
          providerInternalNotes: input.internalNotes?.trim() ?? current.providerInternalNotes,
          version: { increment: 1 },
        },
      });
      if (guarded.count === 0) {
        throw Errors.conflict(SLOT_TAKEN_MESSAGE);
      }

      const activityId = await this.syncActivity(tx, current.id, {
        activityId: current.activityId,
        title: current.service.title,
        providerName: current.service.provider.providerName,
        start,
        end,
        timezone: current.timezone,
        customerId: current.customerId,
        providerId: current.providerId,
        locationLabel: current.location?.label ?? current.service.location?.label ?? null,
        status: 'SCHEDULED',
      });
      if (activityId !== current.activityId) {
        await tx.booking.update({ where: { id: current.id }, data: { activityId } });
      }

      await tx.bookingStatusHistory.create({
        data: {
          id: newId('bsh'),
          bookingId: current.id,
          actorId: personId,
          fromStatus: current.status,
          toStatus: 'CONFIRMED',
          reason: options.automatic ? 'Automatically confirmed by open booking policy' : null,
        },
      });
      await tx.serviceAudit.create({
        data: {
          id: newId('saudit'),
          actorId: personId,
          action: 'BOOKING_CONFIRMED',
          providerId: current.providerId,
          serviceId: current.serviceId,
          bookingId: current.id,
          metadata: {
            start: start.toISOString(),
            end: end.toISOString(),
            capacityConsumed: capacity.consumed,
            capacityLimit: capacity.limit,
            automatic: Boolean(options.automatic),
          },
        },
      });

      return tx.booking.findUniqueOrThrow({ where: { id: current.id }, include: bookingInclude });
    });

    await this.setReminder(result);
    await this.notifyTransition(result, 'CONFIRMED', personId);
    return this.serialize(result, role);
  }

  async decline(personId: string, bookingId: string, reason?: string) {
    const updated = await this.transition(personId, bookingId, 'DECLINED', {
      reason,
      data: { declineReason: reason?.trim() || null, declinedAt: new Date() },
      cancelActivity: true,
    });
    return updated;
  }

  async start(personId: string, bookingId: string) {
    return this.transition(personId, bookingId, 'IN_PROGRESS', {
      data: { startedAt: new Date() },
      activityStatus: 'ONGOING',
    });
  }

  async complete(personId: string, bookingId: string, notes?: string) {
    const { booking } = await this.requireBooking(personId, bookingId);
    const result = await this.transition(personId, bookingId, 'COMPLETED', {
      data: { completedAt: new Date(), providerMessage: notes?.trim() || undefined },
      activityStatus: 'COMPLETED',
    });
    await this.prisma.serviceProviderProfile.update({
      where: { id: booking.providerId },
      data: { completedBookings: { increment: 1 } },
    });
    return result;
  }

  async cancel(personId: string, bookingId: string, reason?: string) {
    const { booking, role } = await this.requireBooking(personId, bookingId);
    if (
      role === 'CUSTOMER' &&
      booking.status === 'CONFIRMED' &&
      !withinCancellationWindow(booking.confirmedStart, booking.service.cancellationWindowMinutes)
    ) {
      throw Errors.validation(
        'This booking is too close to its start time to cancel. Message the provider instead.',
      );
    }
    return this.transition(personId, bookingId, 'CANCELLED', {
      reason,
      data: {
        cancellationReason: reason?.trim() || null,
        cancelledAt: new Date(),
        cancelledById: personId,
      },
      cancelActivity: true,
    });
  }

  /**
   * Rescheduling closes the current booking as RESCHEDULED and opens a successor
   * that must be confirmed again on its own merits.
   */
  async reschedule(
    personId: string,
    bookingId: string,
    input: { start: string; end?: string; reason?: string },
  ) {
    const { booking, role } = await this.requireBooking(personId, bookingId);
    this.assertTransition(booking.status, 'RESCHEDULED', role);

    const start = new Date(input.start);
    if (Number.isNaN(start.getTime())) {
      throw Errors.validation('Choose a valid start time.');
    }
    const end = input.end
      ? new Date(input.end)
      : new Date(start.getTime() + (booking.service.durationMinutes ?? 60) * 60_000);
    const availability = evaluateAvailability(
      { start, end },
      booking.service.availabilityRules,
      booking.service.availabilityExceptions,
    );
    if (!availability.available) {
      throw Errors.validation(availability.reason ?? 'That time is not available.');
    }

    const successor = await this.prisma.$transaction(async (tx) => {
      const guarded = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status, version: booking.version },
        data: {
          status: 'RESCHEDULED',
          cancellationReason: input.reason?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (guarded.count === 0) {
        throw Errors.conflict('This booking changed while you were editing it.');
      }
      if (booking.activityId) {
        await tx.activity.update({
          where: { id: booking.activityId },
          data: { status: 'RESCHEDULED' },
        });
      }
      const created = await tx.booking.create({
        data: {
          id: newId('bkg'),
          serviceId: booking.serviceId,
          providerId: booking.providerId,
          customerId: booking.customerId,
          bookingType: booking.bookingType,
          status: 'REQUESTED',
          requestedStart: start,
          requestedEnd: end,
          quantity: booking.quantity,
          customerNotes: booking.customerNotes,
          providerInternalNotes: booking.providerInternalNotes,
          locationId: booking.locationId,
          conversationId: booking.conversationId,
          rescheduledFromBookingId: booking.id,
          requestedAt: new Date(),
          fieldValues: {
            create: booking.fieldValues.map((value) => ({
              id: newId('bfv'),
              fieldId: value.fieldId,
              key: value.key,
              label: value.label,
              valueText: value.valueText,
              valueNumber: value.valueNumber,
              valueBoolean: value.valueBoolean,
              valueDate: value.valueDate,
              valueJson: value.valueJson as Prisma.InputJsonValue | undefined,
              fileId: value.fileId,
            })),
          },
        },
        include: bookingInclude,
      });
      await tx.bookingStatusHistory.createMany({
        data: [
          {
            id: newId('bsh'),
            bookingId: booking.id,
            actorId: personId,
            fromStatus: booking.status,
            toStatus: 'RESCHEDULED',
            reason: input.reason?.trim() || null,
          },
          {
            id: newId('bsh'),
            bookingId: created.id,
            actorId: personId,
            fromStatus: 'DRAFT',
            toStatus: 'REQUESTED',
            reason: `Rescheduled from ${booking.id}`,
          },
        ],
      });
      await tx.serviceAudit.create({
        data: {
          id: newId('saudit'),
          actorId: personId,
          action: 'BOOKING_RESCHEDULED',
          providerId: booking.providerId,
          serviceId: booking.serviceId,
          bookingId: booking.id,
          metadata: { successorBookingId: created.id, start: start.toISOString() },
        },
      });
      return created;
    });

    await this.notifyTransition(successor, 'RESCHEDULED', personId);
    return this.serialize(successor, role);
  }

  async createReview(
    personId: string,
    bookingId: string,
    input: { rating: number; body?: string },
  ) {
    const { booking, role } = await this.requireBooking(personId, bookingId);
    if (role !== 'CUSTOMER') {
      throw Errors.permissionDenied('Only the customer can review a booking.');
    }
    if (booking.status !== 'COMPLETED') {
      throw Errors.validation('You can review this service once the booking is completed.');
    }
    if (booking.review) {
      throw Errors.conflict('You have already reviewed this booking.');
    }
    const rating = Math.round(input.rating);
    if (rating < 1 || rating > 5) {
      throw Errors.validation('Choose a rating between 1 and 5.');
    }

    const review = await this.prisma.serviceReview.create({
      data: {
        id: newId('srev'),
        serviceId: booking.serviceId,
        providerId: booking.providerId,
        bookingId: booking.id,
        authorId: personId,
        rating,
        body: input.body?.trim() || null,
      },
    });
    await this.recomputeRatings(booking.serviceId, booking.providerId);
    await this.audit(personId, 'SERVICE_REVIEWED', {
      providerId: booking.providerId,
      serviceId: booking.serviceId,
      bookingId: booking.id,
      reviewId: review.id,
    });
    await this.notifications.emit({
      personId: booking.provider.personId,
      type: 'SERVICE_REVIEW',
      category: 'SERVICE',
      title: 'New review',
      body: `${booking.customer.displayName ?? 'A customer'} reviewed ${booking.service.title}.`,
      sourceType: 'SERVICE',
      sourceId: booking.serviceId,
      sourceEventId: review.id,
    });
    return this.serializeReview(review, { authorName: booking.customer.displayName });
  }

  async reportReview(personId: string, reviewId: string, input: { reason: string; details?: string }) {
    const review = await this.prisma.serviceReview.findUnique({ where: { id: reviewId } });
    if (!review || review.status === 'REMOVED') {
      throw Errors.notFound('This review is no longer available.');
    }
    return this.prisma.moderationReport.create({
      data: {
        id: newId('rpt'),
        reporterId: personId,
        targetType: 'SERVICE_REVIEW',
        targetId: reviewId,
        reviewId,
        reason: Object.values(ReportReason).includes(input.reason as ReportReason)
          ? (input.reason as ReportReason)
          : ReportReason.OTHER,
        details: input.details,
      },
    });
  }

  async respondToReview(personId: string, reviewId: string, body: string) {
    const provider = await this.requireOwnProvider(personId);
    const review = await this.prisma.serviceReview.findUnique({ where: { id: reviewId } });
    if (!review || review.providerId !== provider.id) {
      throw Errors.notFound('This review is no longer available.');
    }
    const text = body.trim();
    if (!text) {
      throw Errors.validation('Enter a response.');
    }
    const updated = await this.prisma.serviceReview.update({
      where: { id: reviewId },
      data: { providerResponse: text, providerRespondedAt: new Date() },
    });
    await this.audit(personId, 'SERVICE_REVIEW_RESPONDED', {
      providerId: provider.id,
      serviceId: review.serviceId,
      reviewId,
    });
    return this.serializeReview(updated, {});
  }

  async requireOwnProvider(personId: string) {
    const provider = await this.prisma.serviceProviderProfile.findUnique({
      where: { personId },
    });
    if (!provider) {
      throw Errors.permissionDenied('Set up a provider profile to manage services.');
    }
    return provider;
  }

  async recomputeRatings(serviceId: string, providerId: string) {
    const [serviceAggregate, providerAggregate] = await Promise.all([
      this.prisma.serviceReview.aggregate({
        where: { serviceId, status: 'PUBLISHED' },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.serviceReview.aggregate({
        where: { providerId, status: 'PUBLISHED' },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);
    await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        ratingAverage: serviceAggregate._avg.rating,
        ratingCount: serviceAggregate._count._all,
      },
    });
    await this.prisma.serviceProviderProfile.update({
      where: { id: providerId },
      data: {
        ratingAverage: providerAggregate._avg.rating,
        ratingCount: providerAggregate._count._all,
      },
    });
  }

  serialize(booking: BookingRecord, role: BookingActorRole) {
    const start = booking.confirmedStart ?? booking.requestedStart;
    const end = booking.confirmedEnd ?? booking.requestedEnd;
    const base = {
      id: booking.id,
      status: booking.status,
      statusLabel: bookingStatusLabel(booking.status),
      bookingType: booking.bookingType,
      quantity: booking.quantity,
      timezone: booking.timezone,
      requestedStart: booking.requestedStart?.toISOString() ?? null,
      requestedEnd: booking.requestedEnd?.toISOString() ?? null,
      confirmedStart: booking.confirmedStart?.toISOString() ?? null,
      confirmedEnd: booking.confirmedEnd?.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
      customerNotes: booking.customerNotes,
      providerMessage: booking.providerMessage,
      declineReason: booking.declineReason,
      cancellationReason: booking.cancellationReason,
      quotedAmount: booking.quotedAmount == null ? null : Number(booking.quotedAmount),
      quotedCurrency: booking.quotedCurrency,
      conversationId: booking.conversationId,
      activityId: booking.activityId,
      rescheduledFromBookingId: booking.rescheduledFromBookingId,
      terminal: isTerminalBookingStatus(booking.status),
      service: {
        id: booking.service.id,
        title: booking.service.title,
        categoryKey: booking.service.category.key,
        categoryLabel: booking.service.category.label,
        serviceMode: booking.service.serviceMode,
        priceLabel: formatPrice(booking.service),
        route: `/app/explore/service/${booking.service.id}`,
      },
      provider: {
        id: booking.provider.id,
        providerName: booking.provider.providerName,
        verified: booking.provider.verified,
        route: `/app/explore/provider/${booking.provider.id}`,
      },
      location: booking.location
        ? {
            label: booking.location.label,
            building: booking.location.building,
            room: booking.location.room,
            address: booking.location.address,
            instructions: booking.location.instructions,
            accessibilityInformation: booking.location.accessibilityInformation,
          }
        : null,
      fieldValues: booking.fieldValues.map((value) => ({
        key: value.key,
        label: value.label,
        value: displayFieldValue(value),
      })),
      review: booking.review
        ? { id: booking.review.id, rating: booking.review.rating, body: booking.review.body }
        : null,
      // "Confirmed — 18 September at 10:30" style label for assistive technology.
      stateLabel: stateLabel(booking.status, start),
      accessibilityLabel: `${booking.service.title}. ${stateLabel(booking.status, start)}.`,
      route: `/app/services/bookings/${booking.id}`,
      availableActions: availableActions(booking.status, role),
      viewerRole: role,
    };

    if (role === 'CUSTOMER') {
      // Provider-internal notes are never serialised into a customer response.
      return {
        ...base,
        provider: {
          ...base.provider,
          ratingAverage: booking.provider.ratingAverage,
          ratingCount: booking.provider.ratingCount,
        },
      };
    }

    return {
      ...base,
      providerInternalNotes: booking.providerInternalNotes,
      // Providers only ever receive identity, never phone numbers, registration
      // numbers or academic records.
      customer: {
        personId: booking.customer.id,
        displayName: booking.customer.displayName,
        username: booking.customer.username,
        photoFileId: booking.customer.photoFileId,
        route: `/app/profile/${booking.customer.id}`,
      },
    };
  }

  serializeReview(
    review: {
      id: string;
      rating: number;
      body: string | null;
      status: string;
      providerResponse: string | null;
      providerRespondedAt: Date | null;
      createdAt: Date;
      serviceId: string;
      authorId?: string;
    },
    extra: { authorName?: string | null },
  ) {
    return {
      id: review.id,
      rating: review.rating,
      body: review.body,
      status: review.status,
      authorName: extra.authorName ?? null,
      providerResponse: review.providerResponse,
      providerRespondedAt: review.providerRespondedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
      serviceId: review.serviceId,
      accessibilityLabel: `${review.rating} out of 5 stars.`,
    };
  }

  async audit(
    actorId: string,
    action: string,
    refs: {
      providerId?: string | null;
      serviceId?: string | null;
      bookingId?: string | null;
      reviewId?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await this.prisma.serviceAudit.create({
      data: {
        id: newId('saudit'),
        actorId,
        action,
        providerId: refs.providerId ?? null,
        serviceId: refs.serviceId ?? null,
        bookingId: refs.bookingId ?? null,
        reviewId: refs.reviewId ?? null,
        metadata: refs.metadata,
      },
    });
  }

  private async requireBooking(personId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: bookingInclude,
    });
    if (!booking) {
      throw Errors.notFound('This booking is no longer available.');
    }
    // Only the customer, the owning provider and admins may read a booking.
    const role = bookingActorRole(
      { customerId: booking.customerId, providerPersonId: booking.provider.personId },
      personId,
    );
    if (!role) {
      throw Errors.notFound('This booking is no longer available.');
    }
    return { booking, role };
  }

  private assertTransition(from: BookingStatus, to: BookingStatus, role: BookingActorRole) {
    if (!canTransitionBooking(from, to, role)) {
      throw Errors.conflict(
        `A ${bookingStatusLabel(from).toLowerCase()} booking cannot be changed to ${bookingStatusLabel(to).toLowerCase()}.`,
      );
    }
  }

  private async transition(
    personId: string,
    bookingId: string,
    to: BookingStatus,
    options: {
      reason?: string;
      data?: Prisma.BookingUpdateManyMutationInput;
      activityStatus?: ActivityStatus;
      cancelActivity?: boolean;
    },
  ) {
    const { booking, role } = await this.requireBooking(personId, bookingId);
    this.assertTransition(booking.status, to, role);

    const updated = await this.prisma.$transaction(async (tx) => {
      const guarded = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status, version: booking.version },
        data: { ...options.data, status: to, version: { increment: 1 } },
      });
      if (guarded.count === 0) {
        throw Errors.conflict('This booking changed while you were editing it.');
      }
      if (booking.activityId) {
        await tx.activity.update({
          where: { id: booking.activityId },
          data: {
            status: options.cancelActivity ? 'CANCELLED' : (options.activityStatus ?? 'SCHEDULED'),
          },
        });
      }
      await tx.bookingStatusHistory.create({
        data: {
          id: newId('bsh'),
          bookingId: booking.id,
          actorId: personId,
          fromStatus: booking.status,
          toStatus: to,
          reason: options.reason?.trim() || null,
        },
      });
      await tx.serviceAudit.create({
        data: {
          id: newId('saudit'),
          actorId: personId,
          action: `BOOKING_${to}`,
          providerId: booking.providerId,
          serviceId: booking.serviceId,
          bookingId: booking.id,
          metadata: { role, reason: options.reason ?? null },
        },
      });
      return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
    });

    await this.notifyTransition(updated, to, personId);
    return this.serialize(updated, role);
  }

  private async syncActivity(
    tx: Prisma.TransactionClient,
    bookingId: string,
    input: {
      activityId: string | null;
      title: string;
      providerName: string;
      start: Date;
      end: Date;
      timezone: string;
      customerId: string;
      providerId: string;
      locationLabel: string | null;
      status: ActivityStatus;
    },
  ): Promise<string> {
    const data = {
      type: 'SERVICE_BOOKING' as const,
      title: `${input.title} — ${input.providerName}`,
      startTime: input.start,
      endTime: input.end,
      timezone: input.timezone,
      location: input.locationLabel,
      status: input.status,
      relevanceWeight: 60,
      sourceType: 'BOOKING',
      sourceId: bookingId,
      organizerType: 'SERVICE_PROVIDER',
      organizerId: input.providerId,
      visibility: 'PRIVATE',
      ownerPersonId: input.customerId,
    };
    if (input.activityId) {
      await tx.activity.update({ where: { id: input.activityId }, data });
      return input.activityId;
    }
    const created = await tx.activity.create({ data: { id: newId('activity'), ...data } });
    return created.id;
  }

  /** Reminders come from the existing ActivityReminder path, not a booking engine. */
  private async setReminder(booking: BookingRecord) {
    if (!booking.activityId) {
      return;
    }
    await this.prisma.activityReminder.upsert({
      where: {
        activityId_personId_offsetMinutes: {
          activityId: booking.activityId,
          personId: booking.customerId,
          offsetMinutes: 60,
        },
      },
      update: {},
      create: {
        id: newId('arem'),
        activityId: booking.activityId,
        personId: booking.customerId,
        offsetMinutes: 60,
      },
    });
  }

  private async ensureConversation(booking: BookingRecord) {
    if (booking.conversationId) {
      const existing = await this.prisma.conversation.findUnique({
        where: { id: booking.conversationId },
      });
      if (existing) {
        return existing;
      }
    }
    const conversation = await this.messaging.ensureServiceConversation({
      bookingId: booking.id,
      title: booking.service.title,
      customerId: booking.customerId,
      providerPersonId: booking.provider.personId,
    });
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { conversationId: conversation.id },
    });
    return conversation;
  }

  private async notifyTransition(
    booking: BookingRecord,
    status: BookingStatus,
    actorId: string,
  ) {
    const type = bookingNotificationType(status);
    if (!type) {
      return;
    }
    const when = booking.confirmedStart ?? booking.requestedStart;
    const label = stateLabel(status, when);
    const providerPersonId = booking.provider.personId;
    const recipients: Array<{ personId: string; title: string; body: string }> = [];

    if (status === 'REQUESTED') {
      recipients.push({
        personId: providerPersonId,
        title: 'New booking request',
        body: `${booking.customer.displayName ?? 'A customer'} requested ${booking.service.title}.`,
      });
    } else {
      if (actorId !== booking.customerId) {
        recipients.push({
          personId: booking.customerId,
          title: booking.service.title,
          body: `${label} — ${booking.provider.providerName}`,
        });
      }
      if (actorId !== providerPersonId) {
        recipients.push({
          personId: providerPersonId,
          title: booking.service.title,
          body: `${label} — ${booking.customer.displayName ?? 'customer'}`,
        });
      }
    }

    for (const recipient of recipients) {
      await this.notifications.emit({
        personId: recipient.personId,
        type,
        category: 'SERVICE',
        title: recipient.title,
        body: recipient.body,
        sourceType: 'BOOKING',
        sourceId: booking.id,
        sourceActivityId: booking.activityId ?? undefined,
        deepLink: `/app/services/bookings/${booking.id}`,
        sourceEventId: `${booking.id}:${status}:${booking.version}`,
        priority: status === 'CONFIRMED' || status === 'DECLINED' ? 'HIGH' : 'NORMAL',
      });
    }
  }
}

function parseStatuses(value?: string): BookingStatus[] {
  if (!value || value === 'ALL') {
    return [];
  }
  if (value === 'ACTIVE') {
    return ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'];
  }
  if (value === 'PAST') {
    return ['COMPLETED', 'DECLINED', 'CANCELLED', 'RESCHEDULED'];
  }
  return value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is BookingStatus =>
      Object.values(BookingStatus).includes(item as BookingStatus),
    );
}

function availableActions(status: BookingStatus, role: BookingActorRole): string[] {
  const actions: string[] = ['OPEN_CONVERSATION'];
  if (role === 'CUSTOMER') {
    if (status === 'REQUESTED' || status === 'CONFIRMED') {
      actions.push('CANCEL', 'RESCHEDULE');
    }
    if (status === 'COMPLETED') {
      actions.push('REVIEW');
    }
  }
  if (role === 'PROVIDER' || role === 'ADMIN') {
    if (status === 'REQUESTED') {
      actions.push('CONFIRM', 'DECLINE', 'RESCHEDULE');
    }
    if (status === 'CONFIRMED') {
      actions.push('START', 'CANCEL', 'RESCHEDULE');
    }
    if (status === 'IN_PROGRESS') {
      actions.push('COMPLETE');
    }
  }
  return actions;
}

function stateLabel(status: BookingStatus, when: Date | null): string {
  const label = bookingStatusLabel(status);
  if (!when) {
    return label;
  }
  const local = new Date(when.getTime() + 120 * 60_000);
  const day = local.getUTCDate();
  const month = local.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  const hours = String(local.getUTCHours()).padStart(2, '0');
  const minutes = String(local.getUTCMinutes()).padStart(2, '0');
  return `${label} — ${day} ${month} at ${hours}:${minutes}`;
}

function displayFieldValue(value: {
  valueText: string | null;
  valueNumber: Prisma.Decimal | null;
  valueBoolean: boolean | null;
  valueDate: Date | null;
  valueJson: Prisma.JsonValue | null;
}): string {
  if (value.valueText) return value.valueText;
  if (value.valueNumber != null) return String(Number(value.valueNumber));
  if (value.valueBoolean != null) return value.valueBoolean ? 'Yes' : 'No';
  if (value.valueDate) return value.valueDate.toISOString();
  if (Array.isArray(value.valueJson)) return value.valueJson.map(String).join(', ');
  return '';
}
