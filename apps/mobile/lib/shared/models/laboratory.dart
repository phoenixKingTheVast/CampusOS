import 'package:campusos/core/permissions/permission_set.dart';
import 'package:campusos/shared/models/json_map.dart';

class Laboratory {
  const Laboratory({
    required this.id,
    required this.courseOfferingId,
    required this.title,
    required this.status,
    this.description,
    this.objective,
    this.location,
    this.startAt,
    this.endAt,
    this.instructions,
    this.courseCode,
    this.assessmentId,
    this.safety,
    this.resources = const [],
    this.route,
  });

  final String id;
  final String courseOfferingId;
  final String title;
  final String status;
  final String? description;
  final String? objective;
  final String? location;
  final DateTime? startAt;
  final DateTime? endAt;
  final String? instructions;
  final String? courseCode;
  final String? assessmentId;
  final LaboratorySafety? safety;
  final List<LaboratoryResource> resources;
  final String? route;

  factory Laboratory.fromJson(Map<String, dynamic> json) {
    return Laboratory(
      id: asString(json['id']) ?? '',
      courseOfferingId: asString(json['courseOfferingId']) ?? '',
      title: asString(json['title']) ?? '',
      status: asString(json['status']) ?? '',
      description: asString(json['description']),
      objective: asString(json['objective']),
      location: asString(json['location']),
      startAt: asDateTime(json['startAt']),
      endAt: asDateTime(json['endAt']),
      instructions: asString(json['instructions']),
      courseCode: asString(json['courseCode']),
      assessmentId: asString(json['assessmentId']),
      safety: json['safety'] is Map ? LaboratorySafety.fromJson(asJsonMap(json['safety'])) : null,
      resources: asJsonMapList(json['resources']).map(LaboratoryResource.fromJson).toList(),
      route: asString(json['route']) ?? '/app/learn/laboratory/${asString(json['id'])}',
    );
  }
}

class LaboratorySafety {
  const LaboratorySafety({this.level, this.instructions, this.requiredPpe = const [], this.hazards = const []});

  final String? level;
  final String? instructions;
  final List<String> requiredPpe;
  final List<String> hazards;

  factory LaboratorySafety.fromJson(Map<String, dynamic> json) {
    return LaboratorySafety(
      level: asString(json['level']),
      instructions: asString(json['instructions']),
      requiredPpe: asStringList(json['requiredPpe']),
      hazards: asStringList(json['hazards']),
    );
  }
}

class LaboratoryResource {
  const LaboratoryResource({required this.id, required this.title, this.resourceType});

  final String id;
  final String title;
  final String? resourceType;

  factory LaboratoryResource.fromJson(Map<String, dynamic> json) {
    return LaboratoryResource(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      resourceType: asString(json['resourceType']),
    );
  }
}

class LaboratoryList {
  const LaboratoryList({required this.items, required this.permissions});

  final List<Laboratory> items;
  final PermissionSet permissions;

  factory LaboratoryList.fromJson(Map<String, dynamic> json) {
    return LaboratoryList(
      items: asJsonMapList(json['items']).map(Laboratory.fromJson).toList(),
      permissions: PermissionSet.fromJson(json['permissions']),
    );
  }
}
