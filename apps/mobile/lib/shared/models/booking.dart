import 'package:campusos/shared/models/campus_service.dart';
import 'package:campusos/shared/models/json_map.dart';

/// A booking. `availableActions` is advisory: the server re-checks the actor's
/// role and the booking state on every transition.
class Booking {
  const Booking({
    required this.id,
    required this.status,
    required this.statusLabel,
    required this.stateLabel,
    required this.bookingType,
    required this.quantity,
    required this.terminal,
    required this.viewerRole,
    required this.availableActions,
    required this.service,
    required this.provider,
    required this.fieldValues,
    this.timezone = 'Africa/Harare',
    this.requestedStart,
    this.requestedEnd,
    this.confirmedStart,
    this.confirmedEnd,
    this.createdAt,
    this.customerNotes,
    this.providerMessage,
    this.providerInternalNotes,
    this.declineReason,
    this.cancellationReason,
    this.quotedAmount,
    this.quotedCurrency,
    this.conversationId,
    this.activityId,
    this.location,
    this.review,
    this.customer,
    this.accessibilityLabel,
  });

  final String id;
  final String status;
  final String statusLabel;

  /// "Confirmed — 18 September at 10:30" as produced by the server.
  final String stateLabel;
  final String bookingType;
  final int quantity;
  final bool terminal;
  final String viewerRole;
  final List<String> availableActions;
  final BookingServiceRef service;
  final ServiceProviderRef provider;
  final List<BookingFieldValue> fieldValues;
  final String timezone;
  final DateTime? requestedStart;
  final DateTime? requestedEnd;
  final DateTime? confirmedStart;
  final DateTime? confirmedEnd;
  final DateTime? createdAt;
  final String? customerNotes;
  final String? providerMessage;

  /// Only ever present for the owning provider. The server omits this field
  /// entirely from customer responses.
  final String? providerInternalNotes;
  final String? declineReason;
  final String? cancellationReason;
  final double? quotedAmount;
  final String? quotedCurrency;
  final String? conversationId;
  final String? activityId;
  final ServiceLocation? location;
  final BookingReviewRef? review;
  final BookingCustomerRef? customer;
  final String? accessibilityLabel;

  bool get isProviderView => viewerRole == 'PROVIDER';

  DateTime? get start => confirmedStart ?? requestedStart;

  DateTime? get end => confirmedEnd ?? requestedEnd;

  String get route => '/app/services/bookings/$id';

  bool can(String action) => availableActions.contains(action);

  String get semanticLabel => accessibilityLabel ?? '${service.title}. $stateLabel.';

  factory Booking.fromJson(Map<String, dynamic> json) {
    final location = json['location'];
    final review = json['review'];
    final customer = json['customer'];
    return Booking(
      id: asString(json['id']) ?? '',
      status: asString(json['status']) ?? 'DRAFT',
      statusLabel: asString(json['statusLabel']) ?? '',
      stateLabel: asString(json['stateLabel']) ?? '',
      bookingType: asString(json['bookingType']) ?? 'REQUEST',
      quantity: asInt(json['quantity']) ?? 1,
      terminal: asBool(json['terminal']),
      viewerRole: asString(json['viewerRole']) ?? 'CUSTOMER',
      availableActions: asStringList(json['availableActions']),
      service: BookingServiceRef.fromJson(asJsonMap(json['service'])),
      provider: ServiceProviderRef.fromJson(asJsonMap(json['provider'])),
      fieldValues: asJsonMapList(json['fieldValues']).map(BookingFieldValue.fromJson).toList(),
      timezone: asString(json['timezone']) ?? 'Africa/Harare',
      requestedStart: asDateTime(json['requestedStart']),
      requestedEnd: asDateTime(json['requestedEnd']),
      confirmedStart: asDateTime(json['confirmedStart']),
      confirmedEnd: asDateTime(json['confirmedEnd']),
      createdAt: asDateTime(json['createdAt']),
      customerNotes: asString(json['customerNotes']),
      providerMessage: asString(json['providerMessage']),
      providerInternalNotes: asString(json['providerInternalNotes']),
      declineReason: asString(json['declineReason']),
      cancellationReason: asString(json['cancellationReason']),
      quotedAmount: asDouble(json['quotedAmount']),
      quotedCurrency: asString(json['quotedCurrency']),
      conversationId: asString(json['conversationId']),
      activityId: asString(json['activityId']),
      location: location == null ? null : ServiceLocation.fromJson(asJsonMap(location)),
      review: review == null ? null : BookingReviewRef.fromJson(asJsonMap(review)),
      customer: customer == null ? null : BookingCustomerRef.fromJson(asJsonMap(customer)),
      accessibilityLabel: asString(json['accessibilityLabel']),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'status': status,
      'status_label': statusLabel,
      'state_label': stateLabel,
      'booking_type': bookingType,
      'quantity': quantity,
      'terminal': terminal ? 1 : 0,
      'viewer_role': viewerRole,
      'service_id': service.id,
      'service_title': service.title,
      'category_label': service.categoryLabel,
      'price_label': service.priceLabel,
      'provider_id': provider.id,
      'provider_name': provider.providerName,
      'start_time': start?.toIso8601String(),
      'end_time': end?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
      'location_label': location?.label,
      'conversation_id': conversationId,
      'customer_name': customer?.displayName,
    };
  }

  factory Booking.fromRow(Map<String, Object?> row) {
    final start = asDateTime(row['start_time']);
    return Booking(
      id: asString(row['id']) ?? '',
      status: asString(row['status']) ?? 'DRAFT',
      statusLabel: asString(row['status_label']) ?? '',
      stateLabel: asString(row['state_label']) ?? '',
      bookingType: asString(row['booking_type']) ?? 'REQUEST',
      quantity: asInt(row['quantity']) ?? 1,
      terminal: asBool(row['terminal']),
      viewerRole: asString(row['viewer_role']) ?? 'CUSTOMER',
      // Deliberately empty: a cached booking must not offer actions that the
      // server has not just authorised.
      availableActions: const [],
      service: BookingServiceRef(
        id: asString(row['service_id']) ?? '',
        title: asString(row['service_title']) ?? '',
        categoryLabel: asString(row['category_label']) ?? '',
        priceLabel: asString(row['price_label']) ?? '',
      ),
      provider: ServiceProviderRef(
        id: asString(row['provider_id']) ?? '',
        providerName: asString(row['provider_name']) ?? 'Provider',
      ),
      fieldValues: const [],
      confirmedStart: start,
      confirmedEnd: asDateTime(row['end_time']),
      createdAt: asDateTime(row['created_at']),
      conversationId: asString(row['conversation_id']),
      location: asString(row['location_label']) == null
          ? null
          : ServiceLocation(label: asString(row['location_label'])!),
      customer: asString(row['customer_name']) == null
          ? null
          : BookingCustomerRef(
              personId: '',
              displayName: asString(row['customer_name']),
            ),
    );
  }
}

class BookingServiceRef {
  const BookingServiceRef({
    required this.id,
    required this.title,
    required this.categoryLabel,
    required this.priceLabel,
    this.categoryKey,
    this.serviceMode,
  });

  final String id;
  final String title;
  final String categoryLabel;
  final String priceLabel;
  final String? categoryKey;
  final String? serviceMode;

  String get route => '/app/explore/service/$id';

  factory BookingServiceRef.fromJson(Map<String, dynamic> json) {
    return BookingServiceRef(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      categoryLabel: asString(json['categoryLabel']) ?? '',
      priceLabel: asString(json['priceLabel']) ?? '',
      categoryKey: asString(json['categoryKey']),
      serviceMode: asString(json['serviceMode']),
    );
  }
}

/// The customer as a provider is allowed to see them: identity only, never a
/// phone number, registration number or academic record.
class BookingCustomerRef {
  const BookingCustomerRef({
    required this.personId,
    this.displayName,
    this.username,
    this.photoFileId,
  });

  final String personId;
  final String? displayName;
  final String? username;
  final String? photoFileId;

  String get name => displayName ?? (username == null ? 'Customer' : '@$username');

  String get route => '/app/profile/$personId';

  factory BookingCustomerRef.fromJson(Map<String, dynamic> json) {
    return BookingCustomerRef(
      personId: asString(json['personId']) ?? '',
      displayName: asString(json['displayName']),
      username: asString(json['username']),
      photoFileId: asString(json['photoFileId']),
    );
  }
}

class BookingFieldValue {
  const BookingFieldValue({required this.key, required this.label, required this.value});

  final String key;
  final String label;
  final String value;

  factory BookingFieldValue.fromJson(Map<String, dynamic> json) {
    return BookingFieldValue(
      key: asString(json['key']) ?? '',
      label: asString(json['label']) ?? '',
      value: asString(json['value']) ?? '—',
    );
  }
}

class BookingReviewRef {
  const BookingReviewRef({required this.id, required this.rating, this.body});

  final String id;
  final int rating;
  final String? body;

  factory BookingReviewRef.fromJson(Map<String, dynamic> json) {
    return BookingReviewRef(
      id: asString(json['id']) ?? '',
      rating: asInt(json['rating']) ?? 0,
      body: asString(json['body']),
    );
  }
}

/// Customer-side booking list filters. The values are booking statuses the
/// server understands, or null for everything.
class BookingFilter {
  const BookingFilter({required this.label, this.status});

  final String label;
  final String? status;

  static const customer = <BookingFilter>[
    BookingFilter(label: 'All'),
    BookingFilter(label: 'Requested', status: 'REQUESTED'),
    BookingFilter(label: 'Confirmed', status: 'CONFIRMED'),
    BookingFilter(label: 'In progress', status: 'IN_PROGRESS'),
    BookingFilter(label: 'Completed', status: 'COMPLETED'),
    BookingFilter(label: 'Cancelled', status: 'CANCELLED'),
  ];

  static const provider = <BookingFilter>[
    BookingFilter(label: 'Requests', status: 'REQUESTED'),
    BookingFilter(label: 'Confirmed', status: 'CONFIRMED'),
    BookingFilter(label: 'In progress', status: 'IN_PROGRESS'),
    BookingFilter(label: 'Completed', status: 'COMPLETED'),
    BookingFilter(label: 'All'),
  ];
}

const bookingActionLabels = <String, String>{
  'CONFIRM': 'Confirm',
  'DECLINE': 'Decline',
  'START': 'Start',
  'COMPLETE': 'Mark complete',
  'CANCEL': 'Cancel booking',
  'RESCHEDULE': 'Reschedule',
  'REVIEW': 'Leave a review',
  'OPEN_CONVERSATION': 'Message',
};

const serviceReviewReportReasons = <String, String>{
  'SPAM': 'Spam',
  'HARASSMENT': 'Harassment',
  'INAPPROPRIATE_CONTENT': 'Inappropriate content',
  'MISLEADING': 'Misleading information',
  'OTHER': 'Something else',
};
