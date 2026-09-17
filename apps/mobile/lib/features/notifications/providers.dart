import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/notifications/data/notifications_repository.dart';
import 'package:campusos/shared/models/notification.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The selected index into [NotificationFilter.all]. It lives outside the
/// centre controller so the controller can reload whenever it changes.
final notificationFilterProvider =
    NotifierProvider<NotificationFilterNotifier, int>(NotificationFilterNotifier.new);

class NotificationFilterNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void select(int index) {
    if (index >= 0 && index < NotificationFilter.all.length) {
      state = index;
    }
  }
}

class NotificationCentreState {
  const NotificationCentreState({
    required this.items,
    required this.unreadCount,
    this.nextCursor,
    this.fromCache = false,
    this.syncedAt,
    this.loadingMore = false,
    this.loadMoreFailed = false,
  });

  final List<CampusNotification> items;
  final int unreadCount;
  final String? nextCursor;
  final bool fromCache;
  final DateTime? syncedAt;
  final bool loadingMore;
  final bool loadMoreFailed;

  bool get hasMore => nextCursor != null;

  /// Keeps the cursor and the sync stamp: everything that changes them builds a
  /// whole new state instead.
  NotificationCentreState copyWith({
    List<CampusNotification>? items,
    int? unreadCount,
    bool? loadingMore,
    bool? loadMoreFailed,
  }) {
    return NotificationCentreState(
      items: items ?? this.items,
      unreadCount: unreadCount ?? this.unreadCount,
      nextCursor: nextCursor,
      fromCache: fromCache,
      syncedAt: syncedAt,
      loadingMore: loadingMore ?? this.loadingMore,
      loadMoreFailed: loadMoreFailed ?? this.loadMoreFailed,
    );
  }
}

final notificationCentreProvider =
    AsyncNotifierProvider<NotificationCentreController, NotificationCentreState>(
  NotificationCentreController.new,
);

class NotificationCentreController extends AsyncNotifier<NotificationCentreState> {
  @override
  Future<NotificationCentreState> build() {
    final filter = NotificationFilter.all[ref.watch(notificationFilterProvider)];
    return _load(filter, online: ref.watch(connectivityProvider).isOnline);
  }

  Future<void> refresh() async {
    final previous = state.asData?.value;
    try {
      state = AsyncData(await _load(_filter, online: true));
    } catch (error, stack) {
      if (previous != null) {
        state = AsyncData(previous);
        return;
      }
      state = AsyncError(error, stack);
    }
  }

  Future<void> loadMore() async {
    final current = state.asData?.value;
    if (current == null || current.loadingMore || !current.hasMore) {
      return;
    }
    state = AsyncData(current.copyWith(loadingMore: true, loadMoreFailed: false));
    final filter = _filter;
    try {
      final NotificationPage page = await ref.read(notificationsRepositoryProvider).list(
            category: filter.category,
            unreadOnly: filter.unreadOnly,
            cursor: current.nextCursor,
            online: true,
          );
      state = AsyncData(
        NotificationCentreState(
          items: [...current.items, ...page.items],
          unreadCount: current.unreadCount,
          nextCursor: page.nextCursor,
          fromCache: current.fromCache,
          syncedAt: page.syncedAt ?? current.syncedAt,
        ),
      );
    } on ApiError {
      state = AsyncData(current.copyWith(loadingMore: false, loadMoreFailed: true));
    }
  }

  /// Returns false when the read landed on this device only.
  Future<bool> markRead(String id) async {
    final current = state.asData?.value;
    if (current != null) {
      state = AsyncData(_read(current, id));
    }
    return ref.read(notificationsRepositoryProvider).markRead(id);
  }

  Future<bool> markAllRead() async {
    final current = state.asData?.value;
    if (current != null) {
      state = AsyncData(
        current.copyWith(
          items: [
            for (final item in current.items) item.read ? item : item.copyWith(read: true),
          ],
          unreadCount: 0,
        ),
      );
    }
    return ref.read(notificationsRepositoryProvider).markAllRead();
  }

  /// Marks the notification read and resolves its deep link. Throws [ApiError]
  /// carrying the server's message when the content is no longer available.
  Future<String?> open(String id) async {
    final current = state.asData?.value;
    if (current != null) {
      state = AsyncData(_read(current, id));
    }
    return ref.read(notificationsRepositoryProvider).open(id);
  }

  NotificationFilter get _filter => NotificationFilter.all[ref.read(notificationFilterProvider)];

  Future<NotificationCentreState> _load(
    NotificationFilter filter, {
    required bool online,
  }) async {
    final repository = ref.read(notificationsRepositoryProvider);
    final page = await repository.list(
      category: filter.category,
      unreadOnly: filter.unreadOnly,
      online: online,
    );
    return NotificationCentreState(
      items: page.items,
      unreadCount: await repository.unreadCount(online: online && !page.fromCache),
      nextCursor: page.nextCursor,
      fromCache: page.fromCache,
      syncedAt: page.syncedAt,
    );
  }

  /// A row the reader just opened stays in place even under the Unread filter;
  /// it disappears on the next reload rather than under their finger.
  NotificationCentreState _read(NotificationCentreState current, String id) {
    var wasUnread = false;
    final items = <CampusNotification>[];
    for (final item in current.items) {
      if (item.id == id && !item.read) {
        wasUnread = true;
        items.add(item.copyWith(read: true));
      } else {
        items.add(item);
      }
    }
    final unread = wasUnread && current.unreadCount > 0
        ? current.unreadCount - 1
        : current.unreadCount;
    return current.copyWith(items: items, unreadCount: unread);
  }
}

final notificationPreferencesProvider =
    AsyncNotifierProvider<NotificationPreferencesController, NotificationPreferences>(
  NotificationPreferencesController.new,
);

class NotificationPreferencesController extends AsyncNotifier<NotificationPreferences> {
  @override
  Future<NotificationPreferences> build() {
    return ref.read(notificationsRepositoryProvider).preferences();
  }

  Future<void> setToggle(String key, bool value) {
    final current = state.asData?.value;
    if (current == null) {
      return Future<void>.value();
    }
    return _patch(
      current,
      optimistic: NotificationPreferences(
        values: {...current.values, key: value},
        quietHoursStart: current.quietHoursStart,
        quietHoursEnd: current.quietHoursEnd,
      ),
      changes: {key: value},
    );
  }

  /// A null start or end clears that side of the window; the server only
  /// suppresses pushes once both are set.
  Future<void> setQuietHours({required String? start, required String? end}) {
    final current = state.asData?.value;
    if (current == null) {
      return Future<void>.value();
    }
    return _patch(
      current,
      optimistic: NotificationPreferences(
        values: current.values,
        quietHoursStart: start,
        quietHoursEnd: end,
      ),
      changes: {'quietHoursStart': start, 'quietHoursEnd': end},
    );
  }

  Future<void> _patch(
    NotificationPreferences previous, {
    required NotificationPreferences optimistic,
    required Map<String, Object?> changes,
  }) async {
    state = AsyncData(optimistic);
    try {
      state = AsyncData(
        await ref.read(notificationsRepositoryProvider).updatePreferences(changes),
      );
    } catch (_) {
      state = AsyncData(previous);
      rethrow;
    }
  }
}
