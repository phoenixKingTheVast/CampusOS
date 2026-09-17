import 'package:campusos/shared/models/json_map.dart';

class Programme {
  const Programme({
    required this.id,
    required this.code,
    required this.name,
    required this.facultyId,
    required this.facultyName,
  });

  final String id;
  final String code;
  final String name;
  final String facultyId;
  final String facultyName;

  factory Programme.fromJson(Map<String, dynamic> json) {
    return Programme(
      id: asString(json['id']) ?? '',
      code: asString(json['code']) ?? '',
      name: asString(json['name']) ?? '',
      facultyId: asString(json['facultyId']) ?? '',
      facultyName: asString(json['facultyName']) ?? '',
    );
  }
}

class AcademicClass {
  const AcademicClass({
    required this.id,
    required this.code,
    required this.name,
    this.yearOfStudy,
    this.facultyName,
    this.semester,
    this.representativeCount = 0,
    this.canRequestMembership = false,
  });

  final String id;
  final String code;
  final String name;
  final int? yearOfStudy;
  final String? facultyName;
  final String? semester;
  final int representativeCount;
  final bool canRequestMembership;

  bool get hasRepresentative => representativeCount > 0 && canRequestMembership;

  factory AcademicClass.fromJson(Map<String, dynamic> json) {
    return AcademicClass(
      id: asString(json['id']) ?? '',
      code: asString(json['code']) ?? '',
      name: asString(json['name']) ?? '',
      yearOfStudy: asInt(json['yearOfStudy']),
      facultyName: asString(json['facultyName']),
      semester: asString(json['semester']),
      representativeCount: asInt(json['representativeCount']) ?? 0,
      canRequestMembership: asBool(json['canRequestMembership']),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'code': code,
      'name': name,
      'year_of_study': yearOfStudy,
      'faculty_name': facultyName,
      'semester_label': semester,
      'representative_count': representativeCount,
      'can_request_membership': canRequestMembership ? 1 : 0,
    };
  }
}

class StudentVerification {
  const StudentVerification({
    required this.status,
    this.id,
    this.programmeName,
    this.rejectionReason,
  });

  final String status;
  final String? id;
  final String? programmeName;
  final String? rejectionReason;

  bool get isPending => status == 'PENDING';
  bool get isNone => status == 'NONE';

  factory StudentVerification.fromJson(Map<String, dynamic> json) {
    return StudentVerification(
      status: asString(json['status']) ?? 'NONE',
      id: asString(json['id']),
      programmeName: asString(json['programmeName']),
      rejectionReason: asString(json['rejectionReason']),
    );
  }
}
