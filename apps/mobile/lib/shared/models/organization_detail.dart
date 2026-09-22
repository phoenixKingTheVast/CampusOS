import 'package:campusos/shared/models/json_map.dart';

class OrganizationDetail {
  const OrganizationDetail({
    required this.id,
    required this.name,
    required this.status,
    required this.memberCount,
    required this.followerCount,
    required this.following,
    required this.membershipStatus,
    required this.permissions,
    this.description,
    this.typeLabel,
    this.membershipPolicy,
    this.conversationId,
    this.suspended = false,
    this.closed = false,
    this.upcoming = const [],
    this.posts = const [],
    this.officers = const [],
  });

  final String id;
  final String name;
  final String status;
  final int memberCount;
  final int followerCount;
  final bool following;
  final String membershipStatus;
  final List<String> permissions;
  final String? description;
  final String? typeLabel;
  final String? membershipPolicy;
  final String? conversationId;
  final bool suspended;
  final bool closed;
  final List<OrganizationEvent> upcoming;
  final List<OrganizationPost> posts;
  final List<OrganizationOfficer> officers;

  bool get isMember => membershipStatus == 'ACTIVE';
  bool get canJoin => permissions.contains('JOIN') && !isMember && !closed && !suspended;
  bool get canFollow => permissions.contains('FOLLOW');
  bool get canLeave => permissions.contains('LEAVE');

  factory OrganizationDetail.fromJson(Map<String, dynamic> json) {
    return OrganizationDetail(
      id: asString(json['id']) ?? '',
      name: asString(json['name']) ?? '',
      status: asString(json['status']) ?? '',
      memberCount: asInt(json['memberCount']) ?? 0,
      followerCount: asInt(json['followerCount']) ?? 0,
      following: asBool(json['following']),
      membershipStatus: asString(json['membershipStatus']) ?? 'NONE',
      permissions: asStringList(json['permissions']),
      description: asString(json['description']),
      typeLabel: asString(json['typeLabel']),
      membershipPolicy: asString(json['membershipPolicy']),
      conversationId: asString(json['conversationId']),
      suspended: asBool(json['suspended']),
      closed: asBool(json['closed']),
      upcoming: asJsonMapList(json['upcoming']).map(OrganizationEvent.fromJson).toList(),
      posts: asJsonMapList(json['posts']).map(OrganizationPost.fromJson).toList(),
      officers: asJsonMapList(json['officers']).map(OrganizationOfficer.fromJson).toList(),
    );
  }
}

class OrganizationEvent {
  const OrganizationEvent({
    required this.id,
    required this.title,
    this.startsAt,
    this.location,
    this.route,
  });

  final String id;
  final String title;
  final DateTime? startsAt;
  final String? location;
  final String? route;

  factory OrganizationEvent.fromJson(Map<String, dynamic> json) {
    return OrganizationEvent(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      startsAt: asDateTime(json['startsAt']),
      location: asString(json['location']),
      route: asString(json['route']),
    );
  }
}

class OrganizationPost {
  const OrganizationPost({
    required this.id,
    required this.body,
    this.authorName,
    this.publishedAt,
  });

  final String id;
  final String body;
  final String? authorName;
  final DateTime? publishedAt;

  factory OrganizationPost.fromJson(Map<String, dynamic> json) {
    return OrganizationPost(
      id: asString(json['id']) ?? '',
      body: asString(json['body']) ?? '',
      authorName: asString(json['authorName']),
      publishedAt: asDateTime(json['publishedAt']),
    );
  }
}

class OrganizationOfficer {
  const OrganizationOfficer({required this.personId, required this.name, this.role, this.officerTitle});

  final String personId;
  final String name;
  final String? role;
  final String? officerTitle;

  factory OrganizationOfficer.fromJson(Map<String, dynamic> json) {
    return OrganizationOfficer(
      personId: asString(json['personId']) ?? '',
      name: asString(json['name']) ?? '',
      role: asString(json['role']),
      officerTitle: asString(json['officerTitle']),
    );
  }
}
