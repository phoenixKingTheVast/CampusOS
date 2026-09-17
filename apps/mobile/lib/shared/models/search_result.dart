import 'package:campusos/shared/models/json_map.dart';

class SearchHit {
  const SearchHit({
    required this.id,
    required this.objectType,
    required this.title,
    this.subtitle,
    this.route,
    this.historical = false,
  });

  final String id;
  final String objectType;
  final String title;
  final String? subtitle;
  final String? route;
  final bool historical;

  factory SearchHit.fromJson(Map<String, dynamic> json) {
    return SearchHit(
      id: asString(json['id']) ?? '',
      objectType: asString(json['objectType']) ?? '',
      title: asString(json['title']) ?? '',
      subtitle: asString(json['subtitle']),
      route: asString(json['route']),
      historical: asBool(json['historical']),
    );
  }

  String get kindLabel {
    switch (objectType.toUpperCase()) {
      case 'PERSON':
        return 'Person';
      case 'COURSE':
        return 'Course';
      case 'CLASS':
        return 'Class';
      case 'ORGANIZATION':
        return 'Organization';
      case 'EVENT':
        return 'Event';
      case 'RESOURCE':
        return 'Resource';
      case 'STUDY_GROUP':
        return 'Study group';
      case 'SERVICE':
        return 'Service';
      default:
        return objectType;
    }
  }
}

class SearchCategory {
  const SearchCategory({
    required this.label,
    required this.apiType,
  });

  final String label;
  final String apiType;

  static const all = [
    SearchCategory(label: 'Everything', apiType: 'all'),
    SearchCategory(label: 'People', apiType: 'people'),
    SearchCategory(label: 'Courses', apiType: 'courses'),
    SearchCategory(label: 'Classes', apiType: 'classes'),
    SearchCategory(label: 'Organizations', apiType: 'organizations'),
    SearchCategory(label: 'Events', apiType: 'events'),
    SearchCategory(label: 'Resources', apiType: 'resources'),
    SearchCategory(label: 'Study Groups', apiType: 'study_groups'),
    SearchCategory(label: 'Services', apiType: 'services'),
  ];

  static SearchCategory fromApiType(String? type) {
    return all.firstWhere(
      (category) => category.apiType == (type ?? 'all'),
      orElse: () => all.first,
    );
  }
}

// Notifications live in `shared/models/notification.dart`: they now carry the
// type/category fields the API requires, which this file's old NotificationItem
// did not model.
