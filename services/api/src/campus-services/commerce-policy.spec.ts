import { formatPrice } from './service-rules';
import {
  PAYMENTS_REQUIRED_FOR_MVP,
  bookingAttachmentAccessible,
  bookingCreatesActivity,
  bookingIsEvent,
  bookingNotificationAlias,
  cachedAvailabilityIsGuarantee,
  canAcceptNewBookings,
  canPublishService,
  claimExclusiveSlot,
  commerceActionRequiresOnline,
  exposedProviderContact,
  fulfilmentFromServiceMode,
  isKnownServiceCategory,
  paymentBlocksBookingTransition,
  providerBadge,
  providerCapabilities,
  providerIsOrganization,
  reviewPermitted,
  serviceLocationNeedsCanonicalLocation,
  universityEndorsed,
  verificationFromAuth,
} from './commerce-policy';

describe('service commerce policy', () => {
  it('keeps categories configurable rather than scattered through the app', () => {
    expect(isKnownServiceCategory('PRINTING')).toBe(true);
    expect(isKnownServiceCategory('EVENT_SERVICES')).toBe(true);
    expect(isKnownServiceCategory('SPACESHIP', ['PRINTING'])).toBe(false);
    expect(isKnownServiceCategory('PRINTING', ['PRINTING', 'FOOD'])).toBe(true);
  });

  it('never treats authentication as provider verification or university endorsement', () => {
    expect(verificationFromAuth(true)).toBe('NOT_VERIFIED');
    expect(universityEndorsed('VERIFIED')).toBe(false);
    expect(universityEndorsed('NOT_VERIFIED')).toBe(false);
    expect(providerBadge('VERIFIED')).toEqual({ label: 'Verified Provider', universityEndorsed: false });
    expect(providerBadge('NOT_VERIFIED').label).toBe('Not university endorsed');
  });

  it('suspends new publication and bookings while keeping history and messaging', () => {
    const caps = providerCapabilities({ status: 'SUSPENDED', verification: 'VERIFIED' });
    expect(caps).toEqual(['VIEW_HISTORICAL_BOOKINGS', 'MESSAGE_CUSTOMERS']);
    expect(canPublishService('SUSPENDED', 'VERIFIED')).toBe(false);
    expect(canAcceptNewBookings('ACTIVE', 'VERIFIED')).toBe(true);
    expect(canPublishService('ACTIVE', 'NOT_VERIFIED')).toBe(false);
  });

  it('maps existing service modes onto fulfilment types without a second engine', () => {
    expect(fulfilmentFromServiceMode('ON_SITE')).toBe('AT_PROVIDER');
    expect(fulfilmentFromServiceMode('REMOTE')).toBe('ONLINE');
    expect(fulfilmentFromServiceMode('PICKUP')).toBe('PICKUP');
    expect(fulfilmentFromServiceMode('DELIVERY')).toBe('DELIVERY');
  });

  it('formats hourly and quote pricing without creating a payment', () => {
    expect(formatPrice({ pricingModel: 'HOURLY', priceAmount: 8, priceCurrency: 'USD' })).toBe('USD 8.00 per hour');
    expect(formatPrice({ pricingModel: 'QUOTE' })).toBe('Quote on request');
    expect(PAYMENTS_REQUIRED_FOR_MVP).toBe(false);
    expect(paymentBlocksBookingTransition()).toBe(false);
  });

  it('hides personal contact unless the provider opts in', () => {
    expect(
      exposedProviderContact({
        contactPolicy: 'CAMPUSOS_MESSAGES',
        phone: '+263771111111',
        email: 'print@campus.example',
        address: 'Room 12',
      }),
    ).toEqual({ messageProvider: true, phone: null, email: null, address: null });
    expect(
      exposedProviderContact({
        contactPolicy: 'PHONE',
        phone: '+263771111111',
      }).phone,
    ).toBe('+263771111111');
  });

  it('requires connectivity for authoritative booking actions and never guarantees cached slots', () => {
    expect(commerceActionRequiresOnline('VIEW_CACHED_SERVICE')).toBe(false);
    expect(commerceActionRequiresOnline('DRAFT_BOOKING')).toBe(false);
    expect(commerceActionRequiresOnline('SUBMIT_BOOKING')).toBe(true);
    expect(commerceActionRequiresOnline('CONFIRM_BOOKING')).toBe(true);
    expect(cachedAvailabilityIsGuarantee()).toBe(false);
  });

  it('creates a calendar Activity from a scheduled Booking without turning the booking into an Event', () => {
    expect(bookingCreatesActivity({ hasScheduledWindow: true })).toBe(true);
    expect(bookingCreatesActivity({ hasScheduledWindow: false })).toBe(false);
    expect(bookingIsEvent()).toBe(false);
    expect(providerIsOrganization()).toBe(false);
    expect(serviceLocationNeedsCanonicalLocation()).toBe(true);
  });

  it('rejects a second exclusive confirm when the slot version has already moved', () => {
    const first = claimExclusiveSlot({
      capacity: 1,
      committed: 0,
      quantity: 1,
      observedVersion: 4,
      currentVersion: 4,
    });
    expect(first.claimed).toBe(true);
    const second = claimExclusiveSlot({
      capacity: 1,
      committed: 1,
      quantity: 1,
      observedVersion: 4,
      currentVersion: first.nextVersion!,
    });
    expect(second.claimed).toBe(false);
    expect(second.reason).toBe('This booking is no longer available.');
  });

  it('scopes booking files to that booking and the two parties', () => {
    expect(
      bookingAttachmentAccessible({
        fileId: 'file_1',
        attachedToBookingId: 'book_1',
        requestedBookingId: 'book_1',
        viewerIsParty: true,
      }),
    ).toBe(true);
    expect(
      bookingAttachmentAccessible({
        fileId: 'file_1',
        attachedToBookingId: 'book_1',
        requestedBookingId: 'book_2',
        viewerIsParty: true,
      }),
    ).toBe(false);
    expect(
      bookingAttachmentAccessible({
        fileId: 'file_1',
        attachedToBookingId: 'book_1',
        requestedBookingId: 'book_1',
        viewerIsParty: false,
      }),
    ).toBe(false);
  });

  it('only allows a completed customer to review, so reviews are not an MVP counter', () => {
    expect(reviewPermitted({ bookingStatus: 'COMPLETED', authorId: 'c1', customerId: 'c1' })).toBe(true);
    expect(reviewPermitted({ bookingStatus: 'CONFIRMED', authorId: 'c1', customerId: 'c1' })).toBe(false);
    expect(reviewPermitted({ bookingStatus: 'COMPLETED', authorId: 'stranger', customerId: 'c1' })).toBe(false);
  });

  it('emits service notification aliases through the existing engine', () => {
    expect(bookingNotificationAlias('REQUESTED')).toBe('SERVICE_REQUESTED');
    expect(bookingNotificationAlias('CONFIRMED')).toBe('SERVICE_CONFIRMED');
    expect(bookingNotificationAlias('DRAFT')).toBeNull();
  });
});
