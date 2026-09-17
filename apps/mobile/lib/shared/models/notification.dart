import 'package:campusos/shared/models/json_map.dart';

/// A notification is a derived representation of something that happened in a
/// domain object. It is never the source of truth, so opening one always
/// re-resolves the deep link on the server.
class CampusNotification {
  const CampusNotification({
    required this.id,
    required this.type,
    required this.category,
    required this.title,
    required this.body,
    required this.sourceType,
    required this.sourceId,
    required this.read,
    this.priority = 'NORMAL',
    this.route,
    this.createdAt,
    this.seen = false,
  });

  final String id;
  final String type;
  final String category;
  final String title;
  final String body;
  final String sourceType;
  final String sourceId;
  final bool read;
  final String priority;
  final String? route;
  final DateTime? createdAt;
  final bool seen;

  String get categoryLabel => notificationCategoryLabel(category);

  /// Unread is announced in words, never signalled by colour alone.
  String semanticLabel(String timeLabel) {
    return [
      read ? 'Read' : 'Unread',
      categoryLabel,
      title,
      body,
      timeLabel,
    ].where((part) => part.isNotEmpty).join('. ');
  }

  factory CampusNotification.fromJson(Map<String, dynamic> json) {
    return CampusNotification(
      id: asString(json['id']) ?? '',
      type: asString(json['type']) ?? '',
      category: asString(json['category']) ?? 'SYSTEM',
      title: asString(json['title']) ?? '',
      body: asString(json['body']) ?? '',
      sourceType: asString(json['sourceType']) ?? '',
      sourceId: asString(json['sourceId']) ?? '',
      read: asBool(json['read']),
      priority: asString(json['priority']) ?? 'NORMAL',
      route: asString(json['route']) ?? asString(json['deepLink']),
      createdAt: asDateTime(json['createdAt']),
      seen: asBool(json['seen']),
    );
  }

  CampusNotification copyWith({bool? read}) {
    return CampusNotification(
      id: id,
      type: type,
      category: category,
      title: title,
      body: body,
      sourceType: sourceType,
      sourceId: sourceId,
      read: read ?? this.read,
      priority: priority,
      route: route,
      createdAt: createdAt,
      seen: seen || (read ?? false),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'type': type,
      'category': category,
      'priority': priority,
      'title': title,
      'body': body,
      'source_type': sourceType,
      'source_id': sourceId,
      'read': read ? 1 : 0,
      'seen': seen ? 1 : 0,
      'created_at': createdAt?.toIso8601String(),
      'route': route,
    };
  }

  factory CampusNotification.fromRow(Map<String, Object?> row) {
    return CampusNotification(
      id: asString(row['id']) ?? '',
      type: asString(row['type']) ?? '',
      category: asString(row['category']) ?? 'SYSTEM',
      title: asString(row['title']) ?? '',
      body: asString(row['body']) ?? '',
      sourceType: asString(row['source_type']) ?? '',
      sourceId: asString(row['source_id']) ?? '',
      read: asBool(row['read']),
      priority: asString(row['priority']) ?? 'NORMAL',
      route: asString(row['route']),
      createdAt: asDateTime(row['created_at']),
      seen: asBool(row['seen']),
    );
  }
}

String notificationCategoryLabel(String category) {
  switch (category.toUpperCase()) {
    case 'ACADEMIC':
      return 'Academic';
    case 'CLASS':
      return 'Class';
    case 'ORGANIZATION':
      return 'Organizations';
    case 'SOCIAL':
      return 'Social';
    case 'SERVICE':
      return 'Services';
    case 'SYSTEM':
      return 'System';
    default:
      return 'Other';
  }
}

/// The notification centre filters. `Unread` is a cross-category filter rather
/// than a category of its own.
class NotificationFilter {
  const NotificationFilter({
    required this.label,
    this.category,
    this.unreadOnly = false,
  });

  final String label;
  final String? category;
  final bool unreadOnly;

  static const all = <NotificationFilter>[
    NotificationFilter(label: 'All'),
    NotificationFilter(label: 'Unread', unreadOnly: true),
    NotificationFilter(label: 'Academic', category: 'ACADEMIC'),
    NotificationFilter(label: 'Class', category: 'CLASS'),
    NotificationFilter(label: 'Organizations', category: 'ORGANIZATION'),
    NotificationFilter(label: 'Social', category: 'SOCIAL'),
    NotificationFilter(label: 'Services', category: 'SERVICE'),
    NotificationFilter(label: 'System', category: 'SYSTEM'),
  ];
}

/// Mirrors the grouped shape returned by `GET /notification-preferences`.
class NotificationPreferences {
  const NotificationPreferences({
    required this.values,
    this.quietHoursStart,
    this.quietHoursEnd,
  });

  /// Keyed by the flat API field name, which is what `PATCH` expects back.
  final Map<String, bool> values;
  final String? quietHoursStart;
  final String? quietHoursEnd;

  bool value(String key) => values[key] ?? true;

  bool get quietHoursEnabled => quietHoursStart != null && quietHoursEnd != null;

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) {
    final messages = asJsonMap(json['messages']);
    final academic = asJsonMap(json['academic']);
    final classes = asJsonMap(json['classes']);
    final organizations = asJsonMap(json['organizations']);
    final services = asJsonMap(json['services']);
    final social = asJsonMap(json['social']);
    final quiet = asJsonMap(json['quietHours']);
    return NotificationPreferences(
      values: {
        'directMessages': asBool(messages['directMessages']),
        'mentions': asBool(messages['mentions']),
        'groupMessages': asBool(messages['groupMessages']),
        'academicImportant': asBool(academic['important']),
        'assignments': asBool(academic['assignments']),
        'resources': asBool(academic['resources']),
        'classUpdates': asBool(classes['classUpdates']),
        'organizationEvents': asBool(organizations['events']),
        'organizationPosts': asBool(organizations['posts']),
        'serviceUpdates': asBool(services['serviceUpdates']),
        'follows': asBool(social['follows']),
      },
      quietHoursStart: asString(quiet['start']),
      quietHoursEnd: asString(quiet['end']),
    );
  }
}

/// One toggle row in the preferences screen, grouped the way the API groups them.
class NotificationPreferenceGroup {
  const NotificationPreferenceGroup({required this.title, required this.toggles});

  final String title;
  final List<NotificationPreferenceToggle> toggles;

  static const all = <NotificationPreferenceGroup>[
    NotificationPreferenceGroup(
      title: 'Messages',
      toggles: [
        NotificationPreferenceToggle(key: 'directMessages', label: 'Direct messages'),
        NotificationPreferenceToggle(key: 'mentions', label: 'Mentions'),
        NotificationPreferenceToggle(key: 'groupMessages', label: 'Group messages'),
      ],
    ),
    NotificationPreferenceGroup(
      title: 'Academic',
      toggles: [
        NotificationPreferenceToggle(
          key: 'academicImportant',
          label: 'Important announcements',
          description: 'Urgent announcements always arrive, even during quiet hours.',
        ),
        NotificationPreferenceToggle(key: 'assignments', label: 'Assignments and assessments'),
        NotificationPreferenceToggle(key: 'resources', label: 'New resources'),
      ],
    ),
    NotificationPreferenceGroup(
      title: 'Classes',
      toggles: [NotificationPreferenceToggle(key: 'classUpdates', label: 'Class updates')],
    ),
    NotificationPreferenceGroup(
      title: 'Organizations',
      toggles: [
        NotificationPreferenceToggle(key: 'organizationEvents', label: 'Events'),
        NotificationPreferenceToggle(key: 'organizationPosts', label: 'Posts'),
      ],
    ),
    NotificationPreferenceGroup(
      title: 'Services',
      toggles: [
        NotificationPreferenceToggle(
          key: 'serviceUpdates',
          label: 'Booking updates',
          description: 'Confirmations, declines and reminders for your bookings.',
        ),
      ],
    ),
    NotificationPreferenceGroup(
      title: 'Social',
      toggles: [
        NotificationPreferenceToggle(
          key: 'follows',
          label: 'Follows and connection requests',
          description: 'Follows appear in the notification centre without a push.',
        ),
      ],
    ),
  ];
}

class NotificationPreferenceToggle {
  const NotificationPreferenceToggle({
    required this.key,
    required this.label,
    this.description,
  });

  final String key;
  final String label;
  final String? description;
}
