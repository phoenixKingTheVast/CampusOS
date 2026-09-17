import 'dart:convert';

import 'package:campusos/app/config/app_config.dart';
import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/synchronization/sync_engine.dart';
import 'package:campusos/features/home/domain/home_presentation.dart';
import 'package:campusos/shared/models/account_state.dart';
import 'package:campusos/shared/models/activity.dart';
import 'package:campusos/shared/models/home_snapshot.dart';
import 'package:campusos/shared/models/json_map.dart';

class HomeRepository {
  HomeRepository({
    required ApiClient api,
    required AppDatabase database,
    required SyncEngine sync,
  })  : _api = api,
        _database = database,
        _sync = sync;

  final ApiClient _api;
  final AppDatabase _database;
  final SyncEngine _sync;

  Future<HomeSnapshot> load({
    required bool online,
    String timezone = AppConfig.defaultTimezone,
  }) async {
    if (online) {
      try {
        final body = await _api.get('home', query: {'timezone': timezone});
        await _sync.persistHome(body);
        return HomeSnapshot.fromJson(body);
      } catch (_) {
        final cached = await loadCached();
        if (cached != null) {
          return cached;
        }
        rethrow;
      }
    }
    final cached = await loadCached();
    if (cached != null) {
      return cached;
    }
    return HomeSnapshot(
      generatedAt: DateTime.now(),
      timezone: timezone,
      firstTime: false,
      upNext: const [],
      today: const [],
      attention: const [],
      campus: const [],
      discover: const [],
      unreadNotificationCount: 0,
      fromCache: true,
    );
  }

  Future<HomeSnapshot?> loadCached() async {
    final generated = await _database.meta('home.generated_at');
    if (generated == null) {
      return null;
    }
    Future<List<Map<String, dynamic>>> metaList(String key) async {
      final raw = await _database.meta(key);
      if (raw == null || raw.isEmpty || raw == 'null') {
        return const [];
      }
      final decoded = jsonDecode(raw);
      return asJsonMapList(decoded);
    }

    final upNext = await metaList('home.up_next');
    final today = await metaList('home.today');
    final attention = await metaList('home.attention');
    final campus = await metaList('home.campus');
    final discover = await metaList('home.discover');
    final greeting = await _database.meta('home.greeting_name');
    final accountState = await _database.meta('home.account_state');
    final firstTime = await _database.meta('home.first_time');
    final unread = await _database.meta('home.unread_notification_count');
    final unreadMessages = await _database.meta('home.unread_message_count');
    final learnSynced = await _database.meta('learn.payload_meta');
    final authorized = learnSynced == null
        ? null
        : (await _database.enrolledOfferings()).map((item) => item.courseOfferingId).toSet();

    List<ActivityItem> activities(List<Map<String, dynamic>> rows) {
      final items = rows.map(ActivityItem.fromHomeJson).toList();
      if (authorized == null) {
        return items;
      }
      return items.where((item) => HomePresentation.keepCachedActivity(item, authorized)).toList();
    }

    List<CampusCard> cards(List<Map<String, dynamic>> rows) {
      final items = rows.map(CampusCard.fromJson).toList();
      if (authorized == null) {
        return items;
      }
      return items.where((item) => HomePresentation.keepCachedRoute(item.route, authorized)).toList();
    }

    List<AttentionItem> attentionItems(List<Map<String, dynamic>> rows) {
      final items = rows.map(AttentionItem.fromJson).toList();
      if (authorized == null) {
        return items;
      }
      return items.where((item) => HomePresentation.keepCachedRoute(item.route, authorized)).toList();
    }

    return HomeSnapshot(
      generatedAt: DateTime.tryParse(generated) ?? DateTime.now(),
      timezone: AppConfig.defaultTimezone,
      greetingName: greeting,
      accountState: AccountState.fromApi(accountState),
      firstTime: firstTime == '1',
      upNext: activities(upNext),
      today: activities(today),
      attention: attentionItems(attention),
      campus: cards(campus),
      discover: cards(discover),
      unreadNotificationCount: int.tryParse(unread ?? '0') ?? 0,
      unreadMessageCount: int.tryParse(unreadMessages ?? '0') ?? 0,
      lastUpdated: DateTime.tryParse(generated),
      fromCache: true,
    );
  }
}
