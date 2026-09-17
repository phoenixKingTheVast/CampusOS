import 'package:campusos/shared/models/activity.dart';
import 'package:campusos/shared/models/json_map.dart';

class LearnSnapshot {
  const LearnSnapshot({
    required this.currentActivities,
    required this.upcomingActivities,
    required this.attentionItems,
    required this.courses,
    required this.studyGroups,
    this.primaryClass,
    this.fromCache = false,
    this.lastUpdated,
  });

  final List<ActivityItem> currentActivities;
  final List<ActivityItem> upcomingActivities;
  final List<AttentionItem> attentionItems;
  final List<CourseOfferingSummary> courses;
  final PrimaryClassSummary? primaryClass;
  final List<StudyGroupSummary> studyGroups;
  final bool fromCache;
  final DateTime? lastUpdated;

  factory LearnSnapshot.fromJson(
    Map<String, dynamic> json, {
    bool fromCache = false,
    DateTime? lastUpdated,
  }) {
    return LearnSnapshot(
      currentActivities:
          asJsonMapList(json['currentActivities']).map(ActivityItem.fromHomeJson).toList(),
      upcomingActivities:
          asJsonMapList(json['upcomingActivities']).map(ActivityItem.fromHomeJson).toList(),
      attentionItems:
          asJsonMapList(json['attentionItems']).map(AttentionItem.fromJson).toList(),
      courses: asJsonMapList(json['courses']).map(CourseOfferingSummary.fromJson).toList(),
      primaryClass: json['primaryClass'] is Map
          ? PrimaryClassSummary.fromJson(asJsonMap(json['primaryClass']))
          : null,
      studyGroups: asJsonMapList(json['studyGroups']).map(StudyGroupSummary.fromJson).toList(),
      fromCache: fromCache,
      lastUpdated: lastUpdated,
    );
  }
}

class CourseOfferingSummary {
  const CourseOfferingSummary({
    required this.courseOfferingId,
    required this.courseId,
    required this.code,
    required this.title,
    required this.semester,
    this.status,
    this.lecturer,
    this.nextActivityTitle,
    this.nextActivityStart,
    this.unreadAnnouncements = 0,
  });

  final String courseOfferingId;
  final String courseId;
  final String code;
  final String title;
  final String semester;
  final String? status;
  final String? lecturer;
  final String? nextActivityTitle;
  final DateTime? nextActivityStart;
  final int unreadAnnouncements;

  factory CourseOfferingSummary.fromJson(Map<String, dynamic> json) {
    final next = json['nextActivity'] is Map ? asJsonMap(json['nextActivity']) : null;
    return CourseOfferingSummary(
      courseOfferingId: asString(json['courseOfferingId']) ?? '',
      courseId: asString(json['courseId']) ?? '',
      code: asString(json['code']) ?? '',
      title: asString(json['title']) ?? '',
      semester: asString(json['semester']) ?? '',
      status: asString(json['status']),
      lecturer: asString(json['lecturer']),
      nextActivityTitle: asString(next?['title']),
      nextActivityStart: asDateTime(next?['startTime']),
      unreadAnnouncements: asInt(json['unreadAnnouncements']) ?? 0,
    );
  }
}

class PrimaryClassSummary {
  const PrimaryClassSummary({
    required this.id,
    required this.code,
    required this.name,
    this.yearOfStudy,
    this.announcementCount = 0,
    this.upcomingCount = 0,
    this.route,
  });

  final String id;
  final String code;
  final String name;
  final int? yearOfStudy;
  final int announcementCount;
  final int upcomingCount;
  final String? route;

  factory PrimaryClassSummary.fromJson(Map<String, dynamic> json) {
    return PrimaryClassSummary(
      id: asString(json['id']) ?? '',
      code: asString(json['code']) ?? '',
      name: asString(json['name']) ?? '',
      yearOfStudy: asInt(json['yearOfStudy']),
      announcementCount: asInt(json['announcementCount']) ?? 0,
      upcomingCount: asInt(json['upcomingCount']) ?? 0,
      route: asString(json['route']) ?? '/app/class/${asString(json['id']) ?? ''}',
    );
  }
}

class StudyGroupSummary {
  const StudyGroupSummary({
    required this.id,
    required this.name,
    this.memberCount = 0,
  });

  final String id;
  final String name;
  final int memberCount;

  factory StudyGroupSummary.fromJson(Map<String, dynamic> json) {
    return StudyGroupSummary(
      id: asString(json['id']) ?? '',
      name: asString(json['name']) ?? '',
      memberCount: asInt(json['memberCount']) ?? 0,
    );
  }
}
