import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/services/data/services_repository.dart';
import 'package:campusos/shared/models/booking.dart';
import 'package:campusos/shared/models/json_map.dart';

class BookingPage {
  const BookingPage({
    required this.items,
    this.nextCursor,
    this.fromCache = false,
  });

  final List<Booking> items;
  final String? nextCursor;

  /// True when the list was read from the on-device cache, which means the
  /// bookings carry no `availableActions`.
  final bool fromCache;
}

class BookingCreation {
  const BookingCreation({required this.booking, required this.deduplicated});

  final Booking booking;

  /// The server matched an earlier request with the same `clientActionId`, so
  /// this is the existing booking rather than a second one.
  final bool deduplicated;
}

class BookingsRepository {
  BookingsRepository({required ApiClient api, required AppDatabase database})
      : _api = api,
        _database = database;

  final ApiClient _api;
  final AppDatabase _database;

  static const customerViewerRole = 'CUSTOMER';

  /// The server's copy for a slot that was taken while the user was deciding.
  /// The client repeats it because `ApiError` replaces CONFLICT messages with
  /// its generic editing-conflict text.
  static const unavailableMessage = 'This booking is no longer available.';

  static const offlineBookingMessage =
      "You're offline and this booking is not saved on this device.";

  Future<BookingPage> list({
    required bool online,
    String? status,
    String? cursor,
  }) async {
    if (!online) {
      return BookingPage(items: await _cachedBookings(status), fromCache: true);
    }
    try {
      final body = await _api.get(
        'bookings',
        query: {
          if (status != null && status.isNotEmpty) 'status': status,
          if (cursor != null) 'cursor': cursor,
        },
      );
      final items = asJsonMapList(body['items']).map(Booking.fromJson).toList();
      await _database.upsertBookings(items);
      return BookingPage(items: items, nextCursor: asString(body['nextCursor']));
    } on ApiError catch (error) {
      if (error.code == 'OFFLINE' && cursor == null) {
        return BookingPage(items: await _cachedBookings(status), fromCache: true);
      }
      rethrow;
    }
  }

  Future<Booking> booking(String bookingId, {required bool online}) async {
    if (!online) {
      return _cachedBooking(bookingId);
    }
    try {
      final booking = Booking.fromJson(await _api.get('bookings/$bookingId'));
      await _database.upsertBookings([booking]);
      return booking;
    } on ApiError catch (error) {
      if (error.code == 'OFFLINE') {
        return _cachedBooking(bookingId);
      }
      rethrow;
    }
  }

  /// [clientActionId] must be stable across retries of the same intent: the
  /// server returns the original booking instead of creating a second one.
  Future<BookingCreation> create({
    required String serviceId,
    required String clientActionId,
    required bool online,
    DateTime? requestedStart,
    DateTime? requestedEnd,
    int? quantity,
    String? customerNotes,
    String? locationId,
    Map<String, Object> fieldValues = const {},
  }) async {
    if (!online) {
      throw offlineMutationError('Booking a service');
    }
    final notes = customerNotes?.trim();
    final body = await _api.post(
      'bookings',
      data: {
        'serviceId': serviceId,
        'clientActionId': clientActionId,
        if (requestedStart != null) 'requestedStart': requestedStart.toUtc().toIso8601String(),
        if (requestedEnd != null) 'requestedEnd': requestedEnd.toUtc().toIso8601String(),
        if (quantity != null) 'quantity': quantity,
        if (notes != null && notes.isNotEmpty) 'customerNotes': notes,
        if (locationId != null) 'locationId': locationId,
        if (fieldValues.isNotEmpty) 'fieldValues': fieldValues,
      },
    );
    final booking = Booking.fromJson(body);
    await _database.upsertBookings([booking]);
    return BookingCreation(booking: booking, deduplicated: asBool(body['deduplicated']));
  }

  Future<Booking> confirm(
    String bookingId, {
    required bool online,
    String? message,
  }) {
    final text = message?.trim();
    return _transition(
      bookingId,
      'confirm',
      action: 'Confirming a booking',
      online: online,
      data: {if (text != null && text.isNotEmpty) 'message': text},
    );
  }

  Future<Booking> decline(
    String bookingId, {
    required bool online,
    String? reason,
  }) {
    return _transition(
      bookingId,
      'decline',
      action: 'Declining a booking',
      online: online,
      data: _reasonBody(reason),
    );
  }

  Future<Booking> start(String bookingId, {required bool online}) {
    return _transition(bookingId, 'start', action: 'Starting a booking', online: online);
  }

  Future<Booking> complete(
    String bookingId, {
    required bool online,
    String? notes,
  }) {
    final text = notes?.trim();
    return _transition(
      bookingId,
      'complete',
      action: 'Completing a booking',
      online: online,
      data: {if (text != null && text.isNotEmpty) 'notes': text},
    );
  }

  Future<Booking> cancel(
    String bookingId, {
    required bool online,
    String? reason,
  }) {
    return _transition(
      bookingId,
      'cancel',
      action: 'Cancelling a booking',
      online: online,
      data: _reasonBody(reason),
    );
  }

  /// Rescheduling closes this booking and returns its successor, which the
  /// provider still has to confirm on its own merits.
  Future<Booking> reschedule(
    String bookingId, {
    required DateTime start,
    required bool online,
    DateTime? end,
    String? reason,
  }) {
    final text = reason?.trim();
    return _transition(
      bookingId,
      'reschedule',
      action: 'Rescheduling a booking',
      online: online,
      data: {
        'start': start.toUtc().toIso8601String(),
        if (end != null) 'end': end.toUtc().toIso8601String(),
        if (text != null && text.isNotEmpty) 'reason': text,
      },
    );
  }

  Future<void> review(
    String bookingId, {
    required int rating,
    required bool online,
    String? body,
  }) async {
    if (!online) {
      throw offlineMutationError('Leaving a review');
    }
    final text = body?.trim();
    await _api.post(
      'bookings/$bookingId/review',
      data: {
        'rating': rating,
        if (text != null && text.isNotEmpty) 'body': text,
      },
    );
  }

  Future<String> conversationRoute(String bookingId, {required bool online}) async {
    if (!online) {
      throw offlineMutationError('Opening the booking conversation');
    }
    final body = await _api.get('bookings/$bookingId/conversation');
    final route = asString(body['route']);
    if (route != null) {
      return route;
    }
    final conversationId = asString(body['conversationId']);
    if (conversationId == null) {
      throw const ApiError(
        code: 'NOT_FOUND',
        message: 'This booking does not have a conversation yet.',
      );
    }
    return '/app/messages/$conversationId';
  }

  Future<Booking> _transition(
    String bookingId,
    String path, {
    required String action,
    required bool online,
    Map<String, Object?> data = const {},
  }) async {
    if (!online) {
      throw offlineMutationError(action);
    }
    final booking = Booking.fromJson(await _api.post('bookings/$bookingId/$path', data: data));
    await _database.upsertBookings([booking]);
    return booking;
  }

  Map<String, Object?> _reasonBody(String? reason) {
    final text = reason?.trim();
    return {if (text != null && text.isNotEmpty) 'reason': text};
  }

  Future<List<Booking>> _cachedBookings(String? status) {
    return _database.cachedBookings(
      viewerRole: customerViewerRole,
      status: status == null || status.isEmpty ? null : status,
    );
  }

  Future<Booking> _cachedBooking(String bookingId) async {
    final cached = await _database.cachedBookingById(bookingId);
    if (cached == null) {
      throw const ApiError(code: 'OFFLINE', message: offlineBookingMessage);
    }
    return cached;
  }
}
