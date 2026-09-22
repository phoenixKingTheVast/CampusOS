import 'package:campusos/core/permissions/permission_set.dart';
import 'package:campusos/shared/models/json_map.dart';

class StudyGroup {
  const StudyGroup({
    required this.id,
    required this.name,
    required this.status,
    required this.memberCount,
    required this.membershipStatus,
    this.description,
    this.visibility,
    this.role,
    this.actions = const [],
    this.courseCode,
    this.conversationId,
    this.enrolledInCourse = false,
    this.members = const [],
    this.route,
  });

  final String id;
  final String name;
  final String status;
  final int memberCount;
  final String membershipStatus;
  final String? description;
  final String? visibility;
  final String? role;
  final List<String> actions;
  final String? courseCode;
  final String? conversationId;
  final bool enrolledInCourse;
  final List<StudyGroupMember> members;
  final String? route;

  bool get isMember => membershipStatus == 'ACTIVE';
  bool get canJoin => actions.contains('JOIN') && !isMember;
  bool get canChat => actions.contains('CHAT') && conversationId != null;

  String get memberLabel => memberCount == 1 ? '1 member' : '$memberCount members';

  factory StudyGroup.fromJson(Map<String, dynamic> json) {
    return StudyGroup(
      id: asString(json['id']) ?? '',
      name: asString(json['name']) ?? '',
      status: asString(json['status']) ?? '',
      memberCount: asInt(json['memberCount']) ?? 0,
      membershipStatus: asString(json['membershipStatus']) ?? 'NONE',
      description: asString(json['description']),
      visibility: asString(json['visibility']),
      role: asString(json['role']),
      actions: asStringList(json['actions']),
      courseCode: asString(json['courseCode']),
      conversationId: asString(json['conversationId']),
      enrolledInCourse: asBool(json['enrolledInCourse']),
      members: asJsonMapList(json['members']).map(StudyGroupMember.fromJson).toList(),
      route: asString(json['route']) ?? '/app/learn/study-group/${asString(json['id'])}',
    );
  }
}

class StudyGroupMember {
  const StudyGroupMember({required this.id, required this.name, this.role});

  final String id;
  final String name;
  final String? role;

  factory StudyGroupMember.fromJson(Map<String, dynamic> json) {
    return StudyGroupMember(
      id: asString(json['id']) ?? '',
      name: asString(json['name']) ?? '',
      role: asString(json['role']),
    );
  }
}

class StudyGroupList {
  const StudyGroupList({required this.items, required this.permissions});

  final List<StudyGroup> items;
  final PermissionSet permissions;

  factory StudyGroupList.fromJson(Map<String, dynamic> json) {
    return StudyGroupList(
      items: asJsonMapList(json['items']).map(StudyGroup.fromJson).toList(),
      permissions: PermissionSet.fromJson(json['permissions']),
    );
  }
}
