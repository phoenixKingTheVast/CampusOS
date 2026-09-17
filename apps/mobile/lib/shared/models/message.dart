import 'package:campusos/shared/models/json_map.dart';

/// Local-only delivery state. An outgoing message queued while offline is shown
/// as pending rather than pretending it reached the server.
enum MessageDelivery { sent, pending, failed }

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.body,
    required this.mine,
    required this.createdAt,
    this.senderName,
    this.senderPhotoFileId,
    this.messageType = 'TEXT',
    this.replyToMessageId,
    this.status = 'SENT',
    this.clientActionId,
    this.editedAt,
    this.removed = false,
    this.removedLabel,
    this.canEdit = false,
    this.canRemove = false,
    this.resourceId,
    this.reactions = const [],
    this.mentionPersonIds = const [],
    this.delivery = MessageDelivery.sent,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String body;
  final bool mine;
  final DateTime createdAt;
  final String? senderName;
  final String? senderPhotoFileId;
  final String messageType;
  final String? replyToMessageId;
  final String status;
  final String? clientActionId;
  final DateTime? editedAt;
  final bool removed;
  final String? removedLabel;
  final bool canEdit;
  final bool canRemove;
  final String? resourceId;
  final List<MessageReaction> reactions;
  final List<String> mentionPersonIds;
  final MessageDelivery delivery;

  bool get edited => editedAt != null;

  /// Explicit, non-colour state text. VoiceOver reads this instead of inferring
  /// anything from bubble alignment or tint.
  String get deliveryLabel {
    switch (delivery) {
      case MessageDelivery.pending:
        return 'Waiting to send';
      case MessageDelivery.failed:
        return 'Not sent';
      case MessageDelivery.sent:
        return 'Sent';
    }
  }

  String semanticLabel(String timeLabel) {
    final parts = <String>[
      mine ? 'You' : (senderName ?? 'Someone'),
      removed ? (removedLabel ?? 'Message removed') : body,
      timeLabel,
    ];
    if (edited) {
      parts.add('Edited');
    }
    if (mine && delivery != MessageDelivery.sent) {
      parts.add(deliveryLabel);
    }
    for (final reaction in reactions) {
      parts.add('${reaction.reaction} ${reaction.count}');
    }
    return parts.join('. ');
  }

  ChatMessage copyWith({MessageDelivery? delivery, String? id, String? body}) {
    return ChatMessage(
      id: id ?? this.id,
      conversationId: conversationId,
      senderId: senderId,
      body: body ?? this.body,
      mine: mine,
      createdAt: createdAt,
      senderName: senderName,
      senderPhotoFileId: senderPhotoFileId,
      messageType: messageType,
      replyToMessageId: replyToMessageId,
      status: status,
      clientActionId: clientActionId,
      editedAt: editedAt,
      removed: removed,
      removedLabel: removedLabel,
      canEdit: canEdit,
      canRemove: canRemove,
      resourceId: resourceId,
      reactions: reactions,
      mentionPersonIds: mentionPersonIds,
      delivery: delivery ?? this.delivery,
    );
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: asString(json['id']) ?? '',
      conversationId: asString(json['conversationId']) ?? '',
      senderId: asString(json['senderId']) ?? '',
      body: asString(json['body']) ?? '',
      mine: asBool(json['mine']),
      createdAt: asDateTime(json['createdAt']) ?? DateTime.now(),
      senderName: asString(json['senderName']),
      senderPhotoFileId: asString(json['senderPhotoFileId']),
      messageType: asString(json['messageType']) ?? 'TEXT',
      replyToMessageId: asString(json['replyToMessageId']),
      status: asString(json['status']) ?? 'SENT',
      clientActionId: asString(json['clientActionId']),
      editedAt: asDateTime(json['editedAt']),
      removed: asBool(json['removed']),
      removedLabel: asString(json['removedLabel']),
      canEdit: asBool(json['canEdit']),
      canRemove: asBool(json['canRemove']),
      resourceId: asString(json['resourceId']),
      reactions: asJsonMapList(json['reactions']).map(MessageReaction.fromJson).toList(),
      mentionPersonIds: asStringList(json['mentionPersonIds']),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'conversation_id': conversationId,
      'sender_id': senderId,
      'sender_name': senderName,
      'body': body,
      'message_type': messageType,
      'mine': mine ? 1 : 0,
      'status': status,
      'client_action_id': clientActionId,
      'reply_to_message_id': replyToMessageId,
      'created_at': createdAt.toIso8601String(),
      'edited_at': editedAt?.toIso8601String(),
      'removed': removed ? 1 : 0,
      'delivery': delivery.name,
    };
  }

  factory ChatMessage.fromRow(Map<String, Object?> row) {
    final delivery = asString(row['delivery']);
    return ChatMessage(
      id: asString(row['id']) ?? '',
      conversationId: asString(row['conversation_id']) ?? '',
      senderId: asString(row['sender_id']) ?? '',
      body: asString(row['body']) ?? '',
      mine: asBool(row['mine']),
      createdAt: asDateTime(row['created_at']) ?? DateTime.now(),
      senderName: asString(row['sender_name']),
      messageType: asString(row['message_type']) ?? 'TEXT',
      replyToMessageId: asString(row['reply_to_message_id']),
      status: asString(row['status']) ?? 'SENT',
      clientActionId: asString(row['client_action_id']),
      editedAt: asDateTime(row['edited_at']),
      removed: asBool(row['removed']),
      removedLabel: asBool(row['removed']) ? 'Message removed' : null,
      delivery: MessageDelivery.values.firstWhere(
        (value) => value.name == delivery,
        orElse: () => MessageDelivery.sent,
      ),
    );
  }
}

class MessageReaction {
  const MessageReaction({
    required this.reaction,
    required this.count,
    required this.mine,
  });

  final String reaction;
  final int count;
  final bool mine;

  factory MessageReaction.fromJson(Map<String, dynamic> json) {
    return MessageReaction(
      reaction: asString(json['reaction']) ?? '',
      count: asInt(json['count']) ?? 0,
      mine: asBool(json['mine']),
    );
  }
}

/// The reaction palette the client offers. The server accepts any short string,
/// so this is presentation only.
const messageReactionPalette = <String>['👍', '❤️', '🎉', '🙏', '😂', '👀'];

/// Keys match the server's `ReportReason` enum.
const messageReportReasons = <String, String>{
  'SPAM': 'Spam',
  'HARASSMENT': 'Harassment',
  'INAPPROPRIATE_CONTENT': 'Inappropriate content',
  'ACADEMIC_MISCONDUCT': 'Academic misconduct',
  'MISLEADING': 'Misleading information',
  'OTHER': 'Something else',
};
