export const DEFAULT_SERVICE_CATEGORIES = [
  'ACADEMIC_SUPPORT',
  'PRINTING',
  'FOOD',
  'LAUNDRY',
  'BEAUTY',
  'REPAIRS',
  'TECHNOLOGY',
  'TRANSPORT',
  'DESIGN',
  'PHOTOGRAPHY',
  'EVENT_SERVICES',
  'RETAIL',
  'WELLNESS',
  'TUTORING',
  'OTHER',
] as const;

export type ServiceCategoryKey = (typeof DEFAULT_SERVICE_CATEGORIES)[number] | string;

export function isKnownServiceCategory(
  key: string,
  configured: readonly string[] = DEFAULT_SERVICE_CATEGORIES,
): boolean {
  return configured.includes(key);
}

export const PROVIDER_TYPES = [
  'INDIVIDUAL',
  'STUDENT_BUSINESS',
  'CAMPUS_BUSINESS',
  'UNIVERSITY_UNIT',
  'EXTERNAL_BUSINESS',
  'ORGANIZATION',
  'OTHER',
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export type ProviderVerificationStatus =
  | 'NOT_VERIFIED'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED';

export function verificationFromAuth(_accountAuthenticated: boolean): ProviderVerificationStatus {
  return 'NOT_VERIFIED';
}

export function universityEndorsed(_verification: ProviderVerificationStatus): boolean {
  return false;
}

export function providerBadge(verification: ProviderVerificationStatus): {
  label: string;
  universityEndorsed: boolean;
} {
  if (verification === 'VERIFIED') {
    return { label: 'Verified Provider', universityEndorsed: false };
  }
  return { label: 'Not university endorsed', universityEndorsed: false };
}

export type ProviderOperatingStatus = 'DRAFT' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'CLOSED';

export type ProviderCapability =
  | 'PUBLISH_SERVICE'
  | 'ACCEPT_BOOKING'
  | 'CREATE_BOOKING'
  | 'MESSAGE_CUSTOMERS'
  | 'VIEW_HISTORICAL_BOOKINGS';

export function providerCapabilities(input: {
  status: ProviderOperatingStatus;
  verification: ProviderVerificationStatus;
}): ProviderCapability[] {
  const historical: ProviderCapability[] = ['VIEW_HISTORICAL_BOOKINGS', 'MESSAGE_CUSTOMERS'];
  if (input.status === 'SUSPENDED' || input.status === 'CLOSED') {
    return historical;
  }
  if (input.status === 'DRAFT' || input.status === 'PENDING_VERIFICATION' || input.verification === 'NOT_VERIFIED') {
    return [...historical, 'MESSAGE_CUSTOMERS'];
  }
  if (input.verification !== 'VERIFIED' && input.verification !== 'PENDING') {
    return historical;
  }
  if (input.status === 'PAUSED') {
    return [...historical, 'PUBLISH_SERVICE'];
  }
  return ['PUBLISH_SERVICE', 'ACCEPT_BOOKING', 'CREATE_BOOKING', 'MESSAGE_CUSTOMERS', 'VIEW_HISTORICAL_BOOKINGS'];
}

export function canPublishService(status: ProviderOperatingStatus, verification: ProviderVerificationStatus): boolean {
  return providerCapabilities({ status, verification }).includes('PUBLISH_SERVICE') && status === 'ACTIVE';
}

export function canAcceptNewBookings(status: ProviderOperatingStatus, verification: ProviderVerificationStatus): boolean {
  return providerCapabilities({ status, verification }).includes('ACCEPT_BOOKING') && status === 'ACTIVE';
}

export const FULFILMENT_TYPES = [
  'AT_PROVIDER',
  'AT_CUSTOMER',
  'DELIVERY',
  'ONLINE',
  'PICKUP',
  'MOBILE',
  'MIXED',
] as const;

export type FulfilmentType = (typeof FULFILMENT_TYPES)[number];

const MODE_TO_FULFILMENT: Record<string, FulfilmentType> = {
  ON_SITE: 'AT_PROVIDER',
  REMOTE: 'ONLINE',
  DELIVERY: 'DELIVERY',
  PICKUP: 'PICKUP',
  ON_DEMAND: 'MOBILE',
  APPOINTMENT: 'AT_PROVIDER',
};

export function fulfilmentFromServiceMode(mode: string): FulfilmentType {
  return MODE_TO_FULFILMENT[mode] ?? 'MIXED';
}

export type ContactPolicy = 'CAMPUSOS_MESSAGES' | 'PHONE' | 'EMAIL' | 'PUBLIC';

export type ExposedContact = {
  messageProvider: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export function exposedProviderContact(input: {
  contactPolicy: ContactPolicy;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}): ExposedContact {
  const none = { messageProvider: true, phone: null, email: null, address: null };
  if (input.contactPolicy === 'CAMPUSOS_MESSAGES') {
    return none;
  }
  return {
    messageProvider: true,
    phone: input.contactPolicy === 'PHONE' || input.contactPolicy === 'PUBLIC' ? input.phone ?? null : null,
    email: input.contactPolicy === 'EMAIL' || input.contactPolicy === 'PUBLIC' ? input.email ?? null : null,
    address: input.contactPolicy === 'PUBLIC' ? input.address ?? null : null,
  };
}

export const PAYMENTS_REQUIRED_FOR_MVP = false;

export type PaymentState = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export function paymentBlocksBookingTransition(): boolean {
  return false;
}

export type CancellationReason =
  | 'CUSTOMER_REQUEST'
  | 'PROVIDER_REQUEST'
  | 'PROVIDER_UNAVAILABLE'
  | 'CUSTOMER_UNAVAILABLE'
  | 'LOCATION_UNAVAILABLE'
  | 'OTHER';

export type CommerceAction =
  | 'VIEW_CACHED_SERVICE'
  | 'VIEW_CACHED_BOOKING'
  | 'DRAFT_BOOKING'
  | 'SUBMIT_BOOKING'
  | 'CONFIRM_BOOKING'
  | 'DECLINE_BOOKING'
  | 'RESCHEDULE_BOOKING'
  | 'CANCEL_BOOKING'
  | 'COMPLETE_BOOKING'
  | 'VERIFY_PROVIDER'
  | 'CONFIRM_AVAILABILITY';

const ONLINE_ACTIONS: CommerceAction[] = [
  'SUBMIT_BOOKING',
  'CONFIRM_BOOKING',
  'DECLINE_BOOKING',
  'RESCHEDULE_BOOKING',
  'CANCEL_BOOKING',
  'COMPLETE_BOOKING',
  'VERIFY_PROVIDER',
  'CONFIRM_AVAILABILITY',
];

export function commerceActionRequiresOnline(action: CommerceAction): boolean {
  return ONLINE_ACTIONS.includes(action);
}

export function cachedAvailabilityIsGuarantee(): boolean {
  return false;
}

export function bookingCreatesActivity(input: { hasScheduledWindow: boolean }): boolean {
  return input.hasScheduledWindow;
}

export function bookingIsEvent(): boolean {
  return false;
}

export function providerIsOrganization(): boolean {
  return false;
}

export function serviceLocationNeedsCanonicalLocation(): boolean {
  return true;
}

export type SlotClaimInput = {
  capacity: number | null;
  committed: number;
  quantity: number;
  observedVersion: number;
  currentVersion: number;
};

export type SlotClaimResult = { claimed: boolean; reason?: string; nextVersion?: number };

/** Server-side exclusive claim. A stale version means another confirm won the race. */
export function claimExclusiveSlot(input: SlotClaimInput): SlotClaimResult {
  if (input.observedVersion !== input.currentVersion) {
    return { claimed: false, reason: 'This booking is no longer available.' };
  }
  if (input.capacity !== null && input.committed + input.quantity > input.capacity) {
    return { claimed: false, reason: 'This booking is no longer available.' };
  }
  return { claimed: true, nextVersion: input.currentVersion + 1 };
}

export function bookingAttachmentAccessible(input: {
  fileId: string;
  attachedToBookingId: string;
  requestedBookingId: string;
  viewerIsParty: boolean;
}): boolean {
  return input.attachedToBookingId === input.requestedBookingId && input.viewerIsParty;
}

export function reviewPermitted(input: {
  bookingStatus: string;
  authorId: string;
  customerId: string;
}): boolean {
  return input.bookingStatus === 'COMPLETED' && input.authorId === input.customerId;
}

export const SERVICE_ANALYTICS_EVENTS = [
  'services_opened',
  'service_search_started',
  'service_searched',
  'service_opened',
  'service_shared',
  'booking_started',
  'booking_requested',
  'booking_confirmed',
  'booking_declined',
  'booking_rescheduled',
  'booking_cancelled',
  'booking_completed',
  'provider_profile_opened',
  'provider_service_created',
  'provider_service_published',
  'provider_verification_started',
  'provider_verification_completed',
];

export const SERVICE_ANALYTICS_FORBIDDEN = ['paymentDetails', 'cardNumber', 'messageBody', 'conversationBody'];

export function bookingNotificationAlias(status: string): string | null {
  switch (status) {
    case 'REQUESTED':
      return 'SERVICE_REQUESTED';
    case 'CONFIRMED':
      return 'SERVICE_CONFIRMED';
    case 'DECLINED':
      return 'SERVICE_DECLINED';
    case 'RESCHEDULED':
      return 'SERVICE_RESCHEDULED';
    case 'CANCELLED':
      return 'SERVICE_CANCELLED';
    case 'COMPLETED':
      return 'SERVICE_COMPLETED';
    default:
      return null;
  }
}

export const CONVERSATION_CONTEXT_SERVICE = 'SERVICE';
