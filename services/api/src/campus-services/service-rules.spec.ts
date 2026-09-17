import {
  allowedServiceTransitions,
  bookingPolicyAllowsBooking,
  bookingPolicyAutoConfirms,
  canTransitionService,
  defaultBookingTypeFor,
  formatPrice,
  isServiceBookable,
  isServiceDiscoverable,
  selectOptions,
  validateBookingFields,
} from './service-rules';

describe('service lifecycle', () => {
  it('follows DRAFT -> PUBLISHED -> AVAILABLE <-> UNAVAILABLE -> DISCONTINUED', () => {
    expect(canTransitionService('DRAFT', 'PUBLISHED')).toBe(true);
    expect(canTransitionService('PUBLISHED', 'AVAILABLE')).toBe(true);
    expect(canTransitionService('AVAILABLE', 'UNAVAILABLE')).toBe(true);
    expect(canTransitionService('UNAVAILABLE', 'AVAILABLE')).toBe(true);
    expect(canTransitionService('AVAILABLE', 'DISCONTINUED')).toBe(true);
  });

  it('refuses to unpublish or revive a service', () => {
    expect(canTransitionService('AVAILABLE', 'DRAFT')).toBe(false);
    expect(canTransitionService('AVAILABLE', 'PUBLISHED')).toBe(false);
    expect(canTransitionService('DISCONTINUED', 'AVAILABLE')).toBe(false);
    expect(allowedServiceTransitions('DISCONTINUED')).toHaveLength(0);
  });

  it('keeps a draft out of discovery but shows paused services', () => {
    expect(isServiceDiscoverable('DRAFT')).toBe(false);
    expect(isServiceDiscoverable('UNAVAILABLE')).toBe(true);
    expect(isServiceDiscoverable('DISCONTINUED')).toBe(false);
  });

  it('only takes bookings while published or available', () => {
    expect(isServiceBookable('PUBLISHED')).toBe(true);
    expect(isServiceBookable('AVAILABLE')).toBe(true);
    expect(isServiceBookable('UNAVAILABLE')).toBe(false);
    expect(isServiceBookable('DRAFT')).toBe(false);
  });
});

describe('booking policy', () => {
  it('auto-confirms only open booking', () => {
    expect(bookingPolicyAutoConfirms('OPEN_BOOKING')).toBe(true);
    expect(bookingPolicyAutoConfirms('REQUEST_APPROVAL')).toBe(false);
    expect(bookingPolicyAutoConfirms('REQUIRES_QUOTE')).toBe(false);
  });

  it('sends contact-first services to messaging instead of a booking form', () => {
    expect(bookingPolicyAllowsBooking('CONTACT_FIRST')).toBe(false);
    expect(bookingPolicyAllowsBooking('OPEN_BOOKING')).toBe(true);
  });

  it('turns a quote-required service into a QUOTE booking', () => {
    expect(defaultBookingTypeFor('REQUIRES_QUOTE', 'APPOINTMENT')).toBe('QUOTE');
    expect(defaultBookingTypeFor('OPEN_BOOKING', 'ORDER')).toBe('ORDER');
  });
});

describe('formatPrice', () => {
  it('describes each pricing model without inventing a payment', () => {
    expect(formatPrice({ pricingModel: 'FREE' })).toBe('Free');
    expect(formatPrice({ pricingModel: 'QUOTE_REQUIRED' })).toBe('Quote on request');
    expect(formatPrice({ pricingModel: 'CUSTOM' })).toBe('Custom pricing');
    expect(formatPrice({ pricingModel: 'FIXED', priceAmount: 2, priceCurrency: 'USD' })).toBe(
      'USD 2.00',
    );
    expect(formatPrice({ pricingModel: 'FROM', priceAmount: 5, priceCurrency: 'USD' })).toBe(
      'From USD 5.00',
    );
    expect(
      formatPrice({
        pricingModel: 'HOURLY',
        priceAmount: 8,
        priceCurrency: 'USD',
      }),
    ).toBe('USD 8.00 per hour');
  });

  it('falls back to a quote when the amount is missing', () => {
    expect(formatPrice({ pricingModel: 'FIXED' })).toBe('Quote on request');
  });
});

describe('selectOptions', () => {
  it('accepts plain strings and value objects', () => {
    expect(selectOptions(['A4', 'A3'])).toEqual(['A4', 'A3']);
    expect(selectOptions([{ value: 'Colour' }])).toEqual(['Colour']);
    expect(selectOptions(null)).toEqual([]);
  });
});

describe('validateBookingFields', () => {
  const definitions = [
    { id: 'f1', key: 'pages', label: 'Pages', fieldType: 'NUMBER' as const, required: true, minValue: 1, maxValue: 500 },
    { id: 'f2', key: 'size', label: 'Paper size', fieldType: 'SELECT' as const, required: true, options: ['A4', 'A3'] },
    { id: 'f3', key: 'colour', label: 'Colour printing', fieldType: 'BOOLEAN' as const, required: false },
    { id: 'f4', key: 'notes', label: 'Notes', fieldType: 'TEXT' as const, required: false, maxLength: 10 },
    { id: 'f5', key: 'extras', label: 'Extras', fieldType: 'MULTI_SELECT' as const, required: false, options: ['Binding', 'Lamination'] },
  ];

  it('normalizes a valid submission', () => {
    const result = validateBookingFields(definitions, {
      pages: '12',
      size: 'A4',
      colour: true,
      extras: ['Binding'],
    });
    expect(result.errors).toHaveLength(0);
    expect(result.values).toEqual([
      { fieldId: 'f1', key: 'pages', label: 'Pages', valueNumber: 12 },
      { fieldId: 'f2', key: 'size', label: 'Paper size', valueText: 'A4' },
      { fieldId: 'f3', key: 'colour', label: 'Colour printing', valueBoolean: true },
      { fieldId: 'f5', key: 'extras', label: 'Extras', valueJson: ['Binding'] },
    ]);
  });

  it('reports missing required fields', () => {
    const result = validateBookingFields(definitions, { pages: 4 });
    expect(result.errors).toEqual([{ key: 'size', message: 'Paper size is required.' }]);
  });

  it('enforces numeric bounds', () => {
    expect(validateBookingFields(definitions, { pages: 0, size: 'A4' }).errors).toEqual([
      { key: 'pages', message: 'Pages must be at least 1.' },
    ]);
    expect(validateBookingFields(definitions, { pages: 900, size: 'A4' }).errors).toEqual([
      { key: 'pages', message: 'Pages must be 500 or less.' },
    ]);
    expect(validateBookingFields(definitions, { pages: 'many', size: 'A4' }).errors).toEqual([
      { key: 'pages', message: 'Pages must be a number.' },
    ]);
  });

  it('rejects options that are not offered', () => {
    expect(validateBookingFields(definitions, { pages: 1, size: 'A2' }).errors).toEqual([
      { key: 'size', message: 'Choose an option for Paper size.' },
    ]);
    expect(
      validateBookingFields(definitions, { pages: 1, size: 'A4', extras: ['Gold leaf'] }).errors,
    ).toEqual([{ key: 'extras', message: 'Choose options for Extras.' }]);
  });

  it('enforces text length', () => {
    expect(
      validateBookingFields(definitions, { pages: 1, size: 'A4', notes: 'x'.repeat(40) }).errors,
    ).toEqual([{ key: 'notes', message: 'Notes must be 10 characters or fewer.' }]);
  });

  it('ignores deactivated fields and unknown keys', () => {
    const withInactive = [
      ...definitions,
      { id: 'f6', key: 'legacy', label: 'Legacy', fieldType: 'TEXT' as const, required: true, active: false },
    ];
    const result = validateBookingFields(withInactive, { pages: 1, size: 'A4', nonsense: 'x' });
    expect(result.errors).toHaveLength(0);
    expect(result.values.map((value) => value.key)).toEqual(['pages', 'size']);
  });
});
