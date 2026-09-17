import 'package:campusos/shared/models/json_map.dart';

class ActivityItem {
  const ActivityItem({
    required this.id,
    required this.title,
    this.type,
    this.source,
    this.startTime,
    this.endTime,
    this.location,
    this.status,
    this.relative,
    this.route,
    this.courseOfferingId,
    this.courseCode,
  });

  final String id;
  final String title;
  final String? type;
  final String? source;
  final DateTime? startTime;
  final DateTime? endTime;
  final String? location;
  final String? status;
  final String? relative;
  final String? route;
  final String? courseOfferingId;
  final String? courseCode;

  factory ActivityItem.fromHomeJson(Map<String, dynamic> json) {
    final route = asString(json['route']);
    return ActivityItem(
      id: asString(json['activityId']) ?? asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      type: asString(json['type']),
      source: asString(json['source']),
      startTime: asDateTime(json['startTime']),
      endTime: asDateTime(json['endTime']),
      location: asString(json['location']),
      status: asString(json['status']),
      relative: asString(json['relative']),
      route: route,
      courseOfferingId: asString(json['courseOfferingId']) ?? courseOfferingIdFromRoute(route),
      courseCode: asString(json['courseCode']),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'type': type,
      'title': title,
      'start_time': startTime?.toIso8601String(),
      'end_time': endTime?.toIso8601String(),
      'location': location,
      'status': status,
      'course_offering_id': courseOfferingId,
      'source': source,
      'relative': relative,
      'route': route,
    };
  }

  factory ActivityItem.fromRow(Map<String, Object?> row) {
    return ActivityItem(
      id: asString(row['id']) ?? '',
      title: asString(row['title']) ?? '',
      type: asString(row['type']),
      source: asString(row['source']),
      startTime: asDateTime(row['start_time']),
      endTime: asDateTime(row['end_time']),
      location: asString(row['location']),
      status: asString(row['status']),
      relative: asString(row['relative']),
      route: asString(row['route']),
      courseOfferingId: asString(row['course_offering_id']),
    );
  }

  static String? courseOfferingIdFromRoute(String? route) {
    if (route == null) {
      return null;
    }
    final match = RegExp(r'/app/learn/course/([^/]+)').firstMatch(route);
    return match?.group(1);
  }
}

class AttentionItem {
  const AttentionItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.priority,
    this.sourceType,
    this.sourceId,
    this.route,
  });

  final String id;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final String? priority;
  final String? sourceType;
  final String? sourceId;
  final String? route;

  factory AttentionItem.fromJson(Map<String, dynamic> json) {
    return AttentionItem(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      subtitle: asString(json['subtitle']),
      actionLabel: asString(json['actionLabel']),
      priority: asString(json['priority']),
      sourceType: asString(json['sourceType']),
      sourceId: asString(json['sourceId']),
      route: asString(json['route']),
    );
  }
}

class CampusCard {
  const CampusCard({
    required this.id,
    required this.kind,
    required this.title,
    this.subtitle,
    this.route,
  });

  final String id;
  final String kind;
  final String title;
  final String? subtitle;
  final String? route;

  factory CampusCard.fromJson(Map<String, dynamic> json) {
    return CampusCard(
      id: asString(json['id']) ?? '',
      kind: asString(json['kind']) ?? '',
      title: asString(json['title']) ?? '',
      subtitle: asString(json['subtitle']),
      route: asString(json['route']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'kind': kind,
      'title': title,
      'subtitle': subtitle,
      'route': route,
    };
  }
}
