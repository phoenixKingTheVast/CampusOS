import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/campus_service.dart';
import 'package:campusos/shared/models/json_map.dart';

/// Nothing is ever queued behind the user's back: a mutation attempted while
/// offline fails with copy that says plainly that nothing was sent.
ApiError offlineMutationError(String _) => const ApiError(
      code: 'OFFLINE',
      message:
          "You're offline. Reconnect to send your response — nothing has been sent yet.",
    );

class ServicePage {
  const ServicePage({
    required this.items,
    this.nextCursor,
    this.fromCache = false,
  });

  final List<ServiceSummary> items;
  final String? nextCursor;

  /// True when the list was read from the on-device cache instead of the API.
  final bool fromCache;
}

class ServiceReviewPage {
  const ServiceReviewPage({required this.items, this.nextCursor});

  final List<ServiceReview> items;
  final String? nextCursor;
}

class ServicesRepository {
  ServicesRepository({required ApiClient api, required AppDatabase database})
      : _api = api,
        _database = database;

  final ApiClient _api;
  final AppDatabase _database;

  static const offlineServiceMessage =
      "You're offline and this service/booking is not saved on this device.";

  Future<List<ServiceCategory>> categories({required bool online}) async {
    if (!online) {
      return _database.serviceCategories();
    }
    try {
      final body = await _api.get('service-categories');
      final items = asJsonMapList(body['items']).map(ServiceCategory.fromJson).toList();
      await _database.replaceServiceCategories(items);
      return items;
    } on ApiError catch (error) {
      if (error.code == 'OFFLINE') {
        return _database.serviceCategories();
      }
      rethrow;
    }
  }

  Future<ServicePage> services({
    required bool online,
    String? categoryKey,
    String? query,
    String? mode,
    String? cursor,
  }) async {
    final needle = query?.trim();
    if (!online) {
      return ServicePage(items: await _cachedServices(categoryKey, needle), fromCache: true);
    }
    try {
      final body = await _api.get(
        'services',
        query: {
          if (categoryKey != null && categoryKey.isNotEmpty) 'category': categoryKey,
          if (needle != null && needle.isNotEmpty) 'q': needle,
          if (mode != null && mode.isNotEmpty) 'mode': mode,
          if (cursor != null) 'cursor': cursor,
        },
      );
      final items = asJsonMapList(body['items']).map(ServiceSummary.fromJson).toList();
      await _database.upsertServices(items);
      return ServicePage(items: items, nextCursor: asString(body['nextCursor']));
    } on ApiError catch (error) {
      if (error.code == 'OFFLINE' && cursor == null) {
        return ServicePage(items: await _cachedServices(categoryKey, needle), fromCache: true);
      }
      rethrow;
    }
  }

  Future<ServiceDetail> service(String serviceId, {required bool online}) async {
    if (!online) {
      return _cachedService(serviceId);
    }
    try {
      final detail = ServiceDetail.fromJson(await _api.get('services/$serviceId'));
      await _database.upsertServices([detail.summary]);
      return detail;
    } on ApiError catch (error) {
      if (error.code == 'OFFLINE') {
        return _cachedService(serviceId);
      }
      rethrow;
    }
  }

  Future<BookingForm> bookingForm(String serviceId) async {
    return BookingForm.fromJson(await _api.get('services/$serviceId/booking-form'));
  }

  Future<List<AvailabilityDay>> availability(String serviceId, {int days = 14}) async {
    final body = await _api.get(
      'services/$serviceId/availability',
      query: {'days': days},
    );
    return asJsonMapList(body['days']).map(AvailabilityDay.fromJson).toList();
  }

  Future<ServiceReviewPage> reviews(String serviceId, {String? cursor}) async {
    final body = await _api.get(
      'services/$serviceId/reviews',
      query: {if (cursor != null) 'cursor': cursor},
    );
    return ServiceReviewPage(
      items: asJsonMapList(body['items']).map(ServiceReview.fromJson).toList(),
      nextCursor: asString(body['nextCursor']),
    );
  }

  Future<ServiceProviderDetail> providerProfile(String providerId) async {
    return ServiceProviderDetail.fromJson(await _api.get('service-providers/$providerId'));
  }

  Future<void> reportReview(
    String reviewId, {
    required String reason,
    required bool online,
    String? details,
  }) async {
    if (!online) {
      throw offlineMutationError('Reporting a review');
    }
    final note = details?.trim();
    await _api.post(
      'service-reviews/$reviewId/report',
      data: {
        'reason': reason,
        if (note != null && note.isNotEmpty) 'details': note,
      },
    );
  }

  Future<List<ServiceSummary>> _cachedServices(String? categoryKey, String? query) {
    return _database.cachedServices(
      categoryKey: categoryKey,
      query: query == null || query.isEmpty ? null : query,
    );
  }

  /// A cached service stays readable offline but is never bookable: `canBook`
  /// only becomes true once the server has re-stated the current status.
  Future<ServiceDetail> _cachedService(String serviceId) async {
    final cached = await _database.cachedServiceById(serviceId);
    if (cached == null) {
      throw const ApiError(code: 'OFFLINE', message: offlineServiceMessage);
    }
    return ServiceDetail(
      summary: cached,
      owner: false,
      canBook: false,
      bookingFields: const [],
      weeklyAvailability: const [],
      reviews: const [],
    );
  }
}
