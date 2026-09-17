import 'dart:convert';

import 'package:campusos/core/authentication/session_manager.dart';
import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/logging/app_logger.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/announcement.dart';
import 'package:campusos/shared/models/conversation.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/learn_snapshot.dart';
import 'package:campusos/shared/models/person.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:campusos/shared/models/notification.dart';
import 'package:uuid/uuid.dart';

class SyncEngine {
  SyncEngine({
    required ApiClient api,
    required AppDatabase database,
    required SessionManager session,
    AppLogger logger = const AppLogger(),
  })  : _api = api,
        _database = database,
        _session = session,
        _logger = logger;

  final ApiClient _api;
  final AppDatabase _database;
  final SessionManager _session;
  final AppLogger _logger;

  Future<void> startupSync() async {
    await Future.wait([
      _syncMe(),
      _syncHome(),
      _syncLearn(),
      _syncNotifications(),
      _syncConversations(),
    ]);
    await flushPending();
    await _database.setMeta('last_synced_at', DateTime.now().toIso8601String());
  }

  Future<void> _syncMe() async {
    final body = await _api.get('people/me');
    final person = Person.fromJson(body);
    _session.person = person;
    await _database.upsertPerson(person);
    await _database.setMeta('account_state', asString(body['accountState']) ?? '');
  }

  Future<void> _syncHome() async {
    final body = await _api.get(
      'home',
      query: const {'timezone': 'Africa/Harare'},
    );
    await persistHome(body);
  }

  Future<void> persistHome(Map<String, dynamic> body) async {
    final generatedAt = asString(body['generatedAt']) ?? DateTime.now().toIso8601String();
    await _database.setMeta('home.generated_at', generatedAt);
    await _database.setMeta('home.greeting_name', asString(body['greetingName']) ?? '');
    await _database.setMeta('home.account_state', asString(body['accountState']) ?? '');
    await _database.setMeta('home.first_time', asBool(body['firstTime']) ? '1' : '0');
    await _database.setMeta(
      'home.unread_notification_count',
      '${asInt(body['unreadNotificationCount']) ?? 0}',
    );
    await _database.setMeta(
      'home.unread_message_count',
      '${asInt(body['unreadMessageCount']) ?? 0}',
    );
    await _database.setMeta('home.campus', jsonEncode(body['campus'] ?? []));
    await _database.setMeta('home.discover', jsonEncode(body['discover'] ?? []));
    await _database.setMeta('home.attention', jsonEncode(body['attention'] ?? []));
    await _database.setMeta('home.up_next', jsonEncode(body['upNext'] ?? []));
    await _database.setMeta('home.today', jsonEncode(body['today'] ?? []));
    for (final item in asJsonMapList(body['upNext'])) {
      final activityId = asString(item['activityId']) ?? asString(item['id']);
      if (activityId == null) {
        continue;
      }
      await _database.upsert('activities', {
        'id': activityId,
        'type': asString(item['type']),
        'title': asString(item['title']),
        'start_time': asString(item['startTime']),
        'end_time': asString(item['endTime']),
        'location': asString(item['location']),
        'status': asString(item['status']),
        'route': asString(item['route']),
        'source': asString(item['source']),
        'relative': asString(item['relative']),
        'course_offering_id': asString(item['courseOfferingId']),
      });
    }
    for (final item in asJsonMapList(body['today'])) {
      final activityId = asString(item['activityId']) ?? asString(item['id']);
      if (activityId == null) {
        continue;
      }
      await _database.upsert('activities', {
        'id': activityId,
        'type': asString(item['type']),
        'title': asString(item['title']),
        'start_time': asString(item['startTime']),
        'end_time': asString(item['endTime']),
        'location': asString(item['location']),
        'status': asString(item['status']),
        'route': asString(item['route']),
        'source': asString(item['source']),
        'relative': asString(item['relative']),
        'course_offering_id': asString(item['courseOfferingId']),
      });
    }
  }

  Future<void> persistLearn(Map<String, dynamic> body) async {
    await _database.replaceEnrollments(
      asJsonMapList(body['courses']).map(CourseOfferingSummary.fromJson).toList(),
    );
    await _database.setMeta('learn.payload_meta', DateTime.now().toIso8601String());
    await _database.setMeta('learn.attention', jsonEncode(body['attentionItems'] ?? []));
    await _database.setMeta('learn.current', jsonEncode(body['currentActivities'] ?? []));
    await _database.setMeta('learn.upcoming', jsonEncode(body['upcomingActivities'] ?? []));
    await _database.setMeta('learn.study_groups', jsonEncode(body['studyGroups'] ?? []));
    await _database.setMeta('learn.primary_class', jsonEncode(body['primaryClass']));
  }

  Future<void> persistAnnouncements(String courseOfferingId, AnnouncementList list) async {
    await _database.setMeta(
      'announcements.permissions.$courseOfferingId',
      jsonEncode(list.permissions.values),
    );
    for (final item in list.items) {
      await _database.upsertAnnouncement(item);
    }
  }

  Future<void> persistResources(String courseOfferingId, ResourceList list) async {
    await _database.setMeta(
      'resources.permissions.$courseOfferingId',
      jsonEncode(list.permissions.values),
    );
    for (final item in list.items) {
      await _database.upsertResource(item);
    }
  }

  Future<void> _syncLearn() async {
    final body = await _api.get('learn');
    await persistLearn(body);
  }

  Future<void> _syncNotifications() async {
    final body = await _api.get('notifications');
    for (final item in asJsonMapList(body['items'])) {
      await _database.upsertNotification(CampusNotification.fromJson(item));
    }
  }

  /// Caches the inbox so the messages tab is readable offline on a cold start.
  /// Message bodies are only cached once a conversation is opened.
  Future<void> _syncConversations() async {
    final body = await _api.get('conversations');
    await _database.replaceConversations(
      asJsonMapList(body['items']).map(ConversationSummary.fromJson).toList(),
    );
    await _database.setMeta('messaging_synced_at', DateTime.now().toIso8601String());
  }

  Future<void> flushPending() async {
    final actions = await _database.pendingActions();
    for (final action in actions) {
      final id = asString(action['id']);
      final method = asString(action['method']);
      final path = asString(action['path']);
      if (id == null || method == null || path == null) {
        continue;
      }
      try {
        final body = action['body_json'] == null ? null : jsonDecode('${action['body_json']}');
        if (method == 'POST') {
          await _api.post(path, data: body);
        } else if (method == 'PATCH') {
          await _api.patch(path, data: body);
        }
        await _database.deletePending(id);
      } on ApiError catch (error) {
        _logger.error('pending action failed', error);
        if (!error.isUnauthenticated) {
          continue;
        }
        rethrow;
      }
    }
  }

  Future<void> enqueue(String method, String path, [Object? body]) {
    return _database.enqueueAction(
      id: const Uuid().v4(),
      method: method,
      path: path,
      bodyJson: body == null ? null : jsonEncode(body),
    );
  }
}
