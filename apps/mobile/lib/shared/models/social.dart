import 'package:campusos/shared/models/json_map.dart';

/// Minimal person card used by every follower/following/connection/blocked list.
class PersonCard {
  const PersonCard({
    required this.id,
    this.displayName,
    this.username,
    this.photoFileId,
    this.blockedAt,
    this.actions = const [],
  });

  final String id;
  final String? displayName;
  final String? username;
  final String? photoFileId;
  final DateTime? blockedAt;
  final List<String> actions;

  String get name => displayName ?? (username == null ? 'Someone' : '@$username');

  String? get handle => username == null ? null : '@$username';

  factory PersonCard.fromJson(Map<String, dynamic> json) {
    return PersonCard(
      id: asString(json['id']) ?? '',
      displayName: asString(json['displayName']),
      username: asString(json['username']),
      photoFileId: asString(json['photoFileId']),
      blockedAt: asDateTime(json['blockedAt']),
      actions: asStringList(json['actions']),
    );
  }
}

/// A page of people. `visible` is false when privacy hides the whole list, in
/// which case `message` carries the exact copy to show ("Followers aren't
/// visible.").
class SocialPage {
  const SocialPage({
    required this.items,
    this.nextCursor,
    this.visible = true,
    this.message,
  });

  final List<PersonCard> items;
  final String? nextCursor;
  final bool visible;
  final String? message;

  factory SocialPage.fromJson(Map<String, dynamic> json) {
    return SocialPage(
      items: asJsonMapList(json['items']).map(PersonCard.fromJson).toList(),
      nextCursor: asString(json['nextCursor']),
      visible: json['visible'] == null ? true : asBool(json['visible']),
      message: asString(json['message']),
    );
  }

  SocialPage merge(SocialPage next) {
    return SocialPage(
      items: [...items, ...next.items],
      nextCursor: next.nextCursor,
      visible: next.visible,
      message: next.message,
    );
  }
}

/// A profile as the viewer is allowed to see it. When `restricted` is true the
/// server has withheld everything except the identity and the safety actions.
class PersonProfile {
  const PersonProfile({
    required this.id,
    required this.isSelf,
    required this.restricted,
    required this.actions,
    this.displayName,
    this.username,
    this.bio,
    this.photoFileId,
    this.accountState,
    this.restrictionMessage,
    this.relationship = const ProfileRelationship(),
    this.counts = const ProfileCounts(),
    this.canMessage = false,
    this.messagingReason,
    this.sharedContext = const SharedContext(),
  });

  final String id;
  final bool isSelf;
  final bool restricted;
  final List<String> actions;
  final String? displayName;
  final String? username;
  final String? bio;
  final String? photoFileId;
  final String? accountState;
  final String? restrictionMessage;
  final ProfileRelationship relationship;
  final ProfileCounts counts;
  final bool canMessage;
  final String? messagingReason;
  final SharedContext sharedContext;

  String get name => displayName ?? (username == null ? 'Someone' : '@$username');

  String? get handle => username == null ? null : '@$username';

  bool can(String action) => actions.contains(action);

  factory PersonProfile.fromJson(Map<String, dynamic> json) {
    final messaging = asJsonMap(json['messagingPolicy']);
    return PersonProfile(
      id: asString(json['id']) ?? '',
      isSelf: asBool(json['isSelf']),
      restricted: asBool(json['restricted']),
      actions: asStringList(json['actions']),
      displayName: asString(json['displayName']),
      username: asString(json['username']),
      bio: asString(json['bio']),
      photoFileId: asString(json['photoFileId']),
      accountState: asString(json['accountState']),
      restrictionMessage: asString(json['restrictionMessage']),
      relationship: ProfileRelationship.fromJson(asJsonMap(json['relationship'])),
      counts: ProfileCounts.fromJson(asJsonMap(json['counts'])),
      canMessage: asBool(messaging['canMessage']),
      messagingReason: asString(messaging['reason']),
      sharedContext: SharedContext.fromJson(asJsonMap(json['contextMemberships'])),
    );
  }
}

class ProfileRelationship {
  const ProfileRelationship({
    this.follow = 'NONE',
    this.connection = 'NONE',
    this.following = false,
    this.followedBy = false,
    this.connected = false,
    this.blockedByMe = false,
    this.blockedMe = false,
  });

  final String follow;
  final String connection;
  final bool following;
  final bool followedBy;
  final bool connected;
  final bool blockedByMe;
  final bool blockedMe;

  /// The relationship in words, so state is never conveyed by button tint alone.
  String get label {
    if (blockedByMe) {
      return 'Blocked';
    }
    switch (connection) {
      case 'CONNECTED':
        return follow == 'MUTUAL' ? 'Connected. You follow each other.' : 'Connected';
      case 'REQUESTED_BY_ME':
        return 'Connection request sent';
      case 'REQUESTED_BY_THEM':
        return 'Wants to connect with you';
    }
    switch (follow) {
      case 'MUTUAL':
        return 'You follow each other';
      case 'FOLLOWING':
        return 'Following';
      case 'FOLLOWED_BY':
        return 'Follows you';
      default:
        return 'Not connected';
    }
  }

  factory ProfileRelationship.fromJson(Map<String, dynamic> json) {
    return ProfileRelationship(
      follow: asString(json['follow']) ?? 'NONE',
      connection: asString(json['connection']) ?? 'NONE',
      following: asBool(json['following']),
      followedBy: asBool(json['followedBy']),
      connected: asBool(json['connected']),
      blockedByMe: asBool(json['blockedByMe']),
      blockedMe: asBool(json['blockedMe']),
    );
  }
}

/// A null count means the matching list is hidden by privacy, so the client
/// must not show a number the viewer could not have derived.
class ProfileCounts {
  const ProfileCounts({this.followers, this.following, this.connections});

  final int? followers;
  final int? following;
  final int? connections;

  factory ProfileCounts.fromJson(Map<String, dynamic> json) {
    return ProfileCounts(
      followers: asInt(json['followers']),
      following: asInt(json['following']),
      connections: asInt(json['connections']),
    );
  }
}

class SharedContext {
  const SharedContext({
    this.classes = const [],
    this.courseOfferings = const [],
    this.organizations = const [],
    this.studyGroups = const [],
    this.total = 0,
  });

  final List<SharedContextItem> classes;
  final List<SharedContextItem> courseOfferings;
  final List<SharedContextItem> organizations;
  final List<SharedContextItem> studyGroups;
  final int total;

  List<SharedContextItem> get all => [
        ...classes,
        ...courseOfferings,
        ...organizations,
        ...studyGroups,
      ];

  factory SharedContext.fromJson(Map<String, dynamic> json) {
    return SharedContext(
      classes: asJsonMapList(json['classes'])
          .map((row) => SharedContextItem.fromJson(row, 'CLASS'))
          .toList(),
      courseOfferings: asJsonMapList(json['courseOfferings'])
          .map((row) => SharedContextItem.fromJson(row, 'COURSE_OFFERING'))
          .toList(),
      organizations: asJsonMapList(json['organizations'])
          .map((row) => SharedContextItem.fromJson(row, 'ORGANIZATION'))
          .toList(),
      studyGroups: asJsonMapList(json['studyGroups'])
          .map((row) => SharedContextItem.fromJson(row, 'STUDY_GROUP'))
          .toList(),
      total: asInt(json['total']) ?? 0,
    );
  }
}

class SharedContextItem {
  const SharedContextItem({
    required this.id,
    required this.kind,
    required this.label,
    this.detail,
  });

  final String id;
  final String kind;
  final String label;
  final String? detail;

  String? get route {
    switch (kind) {
      case 'CLASS':
        return '/app/class/$id';
      case 'COURSE_OFFERING':
        return '/app/learn/course/$id';
      case 'ORGANIZATION':
        return '/app/explore/organization/$id';
      case 'STUDY_GROUP':
        return '/app/learn/study-group/$id';
      default:
        return null;
    }
  }

  factory SharedContextItem.fromJson(Map<String, dynamic> json, String kind) {
    final code = asString(json['code']);
    final name = asString(json['name']) ?? asString(json['title']);
    return SharedContextItem(
      id: asString(json['id']) ?? '',
      kind: kind,
      label: [code, name].whereType<String>().join(' '),
      detail: asString(json['semester']),
    );
  }
}

/// Privacy settings, mirroring `GET /privacy-settings` exactly so a PATCH can
/// send back the same field names.
class PrivacySettings {
  const PrivacySettings({
    required this.profileVisibility,
    required this.findable,
    required this.whoCanFollow,
    required this.whoCanConnect,
    required this.whoCanMessage,
    required this.activityVisibility,
    required this.followerVisibility,
    required this.followingVisibility,
    required this.connectionVisibility,
  });

  final String profileVisibility;
  final bool findable;
  final String whoCanFollow;
  final String whoCanConnect;
  final String whoCanMessage;
  final String activityVisibility;
  final String followerVisibility;
  final String followingVisibility;
  final String connectionVisibility;

  String value(String field) {
    switch (field) {
      case 'profileVisibility':
        return profileVisibility;
      case 'whoCanFollow':
        return whoCanFollow;
      case 'whoCanConnect':
        return whoCanConnect;
      case 'whoCanMessage':
        return whoCanMessage;
      case 'activityVisibility':
        return activityVisibility;
      case 'followerVisibility':
        return followerVisibility;
      case 'followingVisibility':
        return followingVisibility;
      case 'connectionVisibility':
        return connectionVisibility;
      default:
        return 'CAMPUS';
    }
  }

  factory PrivacySettings.fromJson(Map<String, dynamic> json) {
    return PrivacySettings(
      profileVisibility: asString(json['profileVisibility']) ?? 'CAMPUS',
      findable: json['findable'] == null ? true : asBool(json['findable']),
      whoCanFollow: asString(json['whoCanFollow']) ?? 'EVERYONE',
      whoCanConnect: asString(json['whoCanConnect']) ?? 'CAMPUS',
      whoCanMessage: asString(json['whoCanMessage']) ?? 'CONNECTIONS',
      activityVisibility: asString(json['activityVisibility']) ?? 'CAMPUS',
      followerVisibility: asString(json['followerVisibility']) ?? 'EVERYONE',
      followingVisibility: asString(json['followingVisibility']) ?? 'EVERYONE',
      connectionVisibility: asString(json['connectionVisibility']) ?? 'CONNECTIONS',
    );
  }
}

/// One audience field on the privacy screen. The option lists mirror
/// `AUDIENCE_OPTIONS` on the server; the server re-validates every PATCH.
class PrivacyAudienceField {
  const PrivacyAudienceField({
    required this.field,
    required this.label,
    required this.options,
    this.description,
  });

  final String field;
  final String label;
  final List<String> options;
  final String? description;

  static const all = <PrivacyAudienceField>[
    PrivacyAudienceField(
      field: 'profileVisibility',
      label: 'Who can see your profile',
      options: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'CONTEXT_ONLY', 'ONLY_ME'],
    ),
    PrivacyAudienceField(
      field: 'whoCanFollow',
      label: 'Who can follow you',
      options: ['EVERYONE', 'CAMPUS', 'CONNECTIONS'],
    ),
    PrivacyAudienceField(
      field: 'whoCanConnect',
      label: 'Who can send you connection requests',
      options: ['EVERYONE', 'CAMPUS', 'CONTEXT_ONLY'],
    ),
    PrivacyAudienceField(
      field: 'whoCanMessage',
      label: 'Who can message you',
      options: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'CONTEXT_ONLY', 'ONLY_ME'],
      description:
          'People in your classes, courses and organizations can always see you there.',
    ),
    PrivacyAudienceField(
      field: 'activityVisibility',
      label: 'Who can see your activity',
      options: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'CONTEXT_ONLY', 'ONLY_ME'],
    ),
    PrivacyAudienceField(
      field: 'followerVisibility',
      label: 'Who can see your followers',
      options: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'ONLY_ME'],
    ),
    PrivacyAudienceField(
      field: 'followingVisibility',
      label: 'Who can see who you follow',
      options: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'ONLY_ME'],
    ),
    PrivacyAudienceField(
      field: 'connectionVisibility',
      label: 'Who can see your connections',
      options: ['EVERYONE', 'CAMPUS', 'CONNECTIONS', 'ONLY_ME'],
    ),
  ];
}

String privacyAudienceLabel(String value) {
  switch (value) {
    case 'EVERYONE':
      return 'Everyone';
    case 'CAMPUS':
      return 'Anyone on campus';
    case 'CONNECTIONS':
      return 'My connections';
    case 'CONTEXT_ONLY':
      return 'People I share a class or group with';
    case 'ONLY_ME':
      return 'Only me';
    default:
      return value;
  }
}

/// Keys match the server's `ReportReason` enum; anything else is coerced to
/// OTHER rather than rejected.
const personReportReasons = <String, String>{
  'HARASSMENT': 'Harassment',
  'SPAM': 'Spam',
  'INAPPROPRIATE_CONTENT': 'Inappropriate content',
  'IMPERSONATION': 'Impersonation',
  'MISLEADING': 'Misleading information',
  'OTHER': 'Something else',
};
