import 'package:campusos/core/permissions/permission_set.dart';
import 'package:campusos/shared/models/json_map.dart';

class Discussion {
  const Discussion({
    required this.id,
    required this.courseOfferingId,
    required this.title,
    required this.body,
    required this.status,
    required this.pinned,
    required this.replyCount,
    this.authorName,
    this.createdAt,
    this.replies = const [],
    this.permissions,
    this.route,
  });

  final String id;
  final String courseOfferingId;
  final String title;
  final String body;
  final String status;
  final bool pinned;
  final int replyCount;
  final String? authorName;
  final DateTime? createdAt;
  final List<DiscussionReply> replies;
  final PermissionSet? permissions;
  final String? route;

  bool get closed => status == 'CLOSED';

  factory Discussion.fromJson(Map<String, dynamic> json) {
    return Discussion(
      id: asString(json['id']) ?? '',
      courseOfferingId: asString(json['courseOfferingId']) ?? '',
      title: asString(json['title']) ?? '',
      body: asString(json['body']) ?? '',
      status: asString(json['status']) ?? 'ACTIVE',
      pinned: asBool(json['pinned']),
      replyCount: asInt(json['replyCount']) ?? 0,
      authorName: asString(json['authorName']),
      createdAt: asDateTime(json['createdAt']),
      replies: asJsonMapList(json['replies']).map(DiscussionReply.fromJson).toList(),
      permissions: json['permissions'] == null ? null : PermissionSet.fromJson(json['permissions']),
      route: asString(json['route']) ?? '/app/learn/discussion/${asString(json['id'])}',
    );
  }
}

class DiscussionReply {
  const DiscussionReply({
    required this.id,
    required this.body,
    required this.authorId,
    this.authorName,
    this.createdAt,
  });

  final String id;
  final String body;
  final String authorId;
  final String? authorName;
  final DateTime? createdAt;

  factory DiscussionReply.fromJson(Map<String, dynamic> json) {
    return DiscussionReply(
      id: asString(json['id']) ?? '',
      body: asString(json['body']) ?? '',
      authorId: asString(json['authorId']) ?? '',
      authorName: asString(json['authorName']),
      createdAt: asDateTime(json['createdAt']),
    );
  }
}

class DiscussionList {
  const DiscussionList({required this.items, required this.permissions});

  final List<Discussion> items;
  final PermissionSet permissions;

  factory DiscussionList.fromJson(Map<String, dynamic> json) {
    return DiscussionList(
      items: asJsonMapList(json['items']).map(Discussion.fromJson).toList(),
      permissions: PermissionSet.fromJson(json['permissions']),
    );
  }
}
