import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/conversation.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/message.dart';
import 'package:uuid/uuid.dart';

/// One page of the conversation inbox. `fromCache` is what the offline banner
/// reflects, so it is only ever true when the rows came from the database.
class ConversationInbox {
  const ConversationInbox({
    required this.items,
    this.nextCursor,
    this.fromCache = false,
    this.syncedAt,
  });

  final List<ConversationSummary> items;
  final String? nextCursor;
  final bool fromCache;
  final DateTime? syncedAt;

  bool get hasMore => nextCursor != null;
}

/// One page of a thread. Items are newest-first, matching both the server's
/// ordering and [AppDatabase.messagesForConversation].
class MessagePage {
  const MessagePage({
    required this.items,
    this.nextCursor,
    this.fromCache = false,
    this.lastReadAt,
    this.syncedAt,
  });

  final List<ChatMessage> items;
  final String? nextCursor;
  final bool fromCache;
  final DateTime? lastReadAt;
  final DateTime? syncedAt;

  bool get hasMore => nextCursor != null;
}

class MessagingRepository {
  MessagingRepository({
    required ApiClient api,
    required AppDatabase database,
  })  : _api = api,
        _database = database;

  final ApiClient _api;
  final AppDatabase _database;

  static const _inboxSyncedAtKey = 'messaging_synced_at';

  /// The idempotency key the server deduplicates on. The caller generates one
  /// per composed message and reuses it for every retry, so a send that timed
  /// out after the server accepted it returns the original message instead of
  /// posting a second copy.
  static String newClientActionId() => const Uuid().v4();

  Future<ConversationInbox> inbox({required bool online, String? cursor}) async {
    if (!online) {
      if (cursor != null) {
        throw const ApiError(code: 'OFFLINE', message: _offlineMessage);
      }
      return _cachedInbox();
    }
    try {
      final body = await _api.get(
        'conversations',
        query: {if (cursor != null) 'cursor': cursor},
      );
      final items =
          asJsonMapList(body['items']).map(ConversationSummary.fromJson).toList();
      DateTime? syncedAt;
      if (cursor == null) {
        // `replaceConversations` clears the table, so only the first page may
        // write it; a later page would otherwise wipe the rows above it.
        await _database.replaceConversations(items);
        syncedAt = DateTime.now();
        await _database.setMeta(_inboxSyncedAtKey, syncedAt.toIso8601String());
      }
      return ConversationInbox(
        items: items,
        nextCursor: asString(body['nextCursor']),
        syncedAt: syncedAt,
      );
    } on ApiError {
      // The cache cannot continue a server cursor, so only the first page falls
      // back to it; a failed later page is reported to the caller.
      if (cursor != null) {
        rethrow;
      }
      return _cachedInbox();
    }
  }

  /// The cache only holds a [ConversationSummary], so an offline detail is
  /// rebuilt from it. `canSend` stays true because the client genuinely does
  /// not know the answer offline; the server re-checks on every send and an
  /// unsent message is shown as pending rather than delivered.
  Future<ConversationDetail> conversation(String id, {required bool online}) async {
    if (!online) {
      return _cachedConversation(id);
    }
    try {
      return ConversationDetail.fromJson(await _api.get('conversations/$id'));
    } on ApiError catch (error) {
      if (error.isNotFound || error.isPermissionDenied) {
        rethrow;
      }
      return _cachedConversation(id);
    }
  }

  Future<MessagePage> messages(
    String conversationId, {
    String? cursor,
    required bool online,
  }) async {
    if (!online) {
      if (cursor != null) {
        throw const ApiError(code: 'OFFLINE', message: _offlineMessage);
      }
      return _cachedMessages(conversationId);
    }
    try {
      // `limit` is deliberately omitted: the server validates it with @IsInt()
      // and the global ValidationPipe does not implicitly convert query
      // strings, so sending it would be rejected. The default page is 40.
      final body = await _api.get(
        'conversations/$conversationId/messages',
        query: {if (cursor != null) 'cursor': cursor},
      );
      final items = asJsonMapList(body['items']).map(ChatMessage.fromJson).toList();
      final nextCursor = asString(body['nextCursor']);
      final lastReadAt = asDateTime(body['lastReadAt']);
      if (cursor != null) {
        return MessagePage(
          items: items,
          nextCursor: nextCursor,
          lastReadAt: lastReadAt,
        );
      }
      await _database.upsertMessages(items);
      final syncedAt = DateTime.now();
      await _database.setMeta(
        _messagesSyncedAtKey(conversationId),
        syncedAt.toIso8601String(),
      );
      return MessagePage(
        items: [...await _unsent(conversationId, items), ...items],
        nextCursor: nextCursor,
        lastReadAt: lastReadAt,
        syncedAt: syncedAt,
      );
    } on ApiError {
      if (cursor != null) {
        rethrow;
      }
      return _cachedMessages(conversationId);
    }
  }

  /// Posts a message. [clientActionId] must be the same value on every retry of
  /// the same composed message.
  Future<ChatMessage> send({
    required String conversationId,
    required String body,
    required String clientActionId,
    String? replyToMessageId,
    List<String> mentionPersonIds = const [],
    String messageType = 'TEXT',
  }) async {
    final payload = await _api.post(
      'conversations/$conversationId/messages',
      data: {
        'body': body,
        'messageType': messageType,
        'clientActionId': clientActionId,
        if (replyToMessageId != null) 'replyToMessageId': replyToMessageId,
        if (mentionPersonIds.isNotEmpty) 'mentionPersonIds': mentionPersonIds,
      },
    );
    final message = ChatMessage.fromJson(payload);
    await _database.upsertMessages([message]);
    return message;
  }

  /// Persists an outgoing message that has not been accepted yet, so a pending
  /// or failed message survives a restart and can still be retried.
  Future<void> cacheOutgoing(ChatMessage message) {
    return _database.upsertMessages([message]);
  }

  /// Drops the local placeholder once the server has given us the real row.
  Future<void> discardOutgoing(String messageId) {
    return _database.deleteMessage(messageId);
  }

  Future<ChatMessage> edit(String messageId, String body) async {
    final payload = await _api.patch('messages/$messageId', data: {'body': body});
    final message = ChatMessage.fromJson(payload);
    await _database.upsertMessages([message]);
    return message;
  }

  Future<void> remove(String messageId) async {
    await _api.delete('messages/$messageId');
    await _database.deleteMessage(messageId);
  }

  /// Reactions toggle. Returns true when the reaction is now on the message.
  Future<bool> react(String messageId, String reaction) async {
    final body = await _api.post(
      'messages/$messageId/reactions',
      data: {'reaction': reaction},
    );
    return asBool(body['reacted']);
  }

  Future<void> report(
    String messageId, {
    required String reason,
    String? details,
  }) async {
    await _api.post(
      'messages/$messageId/report',
      data: {
        'reason': reason,
        if (details != null && details.trim().isNotEmpty) 'details': details.trim(),
      },
    );
  }

  /// Returns false when the read could not be confirmed with the server, so
  /// callers never claim it was recorded anywhere but this device.
  ///
  /// [lastMessageId] is sent for forward compatibility; the current server
  /// stamps the read state with its own clock and ignores the body.
  Future<bool> markRead(String conversationId, {String? lastMessageId}) async {
    try {
      await _api.post(
        'conversations/$conversationId/read',
        data: {if (lastMessageId != null) 'lastMessageId': lastMessageId},
      );
      return true;
    } on ApiError {
      return false;
    }
  }

  Future<bool> mute(String conversationId) async {
    final body = await _api.post('conversations/$conversationId/mute');
    return asBool(body['muted']);
  }

  Future<bool> unmute(String conversationId) async {
    final body = await _api.post('conversations/$conversationId/unmute');
    return asBool(body['muted']);
  }

  Future<void> leave(String conversationId) async {
    await _api.post('conversations/$conversationId/leave');
  }

  /// Finds or creates the direct thread with [personId] and returns its id.
  Future<String> openDirect(String personId) async {
    final body = await _api.post(
      'conversations/direct',
      data: {'personId': personId},
    );
    final id = asString(body['id']);
    if (id == null) {
      throw const ApiError(
        code: 'HTTP_ERROR',
        message: ApiError.genericMessage,
      );
    }
    return id;
  }

  Future<ConversationInbox> _cachedInbox() async {
    return ConversationInbox(
      items: await _database.conversations(),
      fromCache: true,
      syncedAt: asDateTime(await _database.meta(_inboxSyncedAtKey)),
    );
  }

  Future<ConversationDetail> _cachedConversation(String id) async {
    final cached = await _database.conversationById(id);
    if (cached == null) {
      throw const ApiError(
        code: 'NOT_FOUND',
        message: "This conversation hasn't been synced to this device yet. "
            'Reconnect to open it.',
      );
    }
    return ConversationDetail(
      id: cached.id,
      kind: cached.kind,
      title: cached.title,
      participants: const [],
      canSend: true,
      muted: cached.muted,
      contextType: cached.contextType,
      contextId: cached.contextId,
    );
  }

  Future<MessagePage> _cachedMessages(String conversationId) async {
    return MessagePage(
      items: await _database.messagesForConversation(conversationId),
      fromCache: true,
      syncedAt: asDateTime(
        await _database.meta(_messagesSyncedAtKey(conversationId)),
      ),
    );
  }

  /// Outgoing messages the server has not confirmed. They are kept in front of
  /// a freshly fetched page so a pending or failed message is never quietly
  /// dropped by a refresh.
  Future<List<ChatMessage>> _unsent(
    String conversationId,
    List<ChatMessage> fetched,
  ) async {
    final knownIds = fetched.map((item) => item.id).toSet();
    final knownActionIds = fetched
        .map((item) => item.clientActionId)
        .whereType<String>()
        .toSet();
    final cached = await _database.messagesForConversation(conversationId);
    final pending = <ChatMessage>[];
    for (final message in cached) {
      if (message.delivery == MessageDelivery.sent) {
        continue;
      }
      if (knownIds.contains(message.id)) {
        continue;
      }
      final actionId = message.clientActionId;
      if (actionId != null && knownActionIds.contains(actionId)) {
        // The server already has it under its own id; drop the placeholder.
        await _database.deleteMessage(message.id);
        continue;
      }
      pending.add(message);
    }
    return pending;
  }

  static String _messagesSyncedAtKey(String conversationId) =>
      'messaging_messages_synced_at.$conversationId';

  static const _offlineMessage =
      "You're offline. Showing recently synced information.";
}
