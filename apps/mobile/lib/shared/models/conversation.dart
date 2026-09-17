import 'package:campusos/shared/models/json_map.dart';

/// One conversation from the universal Conversation engine. The same model
/// covers direct threads, class threads, organization threads and bookings.
class ConversationSummary {
  const ConversationSummary({
    required this.id,
    required this.kind,
    required this.title,
    required this.unreadCount,
    required this.route,
    this.participantCount = 0,
    this.muted = false,
    this.lastActivityAt,
    this.lastMessage,
    this.contextType,
    this.contextId,
    this.accessibilityLabel,
  });

  final String id;
  final String kind;
  final String title;
  final int unreadCount;
  final String route;
  final int participantCount;
  final bool muted;
  final DateTime? lastActivityAt;
  final MessagePreview? lastMessage;
  final String? contextType;
  final String? contextId;
  final String? accessibilityLabel;

  bool get hasUnread => unreadCount > 0;

  String get kindLabel => conversationKindLabel(kind);

  /// Spoken by VoiceOver, so unread state is announced rather than only shown.
  String get semanticLabel {
    final parts = <String>[title, kindLabel];
    final preview = lastMessage?.preview;
    if (preview != null && preview.isNotEmpty) {
      parts.add('${lastMessage!.senderName ?? 'Someone'}: $preview');
    }
    parts.add(
      unreadCount == 0
          ? 'No unread messages'
          : unreadCount == 1
              ? '1 unread message'
              : '$unreadCount unread messages',
    );
    if (muted) {
      parts.add('Muted');
    }
    return parts.join('. ');
  }

  factory ConversationSummary.fromJson(Map<String, dynamic> json) {
    final id = asString(json['id']) ?? '';
    final last = json['lastMessage'];
    return ConversationSummary(
      id: id,
      kind: asString(json['kind']) ?? 'DIRECT',
      title: asString(json['title']) ?? 'Conversation',
      unreadCount: asInt(json['unreadCount']) ?? 0,
      route: asString(json['route']) ?? '/app/messages/$id',
      participantCount: asInt(json['participantCount']) ?? 0,
      muted: asBool(json['muted']),
      lastActivityAt: asDateTime(json['lastActivityAt']),
      lastMessage: last == null ? null : MessagePreview.fromJson(asJsonMap(last)),
      contextType: asString(json['contextType']),
      contextId: asString(json['contextId']),
      accessibilityLabel: asString(json['accessibilityLabel']),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'kind': kind,
      'title': title,
      'unread_count': unreadCount,
      'route': route,
      'participant_count': participantCount,
      'muted': muted ? 1 : 0,
      'last_activity_at': lastActivityAt?.toIso8601String(),
      'preview': lastMessage?.preview,
      'preview_sender': lastMessage?.senderName,
      'preview_at': lastMessage?.createdAt?.toIso8601String(),
      'context_type': contextType,
      'context_id': contextId,
    };
  }

  factory ConversationSummary.fromRow(Map<String, Object?> row) {
    final id = asString(row['id']) ?? '';
    final preview = asString(row['preview']);
    return ConversationSummary(
      id: id,
      kind: asString(row['kind']) ?? 'DIRECT',
      title: asString(row['title']) ?? 'Conversation',
      unreadCount: asInt(row['unread_count']) ?? 0,
      route: asString(row['route']) ?? '/app/messages/$id',
      participantCount: asInt(row['participant_count']) ?? 0,
      muted: asBool(row['muted']),
      lastActivityAt: asDateTime(row['last_activity_at']),
      lastMessage: preview == null
          ? null
          : MessagePreview(
              preview: preview,
              senderName: asString(row['preview_sender']),
              createdAt: asDateTime(row['preview_at']),
            ),
      contextType: asString(row['context_type']),
      contextId: asString(row['context_id']),
    );
  }
}

class MessagePreview {
  const MessagePreview({
    required this.preview,
    this.id,
    this.senderId,
    this.senderName,
    this.createdAt,
  });

  final String preview;
  final String? id;
  final String? senderId;
  final String? senderName;
  final DateTime? createdAt;

  factory MessagePreview.fromJson(Map<String, dynamic> json) {
    return MessagePreview(
      preview: asString(json['preview']) ?? '',
      id: asString(json['id']),
      senderId: asString(json['senderId']),
      senderName: asString(json['senderName']),
      createdAt: asDateTime(json['createdAt']),
    );
  }
}

/// A conversation opened for reading, including what the viewer may do in it.
class ConversationDetail {
  const ConversationDetail({
    required this.id,
    required this.kind,
    required this.title,
    required this.participants,
    required this.canSend,
    this.description,
    this.locked = false,
    this.muted = false,
    this.sendBlockedReason,
    this.canLeave = false,
    this.participantsDerived = false,
    this.contextType,
    this.contextId,
  });

  final String id;
  final String kind;
  final String title;
  final List<ConversationMember> participants;
  final bool canSend;
  final String? description;
  final bool locked;
  final bool muted;
  final String? sendBlockedReason;
  final bool canLeave;
  final bool participantsDerived;
  final String? contextType;
  final String? contextId;

  String get kindLabel => conversationKindLabel(kind);

  /// The domain object behind this conversation, if the client can open it.
  String? get contextRoute {
    final id = contextId;
    if (id == null) {
      return null;
    }
    switch (contextType?.toUpperCase()) {
      case 'BOOKING':
        return '/app/services/bookings/$id';
      case 'ORGANIZATION':
        return '/app/explore/organization/$id';
      case 'COURSE_OFFERING':
        return '/app/learn/course/$id';
      case 'CLASS':
        return '/app/class/$id';
      case 'STUDY_GROUP':
        return '/app/learn/study-group/$id';
      default:
        return null;
    }
  }

  factory ConversationDetail.fromJson(Map<String, dynamic> json) {
    return ConversationDetail(
      id: asString(json['id']) ?? '',
      kind: asString(json['kind']) ?? 'DIRECT',
      title: asString(json['title']) ?? 'Conversation',
      participants:
          asJsonMapList(json['participants']).map(ConversationMember.fromJson).toList(),
      canSend: json['canSend'] == null ? true : asBool(json['canSend']),
      description: asString(json['description']),
      locked: asBool(json['locked']),
      muted: asBool(json['muted']),
      sendBlockedReason: asString(json['sendBlockedReason']),
      canLeave: asBool(json['canLeave']),
      participantsDerived: asBool(json['participantsDerived']),
      contextType: asString(json['contextType']),
      contextId: asString(json['contextId']),
    );
  }
}

class ConversationMember {
  const ConversationMember({
    required this.personId,
    required this.displayName,
    this.username,
    this.photoFileId,
  });

  final String personId;
  final String displayName;
  final String? username;
  final String? photoFileId;

  factory ConversationMember.fromJson(Map<String, dynamic> json) {
    return ConversationMember(
      personId: asString(json['personId']) ?? '',
      displayName: asString(json['displayName']) ?? 'Someone',
      username: asString(json['username']),
      photoFileId: asString(json['photoFileId']),
    );
  }
}

String conversationKindLabel(String kind) {
  switch (kind.toUpperCase()) {
    case 'DIRECT':
      return 'Direct message';
    case 'GROUP':
      return 'Group';
    case 'CLASS':
      return 'Class';
    case 'COURSE':
      return 'Course';
    case 'STUDY_GROUP':
      return 'Study group';
    case 'ORGANIZATION':
      return 'Organization';
    case 'SERVICE':
      return 'Booking';
    default:
      return 'Conversation';
  }
}
