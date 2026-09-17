import 'dart:convert';

import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/booking.dart';
import 'package:campusos/shared/models/campus_service.dart';
import 'package:campusos/shared/models/json_map.dart';

/// The provider workspace in one value. `profile.isProvider` decides whether the
/// rest of it exists: a person without a provider profile still gets a
/// workspace, just an empty one they can opt into.
class ProviderWorkspace {
  const ProviderWorkspace({
    required this.profile,
    this.dashboard,
    this.reviews = const [],
    this.fromCache = false,
    this.lastUpdated,
  });

  final MyProviderProfile profile;
  final ProviderDashboard? dashboard;
  final List<ServiceReview> reviews;
  final bool fromCache;
  final DateTime? lastUpdated;
}

class ProviderBookingPage {
  const ProviderBookingPage({
    required this.items,
    this.nextCursor,
    this.fromCache = false,
  });

  final List<Booking> items;
  final String? nextCursor;
  final bool fromCache;
}

/// One of the provider's own services, including drafts.
class ProviderServiceListItem {
  const ProviderServiceListItem({
    required this.summary,
    required this.transitions,
    required this.manageRoute,
  });

  final ServiceSummary summary;

  /// Lifecycle transitions the server has just authorised for this status. A
  /// cached row carries none, because the server has not authorised anything.
  final List<String> transitions;
  final String manageRoute;

  String get id => summary.id;

  factory ProviderServiceListItem.fromJson(Map<String, dynamic> json) {
    return ProviderServiceListItem(
      summary: ServiceSummary.fromJson(json),
      transitions: asStringList(json['transitions']),
      manageRoute: _manageRoute(json),
    );
  }

  factory ProviderServiceListItem.cached(Map<String, dynamic> json) {
    return ProviderServiceListItem(
      summary: ServiceSummary.fromJson(json),
      transitions: const [],
      manageRoute: _manageRoute(json),
    );
  }

  static String _manageRoute(Map<String, dynamic> json) {
    return asString(json['manageRoute']) ??
        '/app/services/provider/services/${asString(json['id']) ?? ''}';
  }
}

/// A service as its owner edits it. `ServiceDetail` covers everything the
/// customer side needs; the provider also needs the raw price parts and the
/// date exceptions, which the catalogue response carries but does not model.
class ProviderServiceDetail {
  const ProviderServiceDetail({
    required this.detail,
    required this.exceptions,
    this.priceAmount,
    this.priceCurrency = 'USD',
    this.priceUnit,
  });

  final ServiceDetail detail;
  final List<ServiceAvailabilityException> exceptions;
  final double? priceAmount;
  final String priceCurrency;
  final String? priceUnit;

  ServiceSummary get summary => detail.summary;

  String get id => detail.summary.id;

  factory ProviderServiceDetail.fromJson(Map<String, dynamic> json) {
    return ProviderServiceDetail(
      detail: ServiceDetail.fromJson(json),
      exceptions: asJsonMapList(json['exceptions'])
          .map(ServiceAvailabilityException.fromJson)
          .toList(),
      priceAmount: asDouble(json['priceAmount']),
      priceCurrency: asString(json['priceCurrency']) ?? 'USD',
      priceUnit: asString(json['priceUnit']),
    );
  }
}

class ServiceAvailabilityException {
  const ServiceAvailabilityException({
    required this.id,
    required this.date,
    required this.closed,
    this.startMinute,
    this.endMinute,
    this.reason,
  });

  final String id;

  /// `YYYY-MM-DD` in campus time, as the server stores it.
  final String date;
  final bool closed;
  final int? startMinute;
  final int? endMinute;
  final String? reason;

  String get label {
    if (closed) {
      return 'Closed all day';
    }
    final start = startMinute;
    final end = endMinute;
    if (start == null || end == null) {
      return 'Open as usual';
    }
    return 'Open ${minuteOfDayLabel(start)} to ${minuteOfDayLabel(end)}';
  }

  factory ServiceAvailabilityException.fromJson(Map<String, dynamic> json) {
    return ServiceAvailabilityException(
      id: asString(json['id']) ?? '',
      date: asString(json['date']) ?? '',
      closed: asBool(json['closed']),
      startMinute: asInt(json['startMinute']),
      endMinute: asInt(json['endMinute']),
      reason: asString(json['reason']),
    );
  }
}

/// One weekly opening rule, as the full-replace `PUT` expects it.
class AvailabilityRuleInput {
  const AvailabilityRuleInput({
    required this.dayOfWeek,
    required this.startMinute,
    required this.endMinute,
    this.slotMinutes,
    this.capacity,
  });

  final int dayOfWeek;
  final int startMinute;
  final int endMinute;
  final int? slotMinutes;
  final int? capacity;

  String get dayLabel => weekdayLabels[dayOfWeek % 7];

  String get timeLabel =>
      '${minuteOfDayLabel(startMinute)} to ${minuteOfDayLabel(endMinute)}';

  AvailabilityRuleInput copyWith({
    int? dayOfWeek,
    int? startMinute,
    int? endMinute,
    int? slotMinutes,
    int? capacity,
    bool clearSlotMinutes = false,
    bool clearCapacity = false,
  }) {
    return AvailabilityRuleInput(
      dayOfWeek: dayOfWeek ?? this.dayOfWeek,
      startMinute: startMinute ?? this.startMinute,
      endMinute: endMinute ?? this.endMinute,
      slotMinutes: clearSlotMinutes ? null : slotMinutes ?? this.slotMinutes,
      capacity: clearCapacity ? null : capacity ?? this.capacity,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'dayOfWeek': dayOfWeek,
      'startMinute': startMinute,
      'endMinute': endMinute,
      if (slotMinutes != null) 'slotMinutes': slotMinutes,
      if (capacity != null) 'capacity': capacity,
    };
  }

  factory AvailabilityRuleInput.fromWindow(AvailabilityWindow window) {
    return AvailabilityRuleInput(
      dayOfWeek: window.dayOfWeek,
      startMinute: window.startMinute,
      endMinute: window.endMinute,
      slotMinutes: window.slotMinutes,
      capacity: window.capacity,
    );
  }
}

/// The service create/update body. Fields the server stores as nullable are
/// always sent so that clearing one actually clears it; the rest are omitted
/// when absent so the server keeps its own value.
class ProviderServiceInput {
  const ProviderServiceInput({
    this.categoryKey,
    this.title,
    this.summary,
    this.description,
    this.serviceMode,
    this.pricingModel,
    this.priceAmount,
    this.priceCurrency,
    this.priceUnit,
    this.pricingNotes,
    this.bookingPolicy,
    this.capacityType,
    this.capacityValue,
    this.durationMinutes,
    this.leadTimeMinutes,
    this.cancellationWindowMinutes,
    this.locationId,
  });

  final String? categoryKey;
  final String? title;
  final String? summary;
  final String? description;
  final String? serviceMode;
  final String? pricingModel;
  final double? priceAmount;
  final String? priceCurrency;
  final String? priceUnit;
  final String? pricingNotes;
  final String? bookingPolicy;
  final String? capacityType;
  final int? capacityValue;
  final int? durationMinutes;
  final int? leadTimeMinutes;
  final int? cancellationWindowMinutes;
  final String? locationId;

  Map<String, Object?> toJson() {
    return {
      if (categoryKey != null) 'categoryKey': categoryKey,
      if (title != null) 'title': title,
      'summary': summary,
      'description': description,
      if (serviceMode != null) 'serviceMode': serviceMode,
      if (pricingModel != null) 'pricingModel': pricingModel,
      'priceAmount': priceAmount,
      if (priceCurrency != null) 'priceCurrency': priceCurrency,
      'priceUnit': priceUnit,
      'pricingNotes': pricingNotes,
      if (bookingPolicy != null) 'bookingPolicy': bookingPolicy,
      if (capacityType != null) 'capacityType': capacityType,
      'capacityValue': capacityValue,
      'durationMinutes': durationMinutes,
      if (leadTimeMinutes != null) 'leadTimeMinutes': leadTimeMinutes,
      if (cancellationWindowMinutes != null)
        'cancellationWindowMinutes': cancellationWindowMinutes,
      'locationId': locationId,
    };
  }
}

/// Provider-side workspace and mutations. Every call re-reads the provider
/// profile on the server, so nothing here is authoritative about permission:
/// the caller must always be ready for a refusal.
class ProviderRepository {
  ProviderRepository({required ApiClient api, required AppDatabase database})
      : _api = api,
        _database = database;

  final ApiClient _api;
  final AppDatabase _database;

  Future<ProviderWorkspace> workspace({required bool online}) async {
    if (!online) {
      final cached = await _cachedWorkspace();
      if (cached != null) {
        return cached;
      }
    }
    try {
      final mePayload = await _api.get('service-providers/me');
      final profile = MyProviderProfile.fromJson(mePayload);
      if (!profile.isProvider) {
        await _cacheWorkspace(me: mePayload);
        return ProviderWorkspace(profile: profile, lastUpdated: DateTime.now());
      }
      final dashboardPayload = await _api.get('service-providers/me/dashboard');
      final reviewsPayload = await _api.get('service-providers/me/reviews');
      final reviews = asJsonMapList(reviewsPayload['items']);
      await _cacheWorkspace(
        me: mePayload,
        dashboard: dashboardPayload,
        reviews: reviews,
      );
      return ProviderWorkspace(
        profile: profile,
        dashboard: ProviderDashboard.fromJson(dashboardPayload),
        reviews: reviews.map(ServiceReview.fromJson).toList(),
        lastUpdated: DateTime.now(),
      );
    } on ApiError {
      final cached = await _cachedWorkspace();
      if (cached != null) {
        return cached;
      }
      rethrow;
    }
  }

  Future<MyProviderProfile> createProfile({
    required String providerName,
    String? tagline,
    String? about,
  }) async {
    final payload = await _api.post(
      'service-providers/me',
      data: {
        'providerName': providerName,
        if (tagline != null && tagline.isNotEmpty) 'tagline': tagline,
        if (about != null && about.isNotEmpty) 'about': about,
      },
    );
    return MyProviderProfile.fromJson(payload);
  }

  Future<MyProviderProfile> updateProfile({
    String? providerName,
    String? tagline,
    String? about,
    String? contactPreference,
    int? respondsWithinHours,
  }) async {
    final payload = await _api.patch(
      'service-providers/me',
      data: {
        if (providerName != null) 'providerName': providerName,
        'tagline': tagline,
        'about': about,
        if (contactPreference != null) 'contactPreference': contactPreference,
        if (respondsWithinHours != null) 'respondsWithinHours': respondsWithinHours,
      },
    );
    return MyProviderProfile.fromJson(payload);
  }

  Future<ProviderVerification> submitVerification({
    String? notes,
    String? evidenceFileId,
  }) async {
    final payload = await _api.post(
      'service-providers/me/verification',
      data: {
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (evidenceFileId != null) 'evidenceFileId': evidenceFileId,
      },
    );
    return ProviderVerification.fromJson(payload);
  }

  Future<ServiceLocation> upsertLocation({
    String? id,
    required String label,
    String? building,
    String? room,
    String? address,
    String? instructions,
    String? accessibilityInformation,
  }) async {
    final payload = await _api.post(
      'service-providers/me/locations',
      data: {
        if (id != null) 'id': id,
        'label': label,
        'building': building,
        'room': room,
        'address': address,
        'instructions': instructions,
        'accessibilityInformation': accessibilityInformation,
      },
    );
    return ServiceLocation.fromJson(payload);
  }

  Future<void> respondToReview(String reviewId, String body) async {
    await _api.post('service-reviews/$reviewId/response', data: {'body': body});
  }

  Future<List<ProviderServiceListItem>> myServices({required bool online}) async {
    if (!online) {
      return _cachedServices();
    }
    try {
      final payload = await _api.get('service-providers/me/services');
      final rows = asJsonMapList(payload['items']);
      await _database.setMeta('provider.services', jsonEncode(rows));
      return rows.map(ProviderServiceListItem.fromJson).toList();
    } on ApiError {
      final cached = await _cachedServices();
      if (cached.isEmpty) {
        rethrow;
      }
      return cached;
    }
  }

  Future<ProviderServiceDetail> service(String serviceId) async {
    return ProviderServiceDetail.fromJson(await _api.get('services/$serviceId'));
  }

  Future<ProviderServiceDetail> createService(ProviderServiceInput input) async {
    return ProviderServiceDetail.fromJson(
      await _api.post('service-providers/me/services', data: input.toJson()),
    );
  }

  Future<ProviderServiceDetail> updateService(
    String serviceId,
    ProviderServiceInput input,
  ) async {
    return ProviderServiceDetail.fromJson(
      await _api.patch(
        'service-providers/me/services/$serviceId',
        data: input.toJson(),
      ),
    );
  }

  /// `action` is one of the transitions the server listed for the service.
  Future<ProviderServiceDetail> changeServiceStatus(
    String serviceId,
    String action, {
    String? reason,
  }) async {
    const paths = <String, String>{
      'PUBLISH': 'publish',
      'PAUSE': 'pause',
      'RESUME': 'resume',
      'DISCONTINUE': 'discontinue',
    };
    final segment = paths[action];
    if (segment == null) {
      throw ArgumentError.value(action, 'action', 'Unknown service transition');
    }
    return ProviderServiceDetail.fromJson(
      await _api.post(
        'service-providers/me/services/$serviceId/$segment',
        data: action == 'PAUSE' && reason != null && reason.isNotEmpty
            ? {'reason': reason}
            : const <String, Object?>{},
      ),
    );
  }

  Future<ProviderServiceDetail> replaceBookingFields(
    String serviceId,
    List<BookingFieldDefinition> fields,
  ) async {
    return ProviderServiceDetail.fromJson(
      await _api.put(
        'service-providers/me/services/$serviceId/booking-fields',
        data: {'fields': fields.map((field) => field.toJson()).toList()},
      ),
    );
  }

  Future<ProviderServiceDetail> replaceAvailability(
    String serviceId,
    List<AvailabilityRuleInput> rules,
  ) async {
    return ProviderServiceDetail.fromJson(
      await _api.put(
        'service-providers/me/services/$serviceId/availability',
        data: {'rules': rules.map((rule) => rule.toJson()).toList()},
      ),
    );
  }

  Future<ProviderServiceDetail> addAvailabilityException(
    String serviceId, {
    required String date,
    bool closed = true,
    int? startMinute,
    int? endMinute,
    String? reason,
  }) async {
    return ProviderServiceDetail.fromJson(
      await _api.post(
        'service-providers/me/services/$serviceId/availability/exceptions',
        data: {
          'date': date,
          'closed': closed,
          if (startMinute != null) 'startMinute': startMinute,
          if (endMinute != null) 'endMinute': endMinute,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      ),
    );
  }

  Future<ProviderServiceDetail> removeAvailabilityException(
    String serviceId,
    String exceptionId,
  ) async {
    return ProviderServiceDetail.fromJson(
      await _api.delete(
        'service-providers/me/services/$serviceId/availability/exceptions/$exceptionId',
      ),
    );
  }

  Future<ProviderBookingPage> bookings({
    String? status,
    String? cursor,
    required bool online,
  }) async {
    if (!online) {
      return ProviderBookingPage(
        items: await _database.cachedBookings(viewerRole: 'PROVIDER', status: status),
        fromCache: true,
      );
    }
    try {
      final payload = await _api.get(
        'service-providers/me/bookings',
        query: {
          if (status != null) 'status': status,
          if (cursor != null) 'cursor': cursor,
        },
      );
      final items = asJsonMapList(payload['items']).map(Booking.fromJson).toList();
      await _database.upsertBookings(items);
      return ProviderBookingPage(
        items: items,
        nextCursor: asString(payload['nextCursor']),
      );
    } on ApiError {
      final cached =
          await _database.cachedBookings(viewerRole: 'PROVIDER', status: status);
      if (cached.isEmpty) {
        rethrow;
      }
      return ProviderBookingPage(items: cached, fromCache: true);
    }
  }

  Future<Booking> confirmBooking(
    String bookingId, {
    String? message,
    String? internalNotes,
    DateTime? start,
    DateTime? end,
  }) async {
    final payload = await _api.post(
      'bookings/$bookingId/confirm',
      data: {
        if (message != null && message.isNotEmpty) 'message': message,
        if (internalNotes != null && internalNotes.isNotEmpty)
          'internalNotes': internalNotes,
        if (start != null) 'start': start.toUtc().toIso8601String(),
        if (end != null) 'end': end.toUtc().toIso8601String(),
      },
    );
    return Booking.fromJson(payload);
  }

  Future<Booking> declineBooking(String bookingId, {String? reason}) async {
    final payload = await _api.post(
      'bookings/$bookingId/decline',
      data: {
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
    );
    return Booking.fromJson(payload);
  }

  Future<Booking> startBooking(String bookingId) async {
    return Booking.fromJson(await _api.post('bookings/$bookingId/start'));
  }

  Future<Booking> completeBooking(String bookingId, {String? notes}) async {
    final payload = await _api.post(
      'bookings/$bookingId/complete',
      data: {
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
    );
    return Booking.fromJson(payload);
  }

  Future<List<ServiceCategory>> categories({required bool online}) async {
    if (!online) {
      return _database.serviceCategories();
    }
    try {
      final payload = await _api.get('service-categories');
      final items =
          asJsonMapList(payload['items']).map(ServiceCategory.fromJson).toList();
      await _database.replaceServiceCategories(items);
      return items;
    } on ApiError {
      final cached = await _database.serviceCategories();
      if (cached.isEmpty) {
        rethrow;
      }
      return cached;
    }
  }

  Future<void> _cacheWorkspace({
    required Map<String, dynamic> me,
    Map<String, dynamic>? dashboard,
    List<Map<String, dynamic>>? reviews,
  }) async {
    await _database.setMeta('provider.me', jsonEncode(me));
    await _database.setMeta(
      'provider.dashboard',
      dashboard == null ? '' : jsonEncode(dashboard),
    );
    await _database.setMeta(
      'provider.reviews',
      reviews == null ? '' : jsonEncode(reviews),
    );
    await _database.setMeta('provider.synced_at', DateTime.now().toIso8601String());
  }

  Future<ProviderWorkspace?> _cachedWorkspace() async {
    final me = await _database.meta('provider.me');
    if (me == null || me.isEmpty) {
      return null;
    }
    final dashboard = await _database.meta('provider.dashboard');
    final reviews = await _database.meta('provider.reviews');
    final syncedAt = await _database.meta('provider.synced_at');
    return ProviderWorkspace(
      profile: MyProviderProfile.fromJson(asJsonMap(jsonDecode(me))),
      dashboard: dashboard == null || dashboard.isEmpty
          ? null
          : ProviderDashboard.fromJson(asJsonMap(jsonDecode(dashboard))),
      reviews: reviews == null || reviews.isEmpty
          ? const []
          : asJsonMapList(jsonDecode(reviews)).map(ServiceReview.fromJson).toList(),
      fromCache: true,
      lastUpdated: syncedAt == null ? null : DateTime.tryParse(syncedAt),
    );
  }

  Future<List<ProviderServiceListItem>> _cachedServices() async {
    final raw = await _database.meta('provider.services');
    if (raw == null || raw.isEmpty) {
      return const [];
    }
    return asJsonMapList(jsonDecode(raw))
        .map(ProviderServiceListItem.cached)
        .toList();
  }
}

const providerServiceActionLabels = <String, String>{
  'PUBLISH': 'Publish',
  'PAUSE': 'Pause',
  'RESUME': 'Resume',
  'DISCONTINUE': 'Discontinue',
};

const bookingFieldTypeOptions = <String, String>{
  'TEXT': 'Text',
  'NUMBER': 'Number',
  'BOOLEAN': 'Yes or no',
  'SELECT': 'Choose one',
  'MULTI_SELECT': 'Choose several',
  'DATE': 'Date',
  'TIME': 'Time',
  'FILE': 'File',
};

/// The vocabulary the server accepts for `contactPreference`. The column is a
/// free string with this default, so only the documented value is offered.
const providerContactPreferenceOptions = <String, String>{
  'CAMPUSOS_MESSAGES': 'CampusOS messages',
};

/// The date format the availability exception endpoints expect.
String serviceDateKey(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year.toString().padLeft(4, '0')}-$month-$day';
}

/// The server's own wording for a failure, which is always more specific than
/// anything the client could invent.
String providerErrorMessage(Object error) =>
    error is ApiError ? error.message : ApiError.genericMessage;

/// A refusal caused by someone else changing the record first. The list has to
/// be reloaded before the person can act again.
bool isStaleStateError(Object error) =>
    error is ApiError && (error.code == 'CONFLICT' || error.isNotFound);

bool isOfflineError(Object error) => error is ApiError && error.code == 'OFFLINE';
