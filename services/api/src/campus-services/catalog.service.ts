import { Injectable } from '@nestjs/common';
import { Prisma, ServiceCategoryKey, ServiceMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import {
  CAMPUS_TIMEZONE_OFFSET_MINUTES,
  evaluateCapacity,
  localDateKey,
  SLOT_CONSUMING_STATUSES,
} from './booking-rules';
import {
  DISCOVERABLE_SERVICE_STATUSES,
  formatPrice,
  isServiceBookable,
  selectOptions,
} from './service-rules';

const serviceInclude = {
  category: true,
  provider: { include: { person: { select: { id: true, displayName: true, username: true } } } },
  location: true,
  bookingFields: { where: { active: true }, orderBy: { sortOrder: 'asc' as const } },
  availabilityRules: { where: { active: true } },
  availabilityExceptions: true,
} satisfies Prisma.ServiceInclude;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Categories are configuration, never hard-coded in the client. */
  async categories() {
    const items = await this.prisma.serviceCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    const counts = await this.prisma.service.groupBy({
      by: ['categoryId'],
      where: { status: { in: DISCOVERABLE_SERVICE_STATUSES } },
      _count: { _all: true },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        key: item.key,
        label: item.label,
        description: item.description,
        serviceCount: counts.find((row) => row.categoryId === item.id)?._count._all ?? 0,
        route: `/app/explore/services?category=${item.key}`,
      })),
    };
  }

  async listServices(query: {
    category?: string;
    q?: string;
    mode?: string;
    cursor?: string;
  }) {
    const categoryKey = parseCategory(query.category);
    const mode = parseMode(query.mode);
    const search = query.q?.trim();
    const rows = await this.prisma.service.findMany({
      where: {
        status: { in: DISCOVERABLE_SERVICE_STATUSES },
        provider: { status: 'ACTIVE' },
        ...(categoryKey ? { category: { key: categoryKey } } : {}),
        ...(mode ? { serviceMode: mode } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { summary: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: serviceInclude,
      orderBy: [{ status: 'asc' }, { ratingAverage: 'desc' }, { title: 'asc' }],
      take: 30,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return {
      items: rows.map((row) => this.summarize(row)),
      nextCursor: rows.length === 30 ? rows[rows.length - 1].id : null,
    };
  }

  async getService(personId: string, serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: serviceInclude,
    });
    if (!service) {
      throw Errors.notFound('This service is no longer available.');
    }
    const owner = service.provider.personId === personId;
    if (!owner && !DISCOVERABLE_SERVICE_STATUSES.includes(service.status)) {
      throw Errors.notFound('This service is no longer available.');
    }
    const reviews = await this.prisma.serviceReview.findMany({
      where: { serviceId, status: 'PUBLISHED' },
      include: { author: { select: { displayName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const reviewableBooking = await this.prisma.booking.findFirst({
      where: { serviceId, customerId: personId, status: 'COMPLETED', review: null },
      select: { id: true },
    });

    return {
      ...this.summarize(service),
      description: service.description,
      pricingNotes: service.pricingNotes,
      bookingPolicy: service.bookingPolicy,
      bookingType: service.bookingType,
      capacityType: service.capacityType,
      capacityValue: service.capacityValue,
      durationMinutes: service.durationMinutes,
      leadTimeMinutes: service.leadTimeMinutes,
      cancellationWindowMinutes: service.cancellationWindowMinutes,
      unavailableReason: service.unavailableReason,
      owner,
      canBook:
        !owner && isServiceBookable(service.status) && service.provider.status === 'ACTIVE',
      bookingFields: service.bookingFields.map((field) => this.serializeField(field)),
      weeklyAvailability: service.availabilityRules
        .slice()
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)
        .map((rule) => ({
          id: rule.id,
          dayOfWeek: rule.dayOfWeek,
          dayLabel: DAY_LABELS[rule.dayOfWeek],
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
          startLabel: minuteLabel(rule.startMinute),
          endLabel: minuteLabel(rule.endMinute),
          slotMinutes: rule.slotMinutes,
          capacity: rule.capacity,
        })),
      exceptions: service.availabilityExceptions.map((item) => ({
        id: item.id,
        date: localDateKey(item.date),
        closed: item.closed,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        reason: item.reason,
      })),
      location: service.location
        ? {
            id: service.location.id,
            label: service.location.label,
            building: service.location.building,
            room: service.location.room,
            address: service.location.address,
            instructions: service.location.instructions,
            accessibilityInformation: service.location.accessibilityInformation,
          }
        : null,
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        body: review.body,
        authorName: review.author.displayName ?? review.author.username,
        providerResponse: review.providerResponse,
        createdAt: review.createdAt.toISOString(),
        accessibilityLabel: `${review.rating} out of 5 stars.`,
      })),
      reviewableBookingId: reviewableBooking?.id ?? null,
    };
  }

  async bookingForm(personId: string, serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: serviceInclude,
    });
    if (!service || !DISCOVERABLE_SERVICE_STATUSES.includes(service.status)) {
      throw Errors.notFound('This service is no longer available.');
    }
    if (service.provider.personId === personId) {
      throw Errors.validation("You can't book your own service.");
    }
    return {
      serviceId: service.id,
      title: service.title,
      requiresTime:
        service.serviceMode === 'APPOINTMENT' || service.bookingType === 'APPOINTMENT',
      durationMinutes: service.durationMinutes,
      bookingPolicy: service.bookingPolicy,
      policyMessage: policyMessage(service.bookingPolicy),
      priceLabel: formatPrice(service),
      fields: service.bookingFields.map((field) => this.serializeField(field)),
    };
  }

  /** Slots are computed from rules, exceptions and slot-consuming bookings. */
  async availability(serviceId: string, days = 14) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        availabilityRules: { where: { active: true } },
        availabilityExceptions: true,
      },
    });
    if (!service) {
      throw Errors.notFound('This service is no longer available.');
    }
    const now = new Date();
    const horizonEnd = new Date(now.getTime() + days * 24 * 60 * 60_000);
    const booked = await this.prisma.booking.findMany({
      where: {
        serviceId,
        status: { in: SLOT_CONSUMING_STATUSES },
        confirmedStart: { lt: horizonEnd },
        confirmedEnd: { gt: now },
      },
      select: { confirmedStart: true, confirmedEnd: true, quantity: true },
    });
    const taken = booked.map((row) => ({
      start: row.confirmedStart as Date,
      end: row.confirmedEnd as Date,
      quantity: row.quantity,
    }));

    const duration = service.durationMinutes ?? 60;
    const result: Array<{ date: string; dayLabel: string; slots: Array<Record<string, unknown>> }> = [];

    for (let offset = 0; offset < days; offset += 1) {
      const dayStart = new Date(now.getTime() + offset * 24 * 60 * 60_000);
      const dateKey = localDateKey(dayStart);
      const exception = service.availabilityExceptions.find(
        (item) => localDateKey(item.date) === dateKey,
      );
      if (exception?.closed) {
        result.push({
          date: dateKey,
          dayLabel: DAY_LABELS[localDayIndex(dateKey)],
          slots: [],
        });
        continue;
      }
      const windows =
        exception && exception.startMinute != null && exception.endMinute != null
          ? [
              {
                startMinute: exception.startMinute,
                endMinute: exception.endMinute,
                slotMinutes: duration,
                capacity: null as number | null,
              },
            ]
          : service.availabilityRules
              .filter((rule) => rule.dayOfWeek === localDayIndex(dateKey))
              .map((rule) => ({
                startMinute: rule.startMinute,
                endMinute: rule.endMinute,
                slotMinutes: rule.slotMinutes ?? duration,
                capacity: rule.capacity,
              }));

      const slots: Array<Record<string, unknown>> = [];
      for (const window of windows) {
        const step = window.slotMinutes || duration;
        for (let minute = window.startMinute; minute + duration <= window.endMinute; minute += step) {
          const start = utcFromLocal(dateKey, minute);
          const end = new Date(start.getTime() + duration * 60_000);
          if (start.getTime() <= now.getTime() + service.leadTimeMinutes * 60_000) {
            continue;
          }
          const capacity = evaluateCapacity({ start, end }, 1, taken, {
            capacityType: service.capacityType,
            capacityValue: service.capacityValue,
            ruleCapacity: window.capacity,
          });
          slots.push({
            start: start.toISOString(),
            end: end.toISOString(),
            label: minuteLabel(minute),
            available: capacity.available,
            remaining: capacity.limit === null ? null : Math.max(capacity.limit - capacity.consumed, 0),
          });
        }
      }
      result.push({ date: dateKey, dayLabel: DAY_LABELS[localDayIndex(dateKey)], slots });
    }

    return { serviceId, durationMinutes: duration, days: result };
  }

  async getProvider(personId: string, providerId: string) {
    const provider = await this.prisma.serviceProviderProfile.findUnique({
      where: { id: providerId },
      include: {
        person: { select: { id: true, displayName: true, username: true, photoFileId: true } },
        locations: true,
      },
    });
    if (!provider) {
      throw Errors.notFound('This provider is no longer available.');
    }
    const owner = provider.personId === personId;
    if (!owner && !['ACTIVE', 'PAUSED'].includes(provider.status)) {
      throw Errors.notFound('This provider is no longer available.');
    }
    const [services, reviews] = await Promise.all([
      this.prisma.service.findMany({
        where: {
          providerId,
          status: owner ? undefined : { in: DISCOVERABLE_SERVICE_STATUSES },
        },
        include: serviceInclude,
        orderBy: { title: 'asc' },
      }),
      this.prisma.serviceReview.findMany({
        where: { providerId, status: 'PUBLISHED' },
        include: { author: { select: { displayName: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      id: provider.id,
      // A provider is the same Person with a provider role, not a second account.
      personId: provider.personId,
      personRoute: `/app/profile/${provider.personId}`,
      providerName: provider.providerName,
      tagline: provider.tagline,
      about: provider.about,
      status: provider.status,
      verified: provider.verified,
      verifiedLabel: provider.verified ? 'Verified provider' : 'Not yet verified',
      ratingAverage: provider.ratingAverage,
      ratingCount: provider.ratingCount,
      completedBookings: provider.completedBookings,
      respondsWithinHours: provider.respondsWithinHours,
      contactPreference: provider.contactPreference,
      owner,
      locations: provider.locations.map((location) => ({
        id: location.id,
        label: location.label,
        building: location.building,
        room: location.room,
        address: location.address,
        instructions: location.instructions,
        accessibilityInformation: location.accessibilityInformation,
      })),
      services: services.map((service) => this.summarize(service)),
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        body: review.body,
        authorName: review.author.displayName ?? review.author.username,
        providerResponse: review.providerResponse,
        createdAt: review.createdAt.toISOString(),
      })),
      route: `/app/explore/provider/${provider.id}`,
    };
  }

  async serviceReviews(serviceId: string, cursor?: string) {
    const rows = await this.prisma.serviceReview.findMany({
      where: { serviceId, status: 'PUBLISHED' },
      include: { author: { select: { displayName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return {
      items: rows.map((review) => ({
        id: review.id,
        rating: review.rating,
        body: review.body,
        authorName: review.author.displayName ?? review.author.username,
        providerResponse: review.providerResponse,
        createdAt: review.createdAt.toISOString(),
      })),
      nextCursor: rows.length === 20 ? rows[rows.length - 1].id : null,
    };
  }

  summarize(service: Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>) {
    return {
      id: service.id,
      title: service.title,
      summary: service.summary,
      status: service.status,
      statusLabel: SERVICE_STATUS_LABELS[service.status] ?? service.status,
      serviceMode: service.serviceMode,
      serviceModeLabel: MODE_LABELS[service.serviceMode] ?? service.serviceMode,
      pricingModel: service.pricingModel,
      priceLabel: formatPrice(service),
      priceAmount: service.priceAmount == null ? null : Number(service.priceAmount),
      priceCurrency: service.priceCurrency,
      priceUnit: service.priceUnit,
      categoryKey: service.category.key,
      categoryLabel: service.category.label,
      bookingPolicy: service.bookingPolicy,
      ratingAverage: service.ratingAverage,
      ratingCount: service.ratingCount,
      bookable: isServiceBookable(service.status) && service.provider.status === 'ACTIVE',
      provider: {
        id: service.providerId,
        providerName: service.provider.providerName,
        verified: service.provider.verified,
        route: `/app/explore/provider/${service.providerId}`,
      },
      locationLabel: service.location?.label ?? null,
      accessibilityLabel: `${service.title}. ${service.category.label}. ${formatPrice(service)}. ${
        SERVICE_STATUS_LABELS[service.status] ?? service.status
      }.`,
      route: `/app/explore/service/${service.id}`,
    };
  }

  private serializeField(field: {
    id: string;
    key: string;
    label: string;
    helpText: string | null;
    fieldType: string;
    required: boolean;
    options: Prisma.JsonValue | null;
    minValue: number | null;
    maxValue: number | null;
    maxLength: number | null;
    sortOrder: number;
  }) {
    return {
      id: field.id,
      key: field.key,
      label: field.label,
      helpText: field.helpText,
      fieldType: field.fieldType,
      required: field.required,
      options: selectOptions(field.options),
      minValue: field.minValue,
      maxValue: field.maxValue,
      maxLength: field.maxLength,
      sortOrder: field.sortOrder,
    };
  }
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MODE_LABELS: Record<string, string> = {
  ON_SITE: 'On site',
  REMOTE: 'Remote',
  DELIVERY: 'Delivery',
  PICKUP: 'Pickup',
  ON_DEMAND: 'On demand',
  APPOINTMENT: 'By appointment',
};

const SERVICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  AVAILABLE: 'Available now',
  UNAVAILABLE: 'Unavailable',
  DISCONTINUED: 'Discontinued',
};

function policyMessage(policy: string): string {
  switch (policy) {
    case 'OPEN_BOOKING':
      return 'Your booking is confirmed straight away if the slot is still free.';
    case 'REQUIRES_QUOTE':
      return 'The provider will send a quote before confirming.';
    case 'CONTACT_FIRST':
      return 'Message the provider to arrange this service.';
    default:
      return 'The provider reviews each request before confirming.';
  }
}

function minuteLabel(minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0');
  const minutes = String(minute % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function localDayIndex(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

function utcFromLocal(dateKey: string, minuteOfDay: number): Date {
  const midnight = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  return new Date(midnight + (minuteOfDay - CAMPUS_TIMEZONE_OFFSET_MINUTES) * 60_000);
}

function parseCategory(value?: string): ServiceCategoryKey | null {
  if (!value || value === 'ALL') {
    return null;
  }
  const upper = value.toUpperCase();
  return Object.values(ServiceCategoryKey).includes(upper as ServiceCategoryKey)
    ? (upper as ServiceCategoryKey)
    : null;
}

function parseMode(value?: string): ServiceMode | null {
  if (!value) {
    return null;
  }
  const upper = value.toUpperCase();
  return Object.values(ServiceMode).includes(upper as ServiceMode) ? (upper as ServiceMode) : null;
}
