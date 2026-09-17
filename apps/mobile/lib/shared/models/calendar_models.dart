import 'package:campusos/shared/models/json_map.dart';

class CalendarActivity {
  const CalendarActivity({
    required this.id,
    required this.title,
    required this.type,
    required this.startTime,
    required this.endTime,
    required this.timezone,
    required this.status,
    required this.category,
    required this.categoryLabel,
    required this.personal,
    this.location,
    this.description,
    this.sourceObjectType,
    this.sourceObjectId,
    this.route,
  });

  final String id;
  final String title;
  final String type;
  final DateTime startTime;
  final DateTime endTime;
  final String timezone;
  final String status;
  final String category;
  final String categoryLabel;
  final bool personal;
  final String? location;
  final String? description;
  final String? sourceObjectType;
  final String? sourceObjectId;
  final String? route;

  bool get cancelled => status == 'CANCELLED';
  bool get completed => status == 'COMPLETED';

  String get accessibilityLabel {
    final date = startTime.toIso8601String();
    final going = cancelled ? 'Cancelled. ' : '';
    return '$title. $date. $categoryLabel. ${going}Open activity.';
  }

  factory CalendarActivity.fromJson(Map<String, dynamic> json) {
    return CalendarActivity(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      type: asString(json['type']) ?? '',
      startTime: asDateTime(json['startTime']) ?? DateTime.now(),
      endTime: asDateTime(json['endTime']) ?? DateTime.now(),
      timezone: asString(json['timezone']) ?? 'Africa/Harare',
      status: asString(json['status']) ?? 'SCHEDULED',
      category: asString(json['category']) ?? 'SOCIAL',
      categoryLabel: asString(json['categoryLabel']) ?? 'Campus activity',
      personal: asBool(json['personal']),
      location: asString(json['location']),
      description: asString(json['description']),
      sourceObjectType: asString(json['sourceObjectType']),
      sourceObjectId: asString(json['sourceObjectId']),
      route: asString(json['route']),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'type': type,
      'title': title,
      'start_time': startTime.toIso8601String(),
      'end_time': endTime.toIso8601String(),
      'timezone': timezone,
      'location': location,
      'status': status,
      'category': category,
      'category_label': categoryLabel,
      'personal': personal ? 1 : 0,
      'source_object_type': sourceObjectType,
      'source_object_id': sourceObjectId,
      'route': route,
      'description': description,
    };
  }
}

class CampusEventDetail {
  const CampusEventDetail({
    required this.id,
    required this.title,
    required this.status,
    required this.startsAt,
    required this.permissions,
    this.endsAt,
    this.location,
    this.description,
    this.organizerName,
    this.myResponse = 'NONE',
    this.goingCount = 0,
    this.interestedCount = 0,
    this.capacity,
    this.cancelled = false,
    this.categoryLabel = 'Campus event',
    this.waitlisted = false,
  });

  final String id;
  final String title;
  final String status;
  final DateTime startsAt;
  final DateTime? endsAt;
  final String? location;
  final String? description;
  final String? organizerName;
  final String myResponse;
  final int goingCount;
  final int interestedCount;
  final int? capacity;
  final bool cancelled;
  final String categoryLabel;
  final bool waitlisted;
  final List<String> permissions;

  String get accessibilityLabel {
    return '$title. ${startsAt.toIso8601String()}. $categoryLabel. ${myResponse == 'GOING' ? 'Going.' : cancelled ? 'Cancelled.' : ''}';
  }

  factory CampusEventDetail.fromJson(Map<String, dynamic> json) {
    return CampusEventDetail(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      status: asString(json['status']) ?? '',
      startsAt: asDateTime(json['startsAt']) ?? DateTime.now(),
      endsAt: asDateTime(json['endsAt']),
      location: asString(json['location']),
      description: asString(json['description']),
      organizerName: asString(json['organizerName']),
      myResponse: asString(json['myResponse']) ?? 'NONE',
      goingCount: asInt(json['goingCount']) ?? 0,
      interestedCount: asInt(json['interestedCount']) ?? 0,
      capacity: asInt(json['capacity']),
      cancelled: asBool(json['cancelled']) || asString(json['status']) == 'CANCELLED',
      categoryLabel: asString(json['categoryLabel']) ?? 'Campus event',
      waitlisted: asBool(json['waitlisted']),
      permissions: (json['permissions'] as List<dynamic>? ?? []).map((item) => '$item').toList(),
    );
  }
}
