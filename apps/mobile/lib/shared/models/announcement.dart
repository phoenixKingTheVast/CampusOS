import 'package:campusos/core/permissions/permission_set.dart';
import 'package:campusos/shared/models/json_map.dart';

class Announcement {
  const Announcement({
    required this.id,
    required this.courseOfferingId,
    required this.title,
    required this.body,
    required this.priority,
    required this.status,
    this.authorId,
    this.authorName,
    this.publishedAt,
    this.expiresAt,
    this.createdAt,
    this.updatedAt,
    this.isRead = false,
  });

  final String id;
  final String courseOfferingId;
  final String title;
  final String body;
  final String priority;
  final String status;
  final String? authorId;
  final String? authorName;
  final DateTime? publishedAt;
  final DateTime? expiresAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final bool isRead;

  bool get isImportant => priority == 'IMPORTANT';
  bool get isUrgent => priority == 'URGENT';
  String? get priorityLabel {
    if (isUrgent) {
      return 'URGENT';
    }
    if (isImportant) {
      return 'IMPORTANT';
    }
    return null;
  }

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: asString(json['id']) ?? '',
      courseOfferingId: asString(json['courseOfferingId']) ?? '',
      title: asString(json['title']) ?? '',
      body: asString(json['body']) ?? '',
      priority: asString(json['priority']) ?? 'NORMAL',
      status: asString(json['status']) ?? 'PUBLISHED',
      authorId: asString(json['authorId']),
      authorName: asString(json['authorName']),
      publishedAt: asDateTime(json['publishedAt']),
      expiresAt: asDateTime(json['expiresAt']),
      createdAt: asDateTime(json['createdAt']),
      updatedAt: asDateTime(json['updatedAt']),
      isRead: asBool(json['isRead']),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'course_offering_id': courseOfferingId,
      'author_id': authorId,
      'author_name': authorName,
      'title': title,
      'body': body,
      'priority': priority,
      'status': status,
      'published_at': publishedAt?.toIso8601String(),
      'expires_at': expiresAt?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'is_read': isRead ? 1 : 0,
    };
  }

  factory Announcement.fromRow(Map<String, Object?> row) {
    return Announcement(
      id: asString(row['id']) ?? '',
      courseOfferingId: asString(row['course_offering_id']) ?? '',
      title: asString(row['title']) ?? '',
      body: asString(row['body']) ?? '',
      priority: asString(row['priority']) ?? 'NORMAL',
      status: asString(row['status']) ?? 'PUBLISHED',
      authorId: asString(row['author_id']),
      authorName: asString(row['author_name']),
      publishedAt: asDateTime(row['published_at']),
      expiresAt: asDateTime(row['expires_at']),
      createdAt: asDateTime(row['created_at']),
      updatedAt: asDateTime(row['updated_at']),
      isRead: asBool(row['is_read']),
    );
  }
}

class AnnouncementList {
  const AnnouncementList({
    required this.items,
    required this.permissions,
  });

  final List<Announcement> items;
  final PermissionSet permissions;

  factory AnnouncementList.fromJson(Map<String, dynamic> json) {
    return AnnouncementList(
      items: asJsonMapList(json['items']).map(Announcement.fromJson).toList(),
      permissions: PermissionSet.fromJson(json['permissions']),
    );
  }
}
