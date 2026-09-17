import 'dart:convert';

import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/search_result.dart';

class SearchRepository {
  SearchRepository({
    required ApiClient api,
    required AppDatabase database,
  })  : _api = api,
        _database = database;

  final ApiClient _api;
  final AppDatabase _database;

  Future<List<String>> recent() async {
    try {
      final body = await _api.get('search/recent');
      final items = asJsonMapList(body['items'])
          .map((item) => asString(item['query']) ?? '')
          .where((item) => item.isNotEmpty)
          .toList();
      await _database.setMeta('search.recent', jsonEncode(items));
      return items;
    } catch (_) {
      return _localRecent();
    }
  }

  Future<List<SearchHit>> search({
    required String query,
    required String type,
    required bool online,
  }) async {
    final trimmed = query.trim();
    if (trimmed.length < 2) {
      return const [];
    }
    await _remember(trimmed);
    if (!online) {
      return _offlineSearch(trimmed, type);
    }
    try {
      final body = await _api.get('search', query: {'q': trimmed, 'type': type});
      return asJsonMapList(body['items']).map(SearchHit.fromJson).toList();
    } on ApiError {
      return _offlineSearch(trimmed, type);
    }
  }

  Future<void> _remember(String query) async {
    final existing = await _localRecent();
    final next = [query, ...existing.where((item) => item != query)].take(8).toList();
    await _database.setMeta('search.recent', jsonEncode(next));
  }

  Future<List<String>> _localRecent() async {
    final raw = await _database.meta('search.recent');
    if (raw == null || raw.isEmpty) {
      return const [];
    }
    final decoded = jsonDecode(raw);
    if (decoded is List) {
      return decoded.map((item) => '$item').toList();
    }
    return const [];
  }

  Future<List<SearchHit>> _offlineSearch(String query, String type) async {
    final hits = <SearchHit>[];
    if (type == 'all' || type == 'people') {
      final people = await _database.searchPeople(query);
      hits.addAll(
        people.map(
          (person) => SearchHit(
            id: person.id,
            objectType: 'PERSON',
            title: person.displayName ?? person.username ?? 'Student',
            subtitle: person.bio,
            route: '/app/profile',
          ),
        ),
      );
    }
    if (type == 'all' || type == 'courses') {
      final courses = await _database.enrolledOfferings();
      hits.addAll(
        courses
            .where(
              (course) =>
                  course.code.toLowerCase().contains(query.toLowerCase()) ||
                  course.title.toLowerCase().contains(query.toLowerCase()),
            )
            .map(
              (course) => SearchHit(
                id: course.courseOfferingId,
                objectType: 'COURSE',
                title: '${course.code} ${course.title}',
                subtitle: course.semester,
                route: '/app/learn/course/${course.courseOfferingId}',
              ),
            ),
      );
    }
    if (type == 'all' || type == 'classes') {
      final classes = await _database.searchClasses(query);
      hits.addAll(
        classes.map(
          (item) => SearchHit(
            id: item.id,
            objectType: 'CLASS',
            title: item.code,
            subtitle: item.name,
            route: '/app/learn',
          ),
        ),
      );
    }
    if (type == 'all' || type == 'resources') {
      final resources = await _database.searchResources(query);
      hits.addAll(
        resources.map(
          (item) => SearchHit(
            id: item.id,
            objectType: 'RESOURCE',
            title: item.title,
            subtitle: '${item.courseCode ?? ''} · ${item.offeringLabel ?? ''}'.trim(),
            route: '/app/learn/resource/${item.id}',
            historical: item.historical,
          ),
        ),
      );
    }
    return hits;
  }
}
