import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ServiceBookingFieldType,
  ServiceBookingPolicy,
  ServiceCapacityType,
  ServiceMode,
  ServicePricingModel,
  ServiceStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import { BookingsService } from './bookings.service';
import { CatalogService } from './catalog.service';
import { canTransitionService } from './service-rules';
import { localDateKey } from './booking-rules';

type ServiceInput = {
  categoryKey?: string;
  title?: string;
  summary?: string;
  description?: string;
  serviceMode?: ServiceMode;
  pricingModel?: ServicePricingModel;
  priceAmount?: number | null;
  priceCurrency?: string;
  priceUnit?: string | null;
  pricingNotes?: string | null;
  bookingPolicy?: ServiceBookingPolicy;
  capacityType?: ServiceCapacityType;
  capacityValue?: number | null;
  durationMinutes?: number | null;
  leadTimeMinutes?: number;
  cancellationWindowMinutes?: number;
  locationId?: string | null;
};

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Provider mode is contextual: the client may offer it freely, but every call
   * re-resolves the provider profile from the authenticated person and re-checks
   * ownership of the target service or booking.
   */
  async me(personId: string) {
    const provider = await this.prisma.serviceProviderProfile.findUnique({
      where: { personId },
      include: { locations: true, verifications: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!provider) {
      return { isProvider: false, provider: null };
    }
    return {
      isProvider: true,
      provider: {
        id: provider.id,
        providerName: provider.providerName,
        tagline: provider.tagline,
        about: provider.about,
        status: provider.status,
        verified: provider.verified,
        contactPreference: provider.contactPreference,
        respondsWithinHours: provider.respondsWithinHours,
        ratingAverage: provider.ratingAverage,
        ratingCount: provider.ratingCount,
        completedBookings: provider.completedBookings,
        locations: provider.locations.map((location) => ({
          id: location.id,
          label: location.label,
          building: location.building,
          room: location.room,
          address: location.address,
          instructions: location.instructions,
          accessibilityInformation: location.accessibilityInformation,
        })),
        verifications: provider.verifications.map((item) => ({
          id: item.id,
          status: item.status,
          submittedNotes: item.submittedNotes,
          rejectionReason: item.rejectionReason,
          reviewedAt: item.reviewedAt?.toISOString() ?? null,
          createdAt: item.createdAt.toISOString(),
        })),
        route: '/app/services/provider',
      },
    };
  }

  async createProfile(
    personId: string,
    input: { providerName: string; tagline?: string; about?: string; contactPreference?: string },
  ) {
    const existing = await this.prisma.serviceProviderProfile.findUnique({ where: { personId } });
    if (existing) {
      throw Errors.conflict('You already have a provider profile.');
    }
    const name = input.providerName.trim();
    if (name.length < 2) {
      throw Errors.validation('Enter a provider name.');
    }
    const provider = await this.prisma.serviceProviderProfile.create({
      data: {
        id: newId('svcp'),
        personId,
        providerName: name,
        tagline: input.tagline?.trim() || null,
        about: input.about?.trim() || null,
        contactPreference: input.contactPreference ?? 'CAMPUSOS_MESSAGES',
        status: 'ACTIVE',
      },
    });
    await this.bookings.audit(personId, 'PROVIDER_PROFILE_CREATED', { providerId: provider.id });
    return this.me(personId);
  }

  async updateProfile(
    personId: string,
    input: {
      providerName?: string;
      tagline?: string | null;
      about?: string | null;
      contactPreference?: string;
      respondsWithinHours?: number | null;
    },
  ) {
    const provider = await this.bookings.requireOwnProvider(personId);
    await this.prisma.serviceProviderProfile.update({
      where: { id: provider.id },
      data: {
        providerName: input.providerName?.trim() || undefined,
        tagline: input.tagline === undefined ? undefined : input.tagline?.trim() || null,
        about: input.about === undefined ? undefined : input.about?.trim() || null,
        contactPreference: input.contactPreference,
        respondsWithinHours: input.respondsWithinHours,
      },
    });
    await this.bookings.audit(personId, 'PROVIDER_PROFILE_UPDATED', { providerId: provider.id });
    return this.me(personId);
  }

  async submitVerification(personId: string, input: { evidenceFileId?: string; notes?: string }) {
    const provider = await this.bookings.requireOwnProvider(personId);
    const pending = await this.prisma.serviceProviderVerification.findFirst({
      where: { providerId: provider.id, status: 'PENDING' },
    });
    if (pending) {
      throw Errors.conflict('Your verification is already being reviewed.');
    }
    const verification = await this.prisma.serviceProviderVerification.create({
      data: {
        id: newId('svcv'),
        providerId: provider.id,
        evidenceFileId: input.evidenceFileId,
        submittedNotes: input.notes?.trim() || null,
        status: 'PENDING',
      },
    });
    await this.prisma.serviceProviderProfile.update({
      where: { id: provider.id },
      data: { status: provider.status === 'DRAFT' ? 'PENDING_VERIFICATION' : provider.status },
    });
    await this.bookings.audit(personId, 'PROVIDER_VERIFICATION_SUBMITTED', {
      providerId: provider.id,
      metadata: { verificationId: verification.id },
    });
    return { id: verification.id, status: verification.status };
  }

  async upsertLocation(
    personId: string,
    input: {
      id?: string;
      label: string;
      building?: string;
      room?: string;
      address?: string;
      instructions?: string;
      accessibilityInformation?: string;
    },
  ) {
    const provider = await this.bookings.requireOwnProvider(personId);
    if (input.id) {
      const existing = await this.prisma.serviceLocation.findUnique({ where: { id: input.id } });
      if (!existing || existing.providerId !== provider.id) {
        throw Errors.notFound();
      }
      return this.prisma.serviceLocation.update({
        where: { id: input.id },
        data: {
          label: input.label.trim(),
          building: input.building,
          room: input.room,
          address: input.address,
          instructions: input.instructions,
          accessibilityInformation: input.accessibilityInformation,
        },
      });
    }
    return this.prisma.serviceLocation.create({
      data: {
        id: newId('svcl'),
        providerId: provider.id,
        label: input.label.trim(),
        building: input.building,
        room: input.room,
        address: input.address,
        instructions: input.instructions,
        accessibilityInformation: input.accessibilityInformation,
      },
    });
  }

  async dashboard(personId: string) {
    const provider = await this.bookings.requireOwnProvider(personId);
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

    const [pendingRequests, todaysBookings, activeServices, conversationIds, provider2] =
      await Promise.all([
        this.prisma.booking.findMany({
          where: { providerId: provider.id, status: 'REQUESTED' },
          include: {
            service: { select: { title: true } },
            customer: { select: { id: true, displayName: true, username: true } },
          },
          orderBy: { requestedStart: 'asc' },
          take: 10,
        }),
        this.prisma.booking.findMany({
          where: {
            providerId: provider.id,
            status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
            confirmedStart: { gte: dayStart, lt: dayEnd },
          },
          include: {
            service: { select: { title: true } },
            customer: { select: { id: true, displayName: true, username: true } },
          },
          orderBy: { confirmedStart: 'asc' },
        }),
        this.prisma.service.count({
          where: { providerId: provider.id, status: { in: ['PUBLISHED', 'AVAILABLE'] } },
        }),
        this.prisma.booking.findMany({
          where: { providerId: provider.id, conversationId: { not: null } },
          select: { conversationId: true },
        }),
        this.prisma.serviceProviderProfile.findUniqueOrThrow({ where: { id: provider.id } }),
      ]);

    const ids = conversationIds
      .map((row) => row.conversationId)
      .filter((id): id is string => Boolean(id));
    let unreadMessages = 0;
    if (ids.length > 0) {
      const readStates = await this.prisma.messageReadState.findMany({
        where: { personId, conversationId: { in: ids } },
      });
      const lastReadByConversation = new Map(
        readStates.map((row) => [row.conversationId, row.lastReadAt]),
      );
      unreadMessages = await this.prisma.message.count({
        where: {
          conversationId: { in: ids },
          senderId: { not: personId },
          removedAt: null,
          OR: ids.map((conversationId) => {
            const lastReadAt = lastReadByConversation.get(conversationId);
            return lastReadAt
              ? { conversationId, createdAt: { gt: lastReadAt } }
              : { conversationId };
          }),
        },
      });
    }

    return {
      provider: {
        id: provider2.id,
        providerName: provider2.providerName,
        status: provider2.status,
        verified: provider2.verified,
        ratingAverage: provider2.ratingAverage,
        ratingCount: provider2.ratingCount,
        completedBookings: provider2.completedBookings,
        ratingLabel:
          provider2.ratingCount === 0
            ? 'No reviews yet'
            : `${provider2.ratingAverage?.toFixed(1)} out of 5 from ${provider2.ratingCount} reviews`,
      },
      summary: {
        pendingRequestCount: pendingRequests.length,
        todayBookingCount: todaysBookings.length,
        activeServiceCount: activeServices,
        unreadMessageCount: unreadMessages,
      },
      pendingRequests: pendingRequests.map((booking) => ({
        id: booking.id,
        serviceTitle: booking.service.title,
        customerName: booking.customer.displayName ?? booking.customer.username,
        requestedStart: booking.requestedStart?.toISOString() ?? null,
        quantity: booking.quantity,
        route: `/app/services/bookings/${booking.id}`,
      })),
      todaysBookings: todaysBookings.map((booking) => ({
        id: booking.id,
        serviceTitle: booking.service.title,
        customerName: booking.customer.displayName ?? booking.customer.username,
        status: booking.status,
        confirmedStart: booking.confirmedStart?.toISOString() ?? null,
        route: `/app/services/bookings/${booking.id}`,
      })),
    };
  }

  async myServices(personId: string) {
    const provider = await this.bookings.requireOwnProvider(personId);
    const services = await this.prisma.service.findMany({
      where: { providerId: provider.id },
      include: {
        category: true,
        provider: {
          include: { person: { select: { id: true, displayName: true, username: true } } },
        },
        location: true,
        bookingFields: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
        availabilityRules: { where: { active: true } },
        availabilityExceptions: true,
      },
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
    });
    return {
      items: services.map((service) => ({
        ...this.catalog.summarize(service),
        transitions: allowedTransitionsFor(service.status),
        manageRoute: `/app/services/provider/services/${service.id}`,
      })),
    };
  }

  async createService(personId: string, input: ServiceInput) {
    const provider = await this.bookings.requireOwnProvider(personId);
    if (!input.title?.trim()) {
      throw Errors.validation('Enter a service title.');
    }
    const category = await this.requireCategory(input.categoryKey);
    const service = await this.prisma.service.create({
      data: {
        id: newId('svc'),
        providerId: provider.id,
        categoryId: category.id,
        title: input.title.trim(),
        summary: input.summary?.trim() || null,
        description: input.description?.trim() || null,
        status: 'DRAFT',
        serviceMode: input.serviceMode ?? 'ON_SITE',
        pricingModel: input.pricingModel ?? 'FIXED',
        priceAmount: input.priceAmount ?? null,
        priceCurrency: input.priceCurrency ?? 'USD',
        priceUnit: input.priceUnit ?? null,
        pricingNotes: input.pricingNotes ?? null,
        bookingPolicy: input.bookingPolicy ?? 'REQUEST_APPROVAL',
        capacityType: input.capacityType ?? 'SINGLE',
        capacityValue: input.capacityValue ?? null,
        durationMinutes: input.durationMinutes ?? null,
        leadTimeMinutes: input.leadTimeMinutes ?? 0,
        cancellationWindowMinutes: input.cancellationWindowMinutes ?? 120,
        locationId: await this.resolveLocation(provider.id, input.locationId),
      },
    });
    await this.bookings.audit(personId, 'SERVICE_CREATED', {
      providerId: provider.id,
      serviceId: service.id,
    });
    return this.detail(personId, service.id);
  }

  async updateService(personId: string, serviceId: string, input: ServiceInput) {
    const { provider, service } = await this.requireOwnService(personId, serviceId);
    if (service.status === 'DISCONTINUED') {
      throw Errors.conflict('This service has been discontinued.');
    }
    const category = input.categoryKey ? await this.requireCategory(input.categoryKey) : null;
    await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        categoryId: category?.id,
        title: input.title?.trim() || undefined,
        summary: input.summary === undefined ? undefined : input.summary?.trim() || null,
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        serviceMode: input.serviceMode,
        pricingModel: input.pricingModel,
        priceAmount: input.priceAmount,
        priceCurrency: input.priceCurrency,
        priceUnit: input.priceUnit,
        pricingNotes: input.pricingNotes,
        bookingPolicy: input.bookingPolicy,
        capacityType: input.capacityType,
        capacityValue: input.capacityValue,
        durationMinutes: input.durationMinutes,
        leadTimeMinutes: input.leadTimeMinutes,
        cancellationWindowMinutes: input.cancellationWindowMinutes,
        locationId:
          input.locationId === undefined
            ? undefined
            : await this.resolveLocation(provider.id, input.locationId),
      },
    });
    await this.bookings.audit(personId, 'SERVICE_UPDATED', {
      providerId: provider.id,
      serviceId,
    });
    return this.detail(personId, serviceId);
  }

  async changeServiceStatus(
    personId: string,
    serviceId: string,
    next: ServiceStatus,
    reason?: string,
  ) {
    const { provider, service } = await this.requireOwnService(personId, serviceId);
    if (!canTransitionService(service.status, next)) {
      throw Errors.conflict(
        `A ${service.status.toLowerCase()} service cannot move to ${next.toLowerCase()}.`,
      );
    }
    if (next === 'PUBLISHED') {
      await this.assertPublishable(serviceId, service);
    }
    await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        status: next,
        publishedAt: next === 'PUBLISHED' ? (service.publishedAt ?? new Date()) : undefined,
        unavailableReason: next === 'UNAVAILABLE' ? (reason?.trim() || null) : null,
        discontinuedAt: next === 'DISCONTINUED' ? new Date() : undefined,
        version: { increment: 1 },
      },
    });
    await this.bookings.audit(personId, `SERVICE_${next}`, {
      providerId: provider.id,
      serviceId,
      metadata: { from: service.status, reason: reason ?? null },
    });
    return this.detail(personId, serviceId);
  }

  async replaceBookingFields(
    personId: string,
    serviceId: string,
    fields: Array<{
      key: string;
      label: string;
      helpText?: string;
      fieldType: ServiceBookingFieldType;
      required?: boolean;
      options?: string[];
      minValue?: number;
      maxValue?: number;
      maxLength?: number;
    }>,
  ) {
    const { provider } = await this.requireOwnService(personId, serviceId);
    const keys = new Set<string>();
    for (const field of fields) {
      const key = field.key.trim();
      if (!key) {
        throw Errors.validation('Every booking field needs a key.');
      }
      if (keys.has(key)) {
        throw Errors.validation(`Duplicate booking field "${key}".`);
      }
      keys.add(key);
    }

    await this.prisma.$transaction(async (tx) => {
      // Existing field rows are referenced by historical BookingFieldValue rows,
      // so they are deactivated rather than deleted.
      await tx.serviceBookingField.updateMany({
        where: { serviceId },
        data: { active: false },
      });
      for (const [index, field] of fields.entries()) {
        const data = {
          label: field.label.trim(),
          helpText: field.helpText?.trim() || null,
          fieldType: field.fieldType,
          required: field.required ?? false,
          options: (field.options ?? undefined) as Prisma.InputJsonValue | undefined,
          minValue: field.minValue ?? null,
          maxValue: field.maxValue ?? null,
          maxLength: field.maxLength ?? null,
          sortOrder: index,
          active: true,
        };
        await tx.serviceBookingField.upsert({
          where: { serviceId_key: { serviceId, key: field.key.trim() } },
          update: data,
          create: { id: newId('sbf'), serviceId, key: field.key.trim(), ...data },
        });
      }
    });

    await this.bookings.audit(personId, 'SERVICE_BOOKING_FIELDS_UPDATED', {
      providerId: provider.id,
      serviceId,
      metadata: { fieldCount: fields.length },
    });
    return this.detail(personId, serviceId);
  }

  async replaceAvailability(
    personId: string,
    serviceId: string,
    rules: Array<{
      dayOfWeek: number;
      startMinute: number;
      endMinute: number;
      slotMinutes?: number;
      capacity?: number;
    }>,
  ) {
    const { provider } = await this.requireOwnService(personId, serviceId);
    for (const rule of rules) {
      if (rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
        throw Errors.validation('Pick a day between Sunday and Saturday.');
      }
      if (rule.startMinute < 0 || rule.endMinute > 24 * 60 || rule.endMinute <= rule.startMinute) {
        throw Errors.validation('Each opening time must end after it starts.');
      }
    }
    const overlapping = rules.some((rule, index) =>
      rules.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.dayOfWeek === rule.dayOfWeek &&
          rule.startMinute < other.endMinute &&
          other.startMinute < rule.endMinute,
      ),
    );
    if (overlapping) {
      throw Errors.validation('Opening times for the same day cannot overlap.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceAvailabilityRule.deleteMany({ where: { serviceId } });
      if (rules.length > 0) {
        await tx.serviceAvailabilityRule.createMany({
          data: rules.map((rule) => ({
            id: newId('savr'),
            serviceId,
            dayOfWeek: rule.dayOfWeek,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
            slotMinutes: rule.slotMinutes ?? null,
            capacity: rule.capacity ?? null,
          })),
        });
      }
    });

    await this.bookings.audit(personId, 'SERVICE_AVAILABILITY_UPDATED', {
      providerId: provider.id,
      serviceId,
      metadata: { ruleCount: rules.length },
    });
    return this.detail(personId, serviceId);
  }

  async addException(
    personId: string,
    serviceId: string,
    input: { date: string; closed?: boolean; startMinute?: number; endMinute?: number; reason?: string },
  ) {
    const { provider } = await this.requireOwnService(personId, serviceId);
    const date = new Date(`${input.date.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw Errors.validation('Choose a valid date.');
    }
    const data = {
      closed: input.closed ?? true,
      startMinute: input.startMinute ?? null,
      endMinute: input.endMinute ?? null,
      reason: input.reason?.trim() || null,
    };
    await this.prisma.serviceAvailabilityException.upsert({
      where: { serviceId_date: { serviceId, date } },
      update: data,
      create: { id: newId('save'), serviceId, date, ...data },
    });
    await this.bookings.audit(personId, 'SERVICE_AVAILABILITY_EXCEPTION_ADDED', {
      providerId: provider.id,
      serviceId,
      metadata: { date: localDateKey(date) },
    });
    return this.detail(personId, serviceId);
  }

  async removeException(personId: string, serviceId: string, exceptionId: string) {
    const { provider } = await this.requireOwnService(personId, serviceId);
    const deleted = await this.prisma.serviceAvailabilityException.deleteMany({
      where: { id: exceptionId, serviceId },
    });
    if (deleted.count === 0) {
      throw Errors.notFound();
    }
    await this.bookings.audit(personId, 'SERVICE_AVAILABILITY_EXCEPTION_REMOVED', {
      providerId: provider.id,
      serviceId,
      metadata: { exceptionId },
    });
    return this.detail(personId, serviceId);
  }

  async reviews(personId: string, cursor?: string) {
    const provider = await this.bookings.requireOwnProvider(personId);
    const rows = await this.prisma.serviceReview.findMany({
      where: { providerId: provider.id, status: { not: 'REMOVED' } },
      include: {
        author: { select: { displayName: true, username: true } },
        service: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return {
      items: rows.map((review) => ({
        id: review.id,
        rating: review.rating,
        body: review.body,
        status: review.status,
        authorName: review.author.displayName ?? review.author.username,
        serviceId: review.service.id,
        serviceTitle: review.service.title,
        providerResponse: review.providerResponse,
        providerRespondedAt: review.providerRespondedAt?.toISOString() ?? null,
        createdAt: review.createdAt.toISOString(),
        accessibilityLabel: `${review.rating} out of 5 stars for ${review.service.title}.`,
      })),
      nextCursor: rows.length === 20 ? rows[rows.length - 1].id : null,
    };
  }

  private async detail(personId: string, serviceId: string) {
    return this.catalog.getService(personId, serviceId);
  }

  private async requireOwnService(personId: string, serviceId: string) {
    const provider = await this.bookings.requireOwnProvider(personId);
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || service.providerId !== provider.id) {
      throw Errors.notFound('This service is no longer available.');
    }
    return { provider, service };
  }

  private async requireCategory(key?: string) {
    if (!key) {
      throw Errors.validation('Choose a category.');
    }
    const category = await this.prisma.serviceCategory.findFirst({
      where: { key: key.toUpperCase() as never, active: true },
    });
    if (!category) {
      throw Errors.validation('Choose a category.');
    }
    return category;
  }

  private async resolveLocation(providerId: string, locationId?: string | null) {
    if (!locationId) {
      return null;
    }
    const location = await this.prisma.serviceLocation.findUnique({ where: { id: locationId } });
    if (!location || location.providerId !== providerId) {
      throw Errors.validation('Choose one of your own locations.');
    }
    return location.id;
  }

  private async assertPublishable(
    serviceId: string,
    service: { serviceMode: ServiceMode; bookingType: string; pricingModel: ServicePricingModel },
  ) {
    const requiresTime =
      service.serviceMode === 'APPOINTMENT' || service.bookingType === 'APPOINTMENT';
    if (requiresTime) {
      const rules = await this.prisma.serviceAvailabilityRule.count({
        where: { serviceId, active: true },
      });
      if (rules === 0) {
        throw Errors.validation('Add your weekly availability before publishing.');
      }
    }
  }
}

function allowedTransitionsFor(status: ServiceStatus): string[] {
  const actions: string[] = [];
  if (canTransitionService(status, 'PUBLISHED')) actions.push('PUBLISH');
  if (canTransitionService(status, 'UNAVAILABLE')) actions.push('PAUSE');
  if (canTransitionService(status, 'AVAILABLE')) actions.push('RESUME');
  if (canTransitionService(status, 'DISCONTINUED')) actions.push('DISCONTINUE');
  return actions;
}
