import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/notification.dart';

/// One page of the notification centre. `fromCache` is what the offline banner
/// reflects, so it is only ever true when the rows came from the database.
class NotificationPage {
  const NotificationPage({
    required this.items,
    this.nextCursor,
    this.fromCache = false,
    this.syncedAt,
  });

  final List<CampusNotification> items;
  final String? nextCursor;
  final bool fromCache;
  final DateTime? syncedAt;

  bool get hasMore => nextCursor != null;
}

class NotificationsRepository {
  NotificationsRepository({
    required ApiClient api,
    required AppDatabase database,
  })  : _api = api,
        _database = database;

  final ApiClient _api;
  final AppDatabase _database;

  static const _syncedAtKey = 'notifications_synced_at';

  Future<NotificationPage> list({
    String? category,
    bool unreadOnly = false,
    String? cursor,
    required bool online,
  }) async {
    if (!online) {
      return _cachedPage(category: category, unreadOnly: unreadOnly);
    }
    try {
      final body = await _api.get(
        'notifications',
        query: {
          if (category != null) 'category': category,
          if (unreadOnly) 'unread': 'true',
          if (cursor != null) 'cursor': cursor,
        },
      );
      final items = asJsonMapList(body['items']).map(CampusNotification.fromJson).toList();
      for (final item in items) {
        await _database.upsertNotification(item);
      }
      final syncedAt = DateTime.now();
      await _database.setMeta(_syncedAtKey, syncedAt.toIso8601String());
      return NotificationPage(
        items: items,
        nextCursor: asString(body['nextCursor']),
        syncedAt: syncedAt,
      );
    } on ApiError {
      // The cache cannot continue a server cursor, so only the first page falls
      // back to it; a failed later page is reported to the caller.
      if (cursor != null) {
        rethrow;
      }
      return _cachedPage(category: category, unreadOnly: unreadOnly);
    }
  }

  Future<int> unreadCount({required bool online}) async {
    if (!online) {
      return _database.unreadNotificationCount();
    }
    try {
      final body = await _api.get('notifications/unread-count');
      return asInt(body['count']) ?? 0;
    } on ApiError {
      return _database.unreadNotificationCount();
    }
  }

  /// Returns false when the read landed in the cache only, so callers never
  /// claim the server was updated.
  Future<bool> markRead(String id) async {
    await _database.markNotificationRead(id);
    try {
      await _api.post('notifications/$id/read');
      return true;
    } on ApiError {
      return false;
    }
  }

  Future<bool> markAllRead() async {
    await _database.markAllNotificationsRead();
    try {
      await _api.post('notifications/read-all');
      return true;
    } on ApiError {
      return false;
    }
  }

  /// Resolves the deep link at open time, because access can be revoked after
  /// the notification was delivered. The server marks the notification read
  /// before it re-checks access, so the cache is updated even when this throws.
  Future<String?> open(String id) async {
    await _database.markNotificationRead(id);
    final body = await _api.get('notifications/$id/open');
    return asString(body['route']);
  }

  Future<NotificationPreferences> preferences() async {
    return NotificationPreferences.fromJson(await _api.get('notification-preferences'));
  }

  /// [changes] uses the flat field names in [NotificationPreferences.values];
  /// a null quiet-hours value clears it.
  Future<NotificationPreferences> updatePreferences(Map<String, Object?> changes) async {
    return NotificationPreferences.fromJson(
      await _api.patch('notification-preferences', data: changes),
    );
  }

  Future<NotificationPage> _cachedPage({
    String? category,
    bool unreadOnly = false,
  }) async {
    final items = await _database.notifications(
      category: category,
      unreadOnly: unreadOnly,
    );
    return NotificationPage(
      items: items,
      fromCache: true,
      syncedAt: asDateTime(await _database.meta(_syncedAtKey)),
    );
  }
}
