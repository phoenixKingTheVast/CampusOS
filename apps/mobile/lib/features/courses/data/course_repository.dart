import 'dart:convert';

import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/permissions/permission_set.dart';
import 'package:campusos/core/synchronization/sync_engine.dart';
import 'package:campusos/shared/models/announcement.dart';
import 'package:campusos/shared/models/course_offering.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/learn_snapshot.dart';
import 'package:campusos/shared/models/resource.dart';

class CourseRepository {
  CourseRepository({
    required ApiClient api,
    required AppDatabase database,
    required SyncEngine sync,
  })  : _api = api,
        _database = database,
        _sync = sync;

  final ApiClient _api;
  final AppDatabase _database;
  final SyncEngine _sync;

  Future<CourseOfferingDetail> getOffering(String courseOfferingId, {required bool online}) async {
    if (online) {
      try {
        final body = await _api.get('course-offerings/$courseOfferingId');
        final detail = CourseOfferingDetail.fromJson(body);
        await _database.upsertOffering(detail);
        return detail;
      } catch (_) {
        final cached = await _database.offeringById(courseOfferingId);
        if (cached != null) {
          return cached;
        }
        rethrow;
      }
    }
    final cached = await _database.offeringById(courseOfferingId);
    if (cached != null) {
      return cached;
    }
    final rows = await _database.enrolledOfferings();
    CourseOfferingSummary? summary;
    for (final item in rows) {
      if (item.courseOfferingId == courseOfferingId) {
        summary = item;
        break;
      }
    }
    return CourseOfferingDetail(
      courseOfferingId: courseOfferingId,
      courseId: summary?.courseId ?? '',
      code: summary?.code ?? '',
      title: summary?.title ?? '',
      semester: summary?.semester ?? '',
      status: summary?.status,
      lecturers: [
        if (summary?.lecturer != null) summary!.lecturer!,
      ],
      permissions: PermissionSet.none(),
    );
  }

  Future<Announcement> getAnnouncement(String announcementId) async {
    try {
      final body = await _api.get('announcements/$announcementId');
      final item = Announcement.fromJson(body);
      await _database.upsertAnnouncement(item);
      await markAnnouncementRead(announcementId);
      return item;
    } catch (_) {
      final cached = await _database.announcementById(announcementId);
      if (cached != null) {
        return cached;
      }
      rethrow;
    }
  }

  Future<void> markAnnouncementRead(String announcementId) async {
    try {
      await _api.post('announcements/$announcementId/read');
    } catch (_) {
      await _sync.enqueue('POST', 'announcements/$announcementId/read');
    }
  }

  Future<AnnouncementList> announcements(String courseOfferingId, {required bool online}) async {
    if (online) {
      final body = await _api.get('course-offerings/$courseOfferingId/announcements');
      final list = AnnouncementList.fromJson(body);
      await _sync.persistAnnouncements(courseOfferingId, list);
      return list;
    }
    final items = await _database.announcementsForOffering(courseOfferingId);
    final permissionsRaw = await _database.meta('announcements.permissions.$courseOfferingId');
    return AnnouncementList(
      items: items,
      permissions: permissionsRaw == null
          ? PermissionSet.none()
          : PermissionSet.fromJson(jsonDecode(permissionsRaw)),
    );
  }

  Future<Announcement> createAnnouncement({
    required String courseOfferingId,
    required String title,
    required String body,
    String priority = 'NORMAL',
  }) async {
    final response = await _api.post(
      'course-offerings/$courseOfferingId/announcements',
      data: {'title': title, 'body': body, 'priority': priority},
    );
    final item = Announcement.fromJson(response);
    await _database.upsertAnnouncement(item);
    return item;
  }

  Future<ResourceList> resources(
    String courseOfferingId, {
    required bool online,
    String? query,
  }) async {
    if (online) {
      final body = await _api.get(
        'course-offerings/$courseOfferingId/resources',
        query: query == null || query.isEmpty ? null : {'q': query},
      );
      final list = ResourceList.fromJson(body);
      await _sync.persistResources(courseOfferingId, list);
      return list;
    }
    var items = await _database.resourcesForOffering(courseOfferingId);
    if (query != null && query.trim().isNotEmpty) {
      final needle = query.trim().toLowerCase();
      items = items
          .where(
            (item) =>
                item.title.toLowerCase().contains(needle) ||
                (item.description ?? '').toLowerCase().contains(needle) ||
                item.resourceType.toLowerCase().contains(needle),
          )
          .toList();
    }
    final permissionsRaw = await _database.meta('resources.permissions.$courseOfferingId');
    return ResourceList(
      currentOfferingId: courseOfferingId,
      items: items
          .map((item) => item.copyWith(historical: item.courseOfferingId != courseOfferingId))
          .toList(),
      permissions: permissionsRaw == null
          ? PermissionSet.none()
          : PermissionSet.fromJson(jsonDecode(permissionsRaw)),
    );
  }
}
