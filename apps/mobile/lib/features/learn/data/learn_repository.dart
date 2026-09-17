import 'dart:convert';

import 'package:campusos/app/config/app_config.dart';
import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/synchronization/sync_engine.dart';
import 'package:campusos/features/home/domain/home_presentation.dart';
import 'package:campusos/shared/models/activity.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/learn_snapshot.dart';

class LearnRepository {
  LearnRepository({
    required ApiClient api,
    required AppDatabase database,
    required SyncEngine sync,
  })  : _api = api,
        _database = database,
        _sync = sync;

  final ApiClient _api;
  final AppDatabase _database;
  final SyncEngine _sync;

  Future<LearnSnapshot> load({required bool online}) async {
    if (online) {
      try {
        final body = await _api.get('learn', query: {'timezone': AppConfig.defaultTimezone});
        await _sync.persistLearn(body);
        return LearnSnapshot.fromJson(body, lastUpdated: DateTime.now());
      } catch (_) {
        return loadCached();
      }
    }
    return loadCached();
  }

  Future<LearnSnapshot> loadCached() async {
    final courses = await _database.enrolledOfferings();
    Future<List<Map<String, dynamic>>> metaList(String key) async {
      final raw = await _database.meta(key);
      if (raw == null || raw.isEmpty || raw == 'null') {
        return const [];
      }
      return asJsonMapList(jsonDecode(raw));
    }

    final current = await metaList('learn.current');
    final upcoming = await metaList('learn.upcoming');
    final attention = await metaList('learn.attention');
    final groups = await metaList('learn.study_groups');
    final classRaw = await _database.meta('learn.primary_class');
    final last = await _database.meta('learn.payload_meta');
    final authorized = courses.map((item) => item.courseOfferingId).toSet();
    PrimaryClassSummary? primary;
    if (classRaw != null && classRaw.isNotEmpty && classRaw != 'null') {
      primary = PrimaryClassSummary.fromJson(asJsonMap(jsonDecode(classRaw)));
    }
    return LearnSnapshot(
      currentActivities: current
          .map(ActivityItem.fromHomeJson)
          .where((item) => HomePresentation.keepCachedActivity(item, authorized))
          .toList(),
      upcomingActivities: upcoming
          .map(ActivityItem.fromHomeJson)
          .where((item) => HomePresentation.keepCachedActivity(item, authorized))
          .toList(),
      attentionItems: attention
          .map(AttentionItem.fromJson)
          .where((item) => HomePresentation.keepCachedRoute(item.route, authorized))
          .toList(),
      courses: courses,
      primaryClass: primary,
      studyGroups: groups.map(StudyGroupSummary.fromJson).toList(),
      fromCache: true,
      lastUpdated: last == null ? null : DateTime.tryParse(last),
    );
  }
}
