import 'dart:convert';

import 'package:campusos/core/permissions/permission_set.dart';
import 'package:campusos/shared/models/activity.dart';
import 'package:campusos/shared/models/json_map.dart';

class CourseOfferingDetail {
  const CourseOfferingDetail({
    required this.courseOfferingId,
    required this.courseId,
    required this.code,
    required this.title,
    required this.semester,
    required this.permissions,
    this.status,
    this.department,
    this.faculty,
    this.lecturers = const [],
    this.nextActivity,
    this.description,
    this.learningOutcomes = const [],
    this.outline = const [],
    this.references = const [],
    this.personnel = const [],
    this.nextActivities = const [],
  });

  final String courseOfferingId;
  final String courseId;
  final String code;
  final String title;
  final String semester;
  final String? status;
  final String? department;
  final String? faculty;
  final List<String> lecturers;
  final ActivityItem? nextActivity;
  final String? description;
  final List<String> learningOutcomes;
  final List<String> outline;
  final List<String> references;
  final List<CoursePerson> personnel;
  final List<ActivityItem> nextActivities;
  final PermissionSet permissions;

  String get lecturerLabel => lecturers.isEmpty ? 'Lecturer to be confirmed' : lecturers.join(', ');

  factory CourseOfferingDetail.fromJson(Map<String, dynamic> json) {
    final offering = asJsonMap(json['courseOffering'] ?? json);
    final overview = asJsonMap(json['overview']);
    final next = offering['nextActivity'] is Map ? asJsonMap(offering['nextActivity']) : null;
    return CourseOfferingDetail(
      courseOfferingId: asString(offering['courseOfferingId']) ?? '',
      courseId: asString(offering['courseId']) ?? '',
      code: asString(offering['code']) ?? '',
      title: asString(offering['title']) ?? '',
      semester: asString(offering['semester']) ?? '',
      status: asString(offering['status']),
      department: asString(offering['department']),
      faculty: asString(offering['faculty']),
      lecturers: asJsonMapList(offering['lecturers'])
          .map((item) => asString(item['name']) ?? '')
          .where((name) => name.isNotEmpty)
          .toList(),
      nextActivity: next == null ? null : ActivityItem.fromHomeJson(next),
      description: asString(overview['description']),
      learningOutcomes: asStringList(overview['learningOutcomes']),
      outline: asStringList(overview['outline']),
      references: asStringList(overview['references']),
      personnel: asJsonMapList(json['personnel']).map(CoursePerson.fromJson).toList(),
      nextActivities: asJsonMapList(json['nextActivities']).map(ActivityItem.fromHomeJson).toList(),
      permissions: PermissionSet.fromJson(json['permissions']),
    );
  }

  factory CourseOfferingDetail.fromRow(Map<String, Object?> row) {
    return CourseOfferingDetail(
      courseOfferingId: asString(row['id']) ?? '',
      courseId: asString(row['course_id']) ?? '',
      code: asString(row['code']) ?? '',
      title: asString(row['title']) ?? '',
      semester: asString(row['semester_label']) ?? '',
      status: asString(row['status']),
      department: asString(row['department']),
      faculty: asString(row['faculty']),
      lecturers: [
        if (asString(row['lecturer_name']) != null) asString(row['lecturer_name'])!,
      ],
      description: asString(row['description']),
      learningOutcomes: asStringList(row['learning_outcomes']),
      outline: asStringList(row['outline']),
      references: asStringList(row['references_json']),
      permissions: PermissionSet.fromJson(
        asString(row['permissions']) == null ? const [] : jsonDecode(asString(row['permissions'])!),
      ),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': courseOfferingId,
      'course_id': courseId,
      'semester_label': semester,
      'status': status,
      'description': description,
      'learning_outcomes': jsonEncode(learningOutcomes),
      'outline': jsonEncode(outline),
      'references_json': jsonEncode(references),
      'department': department,
      'faculty': faculty,
      'lecturer_name': lecturerLabel,
      'permissions': jsonEncode(permissions.values),
    };
  }
}

class CoursePerson {
  const CoursePerson({
    required this.id,
    required this.name,
    required this.role,
  });

  final String id;
  final String name;
  final String role;

  factory CoursePerson.fromJson(Map<String, dynamic> json) {
    return CoursePerson(
      id: asString(json['id']) ?? '',
      name: asString(json['name']) ?? '',
      role: asString(json['role']) ?? '',
    );
  }
}
