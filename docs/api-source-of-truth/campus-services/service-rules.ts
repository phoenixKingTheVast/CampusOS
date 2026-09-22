import {
  BookingType,
  ServiceBookingFieldType,
  ServiceBookingPolicy,
  ServiceStatus,
} from '@prisma/client';

const SERVICE_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  DRAFT: ['PUBLISHED', 'DISCONTINUED'],
  PUBLISHED: ['AVAILABLE', 'UNAVAILABLE', 'DISCONTINUED'],
  AVAILABLE: ['UNAVAILABLE', 'DISCONTINUED'],
  UNAVAILABLE: ['AVAILABLE', 'DISCONTINUED'],
  DISCONTINUED: [],
};

export function canTransitionService(from: ServiceStatus, to: ServiceStatus): boolean {
  return SERVICE_TRANSITIONS[from].includes(to);
}

export function allowedServiceTransitions(from: ServiceStatus): ServiceStatus[] {
  return SERVICE_TRANSITIONS[from];
}

/** Statuses a non-owner may discover a service in. */
export const DISCOVERABLE_SERVICE_STATUSES: ServiceStatus[] = [
  'PUBLISHED',
  'AVAILABLE',
  'UNAVAILABLE',
];

export function isServiceDiscoverable(status: ServiceStatus): boolean {
  return DISCOVERABLE_SERVICE_STATUSES.includes(status);
}

export function isServiceBookable(status: ServiceStatus): boolean {
  return status === 'PUBLISHED' || status === 'AVAILABLE';
}

export function bookingPolicyAutoConfirms(policy: ServiceBookingPolicy): boolean {
  return policy === 'OPEN_BOOKING';
}

export function bookingPolicyAllowsBooking(policy: ServiceBookingPolicy): boolean {
  return policy !== 'CONTACT_FIRST';
}

export function defaultBookingTypeFor(policy: ServiceBookingPolicy, fallback: BookingType): BookingType {
  return policy === 'REQUIRES_QUOTE' ? 'QUOTE' : fallback;
}

export type BookingFieldDefinition = {
  id: string;
  key: string;
  label: string;
  fieldType: ServiceBookingFieldType;
  required: boolean;
  options?: unknown;
  minValue?: number | null;
  maxValue?: number | null;
  maxLength?: number | null;
  active?: boolean;
};

export type NormalizedFieldValue = {
  fieldId: string;
  key: string;
  label: string;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: Date;
  valueJson?: string[];
  fileId?: string;
};

export type FieldValidationResult = {
  values: NormalizedFieldValue[];
  errors: Array<{ key: string; message: string }>;
};

/**
 * Validates a submitted booking form against the service's own field definitions
 * so that the client never needs per-service knowledge.
 */
export function validateBookingFields(
  definitions: BookingFieldDefinition[],
  submitted: Record<string, unknown>,
): FieldValidationResult {
  const values: NormalizedFieldValue[] = [];
  const errors: Array<{ key: string; message: string }> = [];

  for (const definition of definitions) {
    if (definition.active === false) {
      continue;
    }
    const raw = submitted[definition.key];
    const missing = raw === undefined || raw === null || raw === '';
    if (missing) {
      if (definition.required) {
        errors.push({ key: definition.key, message: `${definition.label} is required.` });
      }
      continue;
    }
    const normalized = normalizeValue(definition, raw, errors);
    if (normalized) {
      values.push(normalized);
    }
  }

  return { values, errors };
}

export function selectOptions(options: unknown): string[] {
  if (!Array.isArray(options)) {
    return [];
  }
  return options
    .map((option) => {
      if (typeof option === 'string') {
        return option;
      }
      if (option && typeof option === 'object' && 'value' in option) {
        return String((option as { value: unknown }).value);
      }
      return null;
    })
    .filter((option): option is string => option !== null);
}

export function formatPrice(input: {
  pricingModel: string;
  priceAmount?: unknown;
  priceCurrency?: string | null;
  priceUnit?: string | null;
}): string {
  const currency = input.priceCurrency ?? 'USD';
  const amount = input.priceAmount == null ? null : Number(input.priceAmount);
  switch (input.pricingModel) {
    case 'FREE':
      return 'Free';
    case 'QUOTE_REQUIRED':
    case 'QUOTE':
      return 'Quote on request';
    case 'CUSTOM':
      return 'Custom pricing';
    case 'FROM':
      return amount == null ? 'Quote on request' : `From ${currency} ${amount.toFixed(2)}`;
    case 'HOURLY':
      return amount == null
        ? 'Quote on request'
        : `${currency} ${amount.toFixed(2)} per ${input.priceUnit ?? 'hour'}`;
    case 'PER_UNIT':
      return amount == null
        ? 'Quote on request'
        : `${currency} ${amount.toFixed(2)} per ${input.priceUnit ?? 'unit'}`;
    default:
      return amount == null ? 'Quote on request' : `${currency} ${amount.toFixed(2)}`;
  }
}

function normalizeValue(
  definition: BookingFieldDefinition,
  raw: unknown,
  errors: Array<{ key: string; message: string }>,
): NormalizedFieldValue | null {
  const base = { fieldId: definition.id, key: definition.key, label: definition.label };
  switch (definition.fieldType) {
    case 'NUMBER': {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        errors.push({ key: definition.key, message: `${definition.label} must be a number.` });
        return null;
      }
      if (definition.minValue != null && value < definition.minValue) {
        errors.push({
          key: definition.key,
          message: `${definition.label} must be at least ${definition.minValue}.`,
        });
        return null;
      }
      if (definition.maxValue != null && value > definition.maxValue) {
        errors.push({
          key: definition.key,
          message: `${definition.label} must be ${definition.maxValue} or less.`,
        });
        return null;
      }
      return { ...base, valueNumber: value };
    }
    case 'BOOLEAN':
      return { ...base, valueBoolean: raw === true || raw === 'true' || raw === 1 };
    case 'SELECT': {
      const value = String(raw);
      const options = selectOptions(definition.options);
      if (options.length > 0 && !options.includes(value)) {
        errors.push({ key: definition.key, message: `Choose an option for ${definition.label}.` });
        return null;
      }
      return { ...base, valueText: value };
    }
    case 'MULTI_SELECT': {
      const list = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      const options = selectOptions(definition.options);
      const invalid = options.length > 0 && list.some((item) => !options.includes(item));
      if (invalid) {
        errors.push({ key: definition.key, message: `Choose options for ${definition.label}.` });
        return null;
      }
      return { ...base, valueJson: list };
    }
    case 'DATE':
    case 'TIME': {
      const value = raw instanceof Date ? raw : new Date(String(raw));
      if (Number.isNaN(value.getTime())) {
        if (definition.fieldType === 'TIME') {
          return { ...base, valueText: String(raw) };
        }
        errors.push({ key: definition.key, message: `${definition.label} is not a valid date.` });
        return null;
      }
      return { ...base, valueDate: value };
    }
    case 'FILE':
      return { ...base, fileId: String(raw), valueText: String(raw) };
    default: {
      const value = String(raw).trim();
      if (definition.maxLength != null && value.length > definition.maxLength) {
        errors.push({
          key: definition.key,
          message: `${definition.label} must be ${definition.maxLength} characters or fewer.`,
        });
        return null;
      }
      return { ...base, valueText: value };
    }
  }
}
