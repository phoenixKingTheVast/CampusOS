import 'package:campusos/core/permissions/permission_set.dart';
import 'package:campusos/shared/models/json_map.dart';

class Assessment {
  const Assessment({
    required this.id,
    required this.courseOfferingId,
    required this.title,
    required this.assessmentType,
    required this.status,
    this.description,
    this.instructions,
    this.dueAt,
    this.startAt,
    this.endAt,
    this.location,
    this.weight,
    this.urgency,
    this.courseCode,
    this.courseTitle,
    this.offeringLabel,
    this.submissionMode,
    this.externalSubmissionUrl,
    this.submissionBoundary,
    this.resources = const [],
    this.route,
  });

  final String id;
  final String courseOfferingId;
  final String title;
  final String assessmentType;
  final String status;
  final String? description;
  final String? instructions;
  final DateTime? dueAt;
  final DateTime? startAt;
  final DateTime? endAt;
  final String? location;
  final double? weight;
  final String? urgency;
  final String? courseCode;
  final String? courseTitle;
  final String? offeringLabel;
  final String? submissionMode;
  final String? externalSubmissionUrl;
  final SubmissionBoundary? submissionBoundary;
  final List<AssessmentResource> resources;
  final String? route;

  bool get isExam => assessmentType == 'TEST' || assessmentType == 'EXAM';
  bool get cancelled => status == 'CANCELLED';

  String get typeLabel {
    switch (assessmentType) {
      case 'TEST':
        return 'Test';
      case 'EXAM':
        return 'Exam';
      case 'QUIZ':
        return 'Quiz';
      case 'PROJECT':
        return 'Project';
      case 'PRACTICAL':
        return 'Practical';
      case 'LABORATORY_ASSESSMENT':
        return 'Laboratory assessment';
      default:
        return 'Assignment';
    }
  }

  factory Assessment.fromJson(Map<String, dynamic> json) {
    return Assessment(
      id: asString(json['id']) ?? '',
      courseOfferingId: asString(json['courseOfferingId']) ?? '',
      title: asString(json['title']) ?? '',
      assessmentType: asString(json['assessmentType']) ?? 'ASSIGNMENT',
      status: asString(json['status']) ?? '',
      description: asString(json['description']),
      instructions: asString(json['instructions']),
      dueAt: asDateTime(json['dueAt']),
      startAt: asDateTime(json['startAt']),
      endAt: asDateTime(json['endAt']),
      location: asString(json['location']),
      weight: asDouble(json['weight']),
      urgency: asString(json['urgency']),
      courseCode: asString(json['courseCode']),
      courseTitle: asString(json['courseTitle']),
      offeringLabel: asString(json['offeringLabel']),
      submissionMode: asString(json['submissionMode']),
      externalSubmissionUrl: asString(json['externalSubmissionUrl']),
      submissionBoundary: json['submissionBoundary'] is Map
          ? SubmissionBoundary.fromJson(asJsonMap(json['submissionBoundary']))
          : null,
      resources: asJsonMapList(json['resources']).map(AssessmentResource.fromJson).toList(),
      route: asString(json['route']) ?? '/app/learn/assignment/${asString(json['id'])}',
    );
  }
}

class AssessmentResource {
  const AssessmentResource({required this.id, required this.title, this.resourceType});

  final String id;
  final String title;
  final String? resourceType;

  factory AssessmentResource.fromJson(Map<String, dynamic> json) {
    return AssessmentResource(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      resourceType: asString(json['resourceType']),
    );
  }
}

class SubmissionBoundary {
  const SubmissionBoundary({
    required this.mode,
    required this.label,
    required this.canSubmitInCampusOs,
    this.offlineMessage,
    this.leavingCampusOs,
  });

  final String mode;
  final String label;
  final bool canSubmitInCampusOs;
  final String? offlineMessage;
  final String? leavingCampusOs;

  factory SubmissionBoundary.fromJson(Map<String, dynamic> json) {
    return SubmissionBoundary(
      mode: asString(json['mode']) ?? 'NONE',
      label: asString(json['label']) ?? '',
      canSubmitInCampusOs: asBool(json['canSubmitInCampusOs']),
      offlineMessage: asString(json['offlineMessage']),
      leavingCampusOs: asString(json['leavingCampusOs']),
    );
  }
}

class AssessmentList {
  const AssessmentList({required this.items, required this.permissions});

  final List<Assessment> items;
  final PermissionSet permissions;

  factory AssessmentList.fromJson(Map<String, dynamic> json) {
    return AssessmentList(
      items: asJsonMapList(json['items']).map(Assessment.fromJson).toList(),
      permissions: PermissionSet.fromJson(json['permissions']),
    );
  }

  AssessmentList filtered({required bool exams}) {
    return AssessmentList(
      items: items.where((item) => exams ? item.isExam : !item.isExam).toList(),
      permissions: permissions,
    );
  }
}
