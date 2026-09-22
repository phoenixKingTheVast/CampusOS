import 'package:campusos/core/permissions/permission_set.dart';
import 'package:campusos/shared/models/json_map.dart';

class CoursePeople {
  const CoursePeople({
    required this.teachingTeam,
    required this.students,
    required this.permissions,
  });

  final List<CoursePerson> teachingTeam;
  final List<CoursePerson> students;
  final PermissionSet permissions;

  factory CoursePeople.fromJson(Map<String, dynamic> json) {
    return CoursePeople(
      teachingTeam: asJsonMapList(json['teachingTeam']).map(CoursePerson.fromJson).toList(),
      students: asJsonMapList(json['students']).map(CoursePerson.fromJson).toList(),
      permissions: PermissionSet.fromJson(json['permissions']),
    );
  }
}

class CoursePerson {
  const CoursePerson({
    required this.id,
    required this.name,
    required this.role,
    this.route,
  });

  final String id;
  final String name;
  final String role;
  final String? route;

  String get roleLabel => role.replaceAll('_', ' ').toLowerCase();

  factory CoursePerson.fromJson(Map<String, dynamic> json) {
    return CoursePerson(
      id: asString(json['id']) ?? '',
      name: asString(json['name']) ?? '',
      role: asString(json['role']) ?? '',
      route: asString(json['route']),
    );
  }
}
