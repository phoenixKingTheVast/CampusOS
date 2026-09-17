import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/calendar_models.dart';

class CalendarRepository {
  CalendarRepository({required ApiClient api, required AppDatabase database})
      : _api = api,
        _database = database;

  final ApiClient _api;
  final AppDatabase _database;

  Future<List<CalendarActivity>> range({
    required DateTime start,
    required DateTime end,
    required bool online,
  }) async {
    if (!online) {
      return _database.activitiesInRange(start, end);
    }
    try {
      final payload = await _api.get(
        'calendar',
        query: {
          'start': start.toUtc().toIso8601String(),
          'end': end.toUtc().toIso8601String(),
          'timezone': 'Africa/Harare',
        },
      );
      final items = (payload['activities'] as List<dynamic>? ?? [])
          .whereType<Map<dynamic, dynamic>>()
          .map((item) => CalendarActivity.fromJson(Map<String, dynamic>.from(item)))
          .toList();
      for (final item in items) {
        await _database.upsertCalendarActivity(item);
      }
      await _database.setMeta('calendar_synced_at', DateTime.now().toIso8601String());
      return items;
    } on ApiError {
      return _database.activitiesInRange(start, end);
    }
  }

  Future<CalendarActivity> createPersonal(Map<String, dynamic> body) async {
    final payload = await _api.post('activities', data: body);
    final item = CalendarActivity.fromJson(payload);
    await _database.upsertCalendarActivity(item);
    return item;
  }
}

class EventRepository {
  EventRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<CampusEventDetail> get(String eventId) async {
    return CampusEventDetail.fromJson(await _api.get('events/$eventId'));
  }

  Future<CampusEventDetail> respond(String eventId, String response) async {
    await _api.post('events/$eventId/responses', data: {'response': response});
    return get(eventId);
  }
}
