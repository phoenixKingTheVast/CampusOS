import 'package:campusos/shared/models/json_map.dart';

/// A service category. Categories come from the server so the client never
/// hard-codes the list.
class ServiceCategory {
  const ServiceCategory({
    required this.id,
    required this.key,
    required this.label,
    this.description,
    this.serviceCount = 0,
  });

  final String id;
  final String key;
  final String label;
  final String? description;
  final int serviceCount;

  String get countLabel => serviceCount == 1 ? '1 service' : '$serviceCount services';

  factory ServiceCategory.fromJson(Map<String, dynamic> json) {
    return ServiceCategory(
      id: asString(json['id']) ?? '',
      key: asString(json['key']) ?? '',
      label: asString(json['label']) ?? '',
      description: asString(json['description']),
      serviceCount: asInt(json['serviceCount']) ?? 0,
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'key': key,
      'label': label,
      'description': description,
      'service_count': serviceCount,
    };
  }

  factory ServiceCategory.fromRow(Map<String, Object?> row) {
    return ServiceCategory(
      id: asString(row['id']) ?? '',
      key: asString(row['key']) ?? '',
      label: asString(row['label']) ?? '',
      description: asString(row['description']),
      serviceCount: asInt(row['service_count']) ?? 0,
    );
  }
}

class ServiceProviderRef {
  const ServiceProviderRef({
    required this.id,
    required this.providerName,
    this.verified = false,
    this.ratingAverage,
    this.ratingCount = 0,
  });

  final String id;
  final String providerName;
  final bool verified;
  final double? ratingAverage;
  final int ratingCount;

  String get route => '/app/explore/provider/$id';

  factory ServiceProviderRef.fromJson(Map<String, dynamic> json) {
    return ServiceProviderRef(
      id: asString(json['id']) ?? '',
      providerName: asString(json['providerName']) ?? 'Provider',
      verified: asBool(json['verified']),
      ratingAverage: asDouble(json['ratingAverage']),
      ratingCount: asInt(json['ratingCount']) ?? 0,
    );
  }
}

/// A service as it appears in a list. Status and price are pre-formatted by the
/// server so the label is identical everywhere.
class ServiceSummary {
  const ServiceSummary({
    required this.id,
    required this.title,
    required this.status,
    required this.statusLabel,
    required this.priceLabel,
    required this.categoryKey,
    required this.categoryLabel,
    required this.provider,
    required this.bookable,
    this.summary,
    this.serviceMode = 'ON_SITE',
    this.serviceModeLabel = 'On site',
    this.pricingModel = 'CUSTOM',
    this.bookingPolicy = 'REQUEST_APPROVAL',
    this.ratingAverage,
    this.ratingCount = 0,
    this.locationLabel,
    this.accessibilityLabel,
  });

  final String id;
  final String title;
  final String status;
  final String statusLabel;
  final String priceLabel;
  final String categoryKey;
  final String categoryLabel;
  final ServiceProviderRef provider;
  final bool bookable;
  final String? summary;
  final String serviceMode;
  final String serviceModeLabel;
  final String pricingModel;
  final String bookingPolicy;
  final double? ratingAverage;
  final int ratingCount;
  final String? locationLabel;
  final String? accessibilityLabel;

  String get route => '/app/explore/service/$id';

  String get ratingLabel => ratingCount == 0
      ? 'No reviews yet'
      : '${ratingAverage?.toStringAsFixed(1) ?? '—'} out of 5 from $ratingCount '
          '${ratingCount == 1 ? 'review' : 'reviews'}';

  String get semanticLabel =>
      accessibilityLabel ?? '$title. $categoryLabel. $priceLabel. $statusLabel.';

  factory ServiceSummary.fromJson(Map<String, dynamic> json) {
    return ServiceSummary(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      status: asString(json['status']) ?? 'DRAFT',
      statusLabel: asString(json['statusLabel']) ?? '',
      priceLabel: asString(json['priceLabel']) ?? '',
      categoryKey: asString(json['categoryKey']) ?? 'OTHER',
      categoryLabel: asString(json['categoryLabel']) ?? 'Other',
      provider: ServiceProviderRef.fromJson(asJsonMap(json['provider'])),
      bookable: asBool(json['bookable']),
      summary: asString(json['summary']),
      serviceMode: asString(json['serviceMode']) ?? 'ON_SITE',
      serviceModeLabel: asString(json['serviceModeLabel']) ?? 'On site',
      pricingModel: asString(json['pricingModel']) ?? 'CUSTOM',
      bookingPolicy: asString(json['bookingPolicy']) ?? 'REQUEST_APPROVAL',
      ratingAverage: asDouble(json['ratingAverage']),
      ratingCount: asInt(json['ratingCount']) ?? 0,
      locationLabel: asString(json['locationLabel']),
      accessibilityLabel: asString(json['accessibilityLabel']),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'title': title,
      'summary': summary,
      'status': status,
      'status_label': statusLabel,
      'price_label': priceLabel,
      'category_key': categoryKey,
      'category_label': categoryLabel,
      'service_mode': serviceMode,
      'service_mode_label': serviceModeLabel,
      'booking_policy': bookingPolicy,
      'bookable': bookable ? 1 : 0,
      'rating_average': ratingAverage,
      'rating_count': ratingCount,
      'location_label': locationLabel,
      'provider_id': provider.id,
      'provider_name': provider.providerName,
      'provider_verified': provider.verified ? 1 : 0,
    };
  }

  factory ServiceSummary.fromRow(Map<String, Object?> row) {
    return ServiceSummary(
      id: asString(row['id']) ?? '',
      title: asString(row['title']) ?? '',
      status: asString(row['status']) ?? 'DRAFT',
      statusLabel: asString(row['status_label']) ?? '',
      priceLabel: asString(row['price_label']) ?? '',
      categoryKey: asString(row['category_key']) ?? 'OTHER',
      categoryLabel: asString(row['category_label']) ?? 'Other',
      provider: ServiceProviderRef(
        id: asString(row['provider_id']) ?? '',
        providerName: asString(row['provider_name']) ?? 'Provider',
        verified: asBool(row['provider_verified']),
      ),
      bookable: asBool(row['bookable']),
      summary: asString(row['summary']),
      serviceMode: asString(row['service_mode']) ?? 'ON_SITE',
      serviceModeLabel: asString(row['service_mode_label']) ?? 'On site',
      bookingPolicy: asString(row['booking_policy']) ?? 'REQUEST_APPROVAL',
      ratingAverage: asDouble(row['rating_average']),
      ratingCount: asInt(row['rating_count']) ?? 0,
      locationLabel: asString(row['location_label']),
    );
  }
}

class ServiceDetail {
  const ServiceDetail({
    required this.summary,
    required this.owner,
    required this.canBook,
    required this.bookingFields,
    required this.weeklyAvailability,
    required this.reviews,
    this.description,
    this.pricingNotes,
    this.bookingType = 'REQUEST',
    this.capacityType = 'SINGLE',
    this.capacityValue,
    this.durationMinutes,
    this.leadTimeMinutes = 0,
    this.cancellationWindowMinutes = 0,
    this.unavailableReason,
    this.location,
    this.reviewableBookingId,
  });

  final ServiceSummary summary;
  final bool owner;
  final bool canBook;
  final List<BookingFieldDefinition> bookingFields;
  final List<AvailabilityWindow> weeklyAvailability;
  final List<ServiceReview> reviews;
  final String? description;
  final String? pricingNotes;
  final String bookingType;
  final String capacityType;
  final int? capacityValue;
  final int? durationMinutes;
  final int leadTimeMinutes;
  final int cancellationWindowMinutes;
  final String? unavailableReason;
  final ServiceLocation? location;
  final String? reviewableBookingId;

  String get id => summary.id;

  factory ServiceDetail.fromJson(Map<String, dynamic> json) {
    final location = json['location'];
    return ServiceDetail(
      summary: ServiceSummary.fromJson(json),
      owner: asBool(json['owner']),
      canBook: asBool(json['canBook']),
      bookingFields:
          asJsonMapList(json['bookingFields']).map(BookingFieldDefinition.fromJson).toList(),
      weeklyAvailability:
          asJsonMapList(json['weeklyAvailability']).map(AvailabilityWindow.fromJson).toList(),
      reviews: asJsonMapList(json['reviews']).map(ServiceReview.fromJson).toList(),
      description: asString(json['description']),
      pricingNotes: asString(json['pricingNotes']),
      bookingType: asString(json['bookingType']) ?? 'REQUEST',
      capacityType: asString(json['capacityType']) ?? 'SINGLE',
      capacityValue: asInt(json['capacityValue']),
      durationMinutes: asInt(json['durationMinutes']),
      leadTimeMinutes: asInt(json['leadTimeMinutes']) ?? 0,
      cancellationWindowMinutes: asInt(json['cancellationWindowMinutes']) ?? 0,
      unavailableReason: asString(json['unavailableReason']),
      location: location == null ? null : ServiceLocation.fromJson(asJsonMap(location)),
      reviewableBookingId: asString(json['reviewableBookingId']),
    );
  }
}

class ServiceLocation {
  const ServiceLocation({
    required this.label,
    this.id,
    this.building,
    this.room,
    this.address,
    this.instructions,
    this.accessibilityInformation,
  });

  final String label;
  final String? id;
  final String? building;
  final String? room;
  final String? address;
  final String? instructions;
  final String? accessibilityInformation;

  String get detail =>
      [building, room, address].whereType<String>().where((part) => part.isNotEmpty).join(' · ');

  factory ServiceLocation.fromJson(Map<String, dynamic> json) {
    return ServiceLocation(
      label: asString(json['label']) ?? '',
      id: asString(json['id']),
      building: asString(json['building']),
      room: asString(json['room']),
      address: asString(json['address']),
      instructions: asString(json['instructions']),
      accessibilityInformation: asString(json['accessibilityInformation']),
    );
  }
}

class AvailabilityWindow {
  const AvailabilityWindow({
    required this.dayOfWeek,
    required this.dayLabel,
    required this.startMinute,
    required this.endMinute,
    required this.startLabel,
    required this.endLabel,
    this.id,
    this.slotMinutes,
    this.capacity,
  });

  final int dayOfWeek;
  final String dayLabel;
  final int startMinute;
  final int endMinute;
  final String startLabel;
  final String endLabel;
  final String? id;
  final int? slotMinutes;
  final int? capacity;

  String get label => '$dayLabel $startLabel to $endLabel';

  factory AvailabilityWindow.fromJson(Map<String, dynamic> json) {
    return AvailabilityWindow(
      dayOfWeek: asInt(json['dayOfWeek']) ?? 0,
      dayLabel: asString(json['dayLabel']) ?? '',
      startMinute: asInt(json['startMinute']) ?? 0,
      endMinute: asInt(json['endMinute']) ?? 0,
      startLabel: asString(json['startLabel']) ?? '',
      endLabel: asString(json['endLabel']) ?? '',
      id: asString(json['id']),
      slotMinutes: asInt(json['slotMinutes']),
      capacity: asInt(json['capacity']),
    );
  }
}

/// A dynamic booking form field. The client renders whatever the provider
/// defined rather than hard-coding a form per service.
class BookingFieldDefinition {
  const BookingFieldDefinition({
    required this.key,
    required this.label,
    required this.fieldType,
    required this.required,
    this.id,
    this.helpText,
    this.options = const [],
    this.minValue,
    this.maxValue,
    this.maxLength,
  });

  final String key;
  final String label;
  final String fieldType;
  final bool required;
  final String? id;
  final String? helpText;
  final List<String> options;
  final int? minValue;
  final int? maxValue;
  final int? maxLength;

  factory BookingFieldDefinition.fromJson(Map<String, dynamic> json) {
    return BookingFieldDefinition(
      key: asString(json['key']) ?? '',
      label: asString(json['label']) ?? '',
      fieldType: asString(json['fieldType']) ?? 'TEXT',
      required: asBool(json['required']),
      id: asString(json['id']),
      helpText: asString(json['helpText']),
      options: asStringList(json['options']),
      minValue: asInt(json['minValue']),
      maxValue: asInt(json['maxValue']),
      maxLength: asInt(json['maxLength']),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'key': key,
      'label': label,
      'fieldType': fieldType,
      'required': required,
      if (helpText != null) 'helpText': helpText,
      if (options.isNotEmpty) 'options': options,
      if (minValue != null) 'minValue': minValue,
      if (maxValue != null) 'maxValue': maxValue,
      if (maxLength != null) 'maxLength': maxLength,
    };
  }
}

/// The booking form as described by `GET /services/:id/booking-form`.
class BookingForm {
  const BookingForm({
    required this.serviceId,
    required this.title,
    required this.requiresTime,
    required this.bookingPolicy,
    required this.policyMessage,
    required this.priceLabel,
    required this.fields,
    this.durationMinutes,
  });

  final String serviceId;
  final String title;
  final bool requiresTime;
  final String bookingPolicy;
  final String policyMessage;
  final String priceLabel;
  final List<BookingFieldDefinition> fields;
  final int? durationMinutes;

  factory BookingForm.fromJson(Map<String, dynamic> json) {
    return BookingForm(
      serviceId: asString(json['serviceId']) ?? '',
      title: asString(json['title']) ?? '',
      requiresTime: asBool(json['requiresTime']),
      bookingPolicy: asString(json['bookingPolicy']) ?? 'REQUEST_APPROVAL',
      policyMessage: asString(json['policyMessage']) ?? '',
      priceLabel: asString(json['priceLabel']) ?? '',
      fields: asJsonMapList(json['fields']).map(BookingFieldDefinition.fromJson).toList(),
      durationMinutes: asInt(json['durationMinutes']),
    );
  }
}

class AvailabilityDay {
  const AvailabilityDay({
    required this.date,
    required this.dayLabel,
    required this.slots,
  });

  final String date;
  final String dayLabel;
  final List<AvailabilitySlot> slots;

  bool get hasOpenSlot => slots.any((slot) => slot.available);

  factory AvailabilityDay.fromJson(Map<String, dynamic> json) {
    return AvailabilityDay(
      date: asString(json['date']) ?? '',
      dayLabel: asString(json['dayLabel']) ?? '',
      slots: asJsonMapList(json['slots']).map(AvailabilitySlot.fromJson).toList(),
    );
  }
}

class AvailabilitySlot {
  const AvailabilitySlot({
    required this.start,
    required this.end,
    required this.label,
    required this.available,
    this.remaining,
  });

  final DateTime start;
  final DateTime end;
  final String label;
  final bool available;
  final int? remaining;

  /// Availability is stated in words; a dimmed chip alone is not enough.
  String get semanticLabel {
    if (!available) {
      return '$label. Fully booked.';
    }
    if (remaining == null) {
      return '$label. Available.';
    }
    return '$label. Available. $remaining left.';
  }

  factory AvailabilitySlot.fromJson(Map<String, dynamic> json) {
    return AvailabilitySlot(
      start: asDateTime(json['start']) ?? DateTime.now(),
      end: asDateTime(json['end']) ?? DateTime.now(),
      label: asString(json['label']) ?? '',
      available: asBool(json['available']),
      remaining: asInt(json['remaining']),
    );
  }
}

class ServiceReview {
  const ServiceReview({
    required this.id,
    required this.rating,
    this.body,
    this.authorName,
    this.providerResponse,
    this.createdAt,
    this.serviceTitle,
  });

  final String id;
  final int rating;
  final String? body;
  final String? authorName;
  final String? providerResponse;
  final DateTime? createdAt;
  final String? serviceTitle;

  String get ratingLabel => '$rating out of 5 stars';

  factory ServiceReview.fromJson(Map<String, dynamic> json) {
    return ServiceReview(
      id: asString(json['id']) ?? '',
      rating: asInt(json['rating']) ?? 0,
      body: asString(json['body']),
      authorName: asString(json['authorName']),
      providerResponse: asString(json['providerResponse']),
      createdAt: asDateTime(json['createdAt']),
      serviceTitle: asString(json['serviceTitle']),
    );
  }
}

/// A provider profile page. The provider is the same `Person` with a provider
/// role, which is why `personRoute` links back to the normal profile.
class ServiceProviderDetail {
  const ServiceProviderDetail({
    required this.id,
    required this.personId,
    required this.providerName,
    required this.status,
    required this.verified,
    required this.verifiedLabel,
    required this.owner,
    required this.services,
    required this.reviews,
    required this.locations,
    this.tagline,
    this.about,
    this.ratingAverage,
    this.ratingCount = 0,
    this.completedBookings = 0,
    this.respondsWithinHours,
  });

  final String id;
  final String personId;
  final String providerName;
  final String status;
  final bool verified;
  final String verifiedLabel;
  final bool owner;
  final List<ServiceSummary> services;
  final List<ServiceReview> reviews;
  final List<ServiceLocation> locations;
  final String? tagline;
  final String? about;
  final double? ratingAverage;
  final int ratingCount;
  final int completedBookings;
  final int? respondsWithinHours;

  String get personRoute => '/app/profile/$personId';

  String get ratingLabel => ratingCount == 0
      ? 'No reviews yet'
      : '${ratingAverage?.toStringAsFixed(1) ?? '—'} out of 5 from $ratingCount '
          '${ratingCount == 1 ? 'review' : 'reviews'}';

  factory ServiceProviderDetail.fromJson(Map<String, dynamic> json) {
    return ServiceProviderDetail(
      id: asString(json['id']) ?? '',
      personId: asString(json['personId']) ?? '',
      providerName: asString(json['providerName']) ?? 'Provider',
      status: asString(json['status']) ?? 'DRAFT',
      verified: asBool(json['verified']),
      verifiedLabel: asString(json['verifiedLabel']) ?? 'Not yet verified',
      owner: asBool(json['owner']),
      services: asJsonMapList(json['services']).map(ServiceSummary.fromJson).toList(),
      reviews: asJsonMapList(json['reviews']).map(ServiceReview.fromJson).toList(),
      locations: asJsonMapList(json['locations']).map(ServiceLocation.fromJson).toList(),
      tagline: asString(json['tagline']),
      about: asString(json['about']),
      ratingAverage: asDouble(json['ratingAverage']),
      ratingCount: asInt(json['ratingCount']) ?? 0,
      completedBookings: asInt(json['completedBookings']) ?? 0,
      respondsWithinHours: asInt(json['respondsWithinHours']),
    );
  }
}

/// The viewer's own provider profile, from `GET /service-providers/me`.
class MyProviderProfile {
  const MyProviderProfile({
    required this.isProvider,
    this.id,
    this.providerName,
    this.tagline,
    this.about,
    this.status,
    this.verified = false,
    this.contactPreference,
    this.respondsWithinHours,
    this.ratingAverage,
    this.ratingCount = 0,
    this.completedBookings = 0,
    this.locations = const [],
    this.verifications = const [],
  });

  final bool isProvider;
  final String? id;
  final String? providerName;
  final String? tagline;
  final String? about;
  final String? status;
  final bool verified;
  final String? contactPreference;
  final int? respondsWithinHours;
  final double? ratingAverage;
  final int ratingCount;
  final int completedBookings;
  final List<ServiceLocation> locations;
  final List<ProviderVerification> verifications;

  ProviderVerification? get latestVerification =>
      verifications.isEmpty ? null : verifications.first;

  String get verificationLabel {
    if (verified) {
      return 'Verified provider';
    }
    final latest = latestVerification;
    if (latest == null) {
      return 'Not yet verified';
    }
    switch (latest.status) {
      case 'PENDING':
        return 'Verification under review';
      case 'REJECTED':
        return 'Verification was not approved';
      default:
        return 'Not yet verified';
    }
  }

  factory MyProviderProfile.fromJson(Map<String, dynamic> json) {
    if (!asBool(json['isProvider'])) {
      return const MyProviderProfile(isProvider: false);
    }
    final provider = asJsonMap(json['provider']);
    return MyProviderProfile(
      isProvider: true,
      id: asString(provider['id']),
      providerName: asString(provider['providerName']),
      tagline: asString(provider['tagline']),
      about: asString(provider['about']),
      status: asString(provider['status']),
      verified: asBool(provider['verified']),
      contactPreference: asString(provider['contactPreference']),
      respondsWithinHours: asInt(provider['respondsWithinHours']),
      ratingAverage: asDouble(provider['ratingAverage']),
      ratingCount: asInt(provider['ratingCount']) ?? 0,
      completedBookings: asInt(provider['completedBookings']) ?? 0,
      locations: asJsonMapList(provider['locations']).map(ServiceLocation.fromJson).toList(),
      verifications:
          asJsonMapList(provider['verifications']).map(ProviderVerification.fromJson).toList(),
    );
  }
}

class ProviderVerification {
  const ProviderVerification({
    required this.id,
    required this.status,
    this.submittedNotes,
    this.rejectionReason,
    this.reviewedAt,
    this.createdAt,
  });

  final String id;
  final String status;
  final String? submittedNotes;
  final String? rejectionReason;
  final DateTime? reviewedAt;
  final DateTime? createdAt;

  factory ProviderVerification.fromJson(Map<String, dynamic> json) {
    return ProviderVerification(
      id: asString(json['id']) ?? '',
      status: asString(json['status']) ?? 'PENDING',
      submittedNotes: asString(json['submittedNotes']),
      rejectionReason: asString(json['rejectionReason']),
      reviewedAt: asDateTime(json['reviewedAt']),
      createdAt: asDateTime(json['createdAt']),
    );
  }
}

/// `GET /service-providers/me/dashboard`.
class ProviderDashboard {
  const ProviderDashboard({
    required this.providerName,
    required this.status,
    required this.verified,
    required this.ratingLabel,
    required this.pendingRequestCount,
    required this.todayBookingCount,
    required this.activeServiceCount,
    required this.unreadMessageCount,
    required this.pendingRequests,
    required this.todaysBookings,
  });

  final String providerName;
  final String status;
  final bool verified;
  final String ratingLabel;
  final int pendingRequestCount;
  final int todayBookingCount;
  final int activeServiceCount;
  final int unreadMessageCount;
  final List<ProviderQueueItem> pendingRequests;
  final List<ProviderQueueItem> todaysBookings;

  factory ProviderDashboard.fromJson(Map<String, dynamic> json) {
    final provider = asJsonMap(json['provider']);
    final summary = asJsonMap(json['summary']);
    return ProviderDashboard(
      providerName: asString(provider['providerName']) ?? 'Provider',
      status: asString(provider['status']) ?? 'DRAFT',
      verified: asBool(provider['verified']),
      ratingLabel: asString(provider['ratingLabel']) ?? 'No reviews yet',
      pendingRequestCount: asInt(summary['pendingRequestCount']) ?? 0,
      todayBookingCount: asInt(summary['todayBookingCount']) ?? 0,
      activeServiceCount: asInt(summary['activeServiceCount']) ?? 0,
      unreadMessageCount: asInt(summary['unreadMessageCount']) ?? 0,
      pendingRequests:
          asJsonMapList(json['pendingRequests']).map(ProviderQueueItem.fromJson).toList(),
      todaysBookings:
          asJsonMapList(json['todaysBookings']).map(ProviderQueueItem.fromJson).toList(),
    );
  }
}

class ProviderQueueItem {
  const ProviderQueueItem({
    required this.id,
    required this.serviceTitle,
    this.customerName,
    this.status,
    this.start,
    this.quantity,
  });

  final String id;
  final String serviceTitle;
  final String? customerName;
  final String? status;
  final DateTime? start;
  final int? quantity;

  String get route => '/app/services/bookings/$id';

  factory ProviderQueueItem.fromJson(Map<String, dynamic> json) {
    return ProviderQueueItem(
      id: asString(json['id']) ?? '',
      serviceTitle: asString(json['serviceTitle']) ?? '',
      customerName: asString(json['customerName']),
      status: asString(json['status']),
      start: asDateTime(json['confirmedStart']) ?? asDateTime(json['requestedStart']),
      quantity: asInt(json['quantity']),
    );
  }
}

const serviceModeOptions = <String, String>{
  'ON_SITE': 'On site',
  'REMOTE': 'Remote',
  'DELIVERY': 'Delivery',
  'PICKUP': 'Pickup',
  'ON_DEMAND': 'On demand',
  'APPOINTMENT': 'By appointment',
};

const servicePricingOptions = <String, String>{
  'FIXED': 'Fixed price',
  'FROM': 'Starting from',
  'PER_UNIT': 'Per unit',
  'QUOTE_REQUIRED': 'Quote on request',
  'FREE': 'Free',
  'CUSTOM': 'Custom',
};

const serviceBookingPolicyOptions = <String, String>{
  'OPEN_BOOKING': 'Confirm automatically',
  'REQUEST_APPROVAL': 'I approve each request',
  'REQUIRES_QUOTE': 'I send a quote first',
  'CONTACT_FIRST': 'Customers message me first',
};

const serviceCapacityOptions = <String, String>{
  'SINGLE': 'One booking at a time',
  'LIMITED': 'A set number at a time',
  'UNLIMITED': 'No limit',
};

const weekdayLabels = <String>[
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

String minuteOfDayLabel(int minute) {
  final hours = (minute ~/ 60).toString().padLeft(2, '0');
  final minutes = (minute % 60).toString().padLeft(2, '0');
  return '$hours:$minutes';
}
