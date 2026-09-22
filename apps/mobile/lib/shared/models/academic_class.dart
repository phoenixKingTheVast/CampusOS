import 'package:campusos/shared/models/json_map.dart';

class AcademicClassDetail {
  const AcademicClassDetail({
    required this.id,
    required this.code,
    required this.name,
    required this.yearOfStudy,
    required this.facultyName,
    required this.semester,
    required this.membershipStatus,
    required this.canRequestMembership,
    this.membershipRole,
    this.representativeCount = 0,
    this.announcementCount = 0,
    this.upcomingCount = 0,
    this.representatives = const [],
    this.members = const [],
    this.activities = const [],
  });

  final String id;
  final String code;
  final String name;
  final int yearOfStudy;
  final String facultyName;
  final String semester;
  final String membershipStatus;
  final bool canRequestMembership;
  final String? membershipRole;
  final int representativeCount;
  final int announcementCount;
  final int upcomingCount;
  final List<ClassPerson> representatives;
  final List<ClassPerson> members;
  final List<ClassActivity> activities;

  bool get isMember => membershipStatus == 'ACTIVE';
  bool get isPending => membershipStatus == 'PENDING';

  factory AcademicClassDetail.fromJson(Map<String, dynamic> json) {
    return AcademicClassDetail(
      id: asString(json['id']) ?? '',
      code: asString(json['code']) ?? '',
      name: asString(json['name']) ?? '',
      yearOfStudy: asInt(json['yearOfStudy']) ?? 0,
      facultyName: asString(json['facultyName']) ?? '',
      semester: asString(json['semester']) ?? '',
      membershipStatus: asString(json['membershipStatus']) ?? 'NONE',
      canRequestMembership: asBool(json['canRequestMembership']),
      membershipRole: asString(json['membershipRole']),
      representativeCount: asInt(json['representativeCount']) ?? 0,
      announcementCount: asInt(json['announcementCount']) ?? 0,
      upcomingCount: asInt(json['upcomingCount']) ?? 0,
      representatives: asJsonMapList(json['representatives']).map(ClassPerson.fromJson).toList(),
      members: asJsonMapList(json['members']).map(ClassPerson.fromJson).toList(),
      activities: asJsonMapList(json['activities']).map(ClassActivity.fromJson).toList(),
    );
  }
}

class ClassPerson {
  const ClassPerson({required this.id, required this.name, this.role});

  final String id;
  final String name;
  final String? role;

  factory ClassPerson.fromJson(Map<String, dynamic> json) {
    return ClassPerson(
      id: asString(json['id']) ?? '',
      name: asString(json['name']) ?? '',
      role: asString(json['role']),
    );
  }
}

class ClassActivity {
  const ClassActivity({
    required this.id,
    required this.title,
    this.type,
    this.startTime,
    this.location,
    this.route,
  });

  final String id;
  final String title;
  final String? type;
  final DateTime? startTime;
  final String? location;
  final String? route;

  factory ClassActivity.fromJson(Map<String, dynamic> json) {
    return ClassActivity(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      type: asString(json['type']),
      startTime: asDateTime(json['startTime']),
      location: asString(json['location']),
      route: asString(json['route']),
    );
  }
}
