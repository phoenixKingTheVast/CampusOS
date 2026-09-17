import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/messaging/data/messaging_repository.dart';
import 'package:campusos/shared/models/conversation.dart';
import 'package:campusos/shared/models/message.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class MessagingInboxState {
  const MessagingInboxState({
    required this.conversations,
    this.nextCursor,
    this.fromCache = false,
    this.lastUpdated,
    this.loadingMore = false,
  });

  final List<ConversationSummary> conversations;
  final String? nextCursor;
  final bool fromCache;
  final DateTime? lastUpdated;
  final bool loadingMore;

  bool get hasMore => nextCursor != null;

  MessagingInboxState copyWith({
    List<ConversationSummary>? conversations,
    bool? loadingMore,
  }) {
    return MessagingInboxState(
      conversations: conversations ?? this.conversations,
      nextCursor: nextCursor,
      fromCache: fromCache,
      lastUpdated: lastUpdated,
      loadingMore: loadingMore ?? this.loadingMore,
    );
  }
}

class ConversationState {
  const ConversationState({
    required this.detail,
    required this.messages,
    this.nextCursor,
    this.fromCache = false,
    this.lastUpdated,
    this.loadingOlder = false,
    this.notice,
    this.noticeIsError = false,
    this.readUpTo,
  });

  final ConversationDetail detail;

  /// Newest first, matching the server's ordering. The list is rendered
  /// reversed so index 0 sits at the bottom of the screen.
  final List<ChatMessage> messages;
  final String? nextCursor;
  final bool fromCache;
  final DateTime? lastUpdated;
  final bool loadingOlder;
  final String? notice;
  final bool noticeIsError;

  /// Where the viewer had read up to when the conversation was opened, kept
  /// across refreshes so the "New messages" marker does not jump.
  final DateTime? readUpTo;

  bool get hasMore => nextCursor != null;

  ConversationState copyWith({
    ConversationDetail? detail,
    List<ChatMessage>? messages,
    bool? loadingOlder,
    String? notice,
    bool? noticeIsError,
    bool clearNotice = false,
  }) {
    return ConversationState(
      detail: detail ?? this.detail,
      messages: messages ?? this.messages,
      nextCursor: nextCursor,
      fromCache: fromCache,
      lastUpdated: lastUpdated,
      loadingOlder: loadingOlder ?? this.loadingOlder,
      notice: clearNotice ? null : (notice ?? this.notice),
      noticeIsError: noticeIsError ?? this.noticeIsError,
      readUpTo: readUpTo,
    );
  }
}

final messagingInboxProvider =
    AsyncNotifierProvider<MessagingInboxController, MessagingInboxState>(
  MessagingInboxController.new,
);

class MessagingInboxController extends AsyncNotifier<MessagingInboxState> {
  @override
  Future<MessagingInboxState> build() async {
    final online = ref.watch(connectivityProvider).isOnline;
    return _stateFrom(await ref.read(messagingRepositoryProvider).inbox(online: online));
  }

  Future<void> refresh() async {
    final previous = state.asData?.value;
    try {
      final page = await ref
          .read(messagingRepositoryProvider)
          .inbox(online: ref.read(connectivityProvider).isOnline);
      state = AsyncData(_stateFrom(page));
    } catch (error, stack) {
      if (previous == null) {
        state = AsyncError(error, stack);
        return;
      }
      state = AsyncData(previous);
    }
  }

  Future<void> loadMore() async {
    final current = state.asData?.value;
    final cursor = current?.nextCursor;
    if (current == null || cursor == null || current.loadingMore) {
      return;
    }
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final page = await ref.read(messagingRepositoryProvider).inbox(
            online: ref.read(connectivityProvider).isOnline,
            cursor: cursor,
          );
      state = AsyncData(
        MessagingInboxState(
          conversations: [...current.conversations, ...page.items],
          nextCursor: page.nextCursor,
          fromCache: current.fromCache,
          lastUpdated: current.lastUpdated,
        ),
      );
    } on ApiError {
      state = AsyncData(current.copyWith(loadingMore: false));
    }
  }

  MessagingInboxState _stateFrom(ConversationPage page) {
    return MessagingInboxState(
      conversations: page.items,
      nextCursor: page.nextCursor,
      fromCache: page.fromCache,
      lastUpdated: page.lastUpdated,
    );
  }
}

final conversationProvider =
    AsyncNotifierProvider.family<ConversationController, ConversationState, String>(
  ConversationController.new,
);

class ConversationController extends FamilyAsyncNotifier<ConversationState, String> {
  @override
  Future<ConversationState> build(String conversationId) async {
    final online = ref.watch(connectivityProvider).isOnline;
    final repository = ref.read(messagingRepositoryProvider);
    final detail = await repository.conversation(conversationId, online: online);
    final page = await repository.messages(conversationId, online: online);
    return ConversationState(
      detail: detail,
      messages: page.items,
      nextCursor: page.nextCursor,
      fromCache: page.fromCache,
      lastUpdated: page.lastUpdated,
      readUpTo: page.lastReadAt,
    );
  }

  /// Confirms the read position and brings the inbox counts in line with it.
  Future<void> markRead() async {
    try {
      await ref.read(messagingRepositoryProvider).markRead(arg);
    } on ApiError {
      return;
    }
    await ref.read(messagingInboxProvider.notifier).refresh();
  }

  Future<void> refresh() async {
    final current = state.asData?.value;
    if (current == null) {
      ref.invalidateSelf();
      return;
    }
    final online = ref.read(connectivityProvider).isOnline;
    final repository = ref.read(messagingRepositoryProvider);
    try {
      final detail = await repository.conversation(arg, online: online);
      final page = await repository.messages(arg, online: online);
      final known = current.messages.map((item) => item.id).toSet();
      final arrived = page.items.any((item) => !known.contains(item.id));
      state = AsyncData(
        ConversationState(
          detail: detail,
          messages: page.items,
          nextCursor: page.nextCursor,
          fromCache: page.fromCache,
          lastUpdated: page.lastUpdated,
          readUpTo: current.readUpTo,
        ),
      );
      if (arrived) {
        await markRead();
      }
    } on ApiError catch (error) {
      state = AsyncData(current.copyWith(notice: error.message, noticeIsError: true));
    }
  }

  Future<void> loadOlder() async {
    final current = state.asData?.value;
    final cursor = current?.nextCursor;
    if (current == null || cursor == null || current.loadingOlder) {
      return;
    }
    state = AsyncData(current.copyWith(loadingOlder: true, clearNotice: true));
    try {
      final page = await ref.read(messagingRepositoryProvider).messages(
            arg,
            online: ref.read(connectivityProvider).isOnline,
            cursor: cursor,
          );
      state = AsyncData(
        ConversationState(
          detail: current.detail,
          messages: [...current.messages, ...page.items],
          nextCursor: page.nextCursor,
          fromCache: current.fromCache,
          lastUpdated: current.lastUpdated,
          readUpTo: current.readUpTo,
        ),
      );
    } on ApiError catch (error) {
      state = AsyncData(
        current.copyWith(
          loadingOlder: false,
          notice: error.message,
          noticeIsError: true,
        ),
      );
    }
  }

  Future<void> send(String text) async {
    final current = state.asData?.value;
    final body = text.trim();
    if (current == null || body.isEmpty) {
      return;
    }
    final person = ref.read(sessionProvider).person;
    final repository = ref.read(messagingRepositoryProvider);
    final draft = repository.draft(
      conversationId: arg,
      body: body,
      senderId: person?.id ?? '',
      senderName: person?.displayName,
    );
    await repository.queue(draft);
    state = AsyncData(
      current.copyWith(messages: [draft, ...current.messages], clearNotice: true),
    );
    await _deliver(draft);
  }

  /// Retrying reuses the draft's `clientActionId`, so a message the server did
  /// receive comes back deduplicated instead of being posted twice.
  Future<void> retry(ChatMessage message) async {
    final current = state.asData?.value;
    if (current == null) {
      return;
    }
    final pending = message.copyWith(delivery: MessageDelivery.pending);
    await ref.read(messagingRepositoryProvider).queue(pending);
    state = AsyncData(
      current.copyWith(
        messages: _replace(current.messages, message.id, pending),
        clearNotice: true,
      ),
    );
    await _deliver(pending);
  }

  Future<void> edit(ChatMessage message, String body) async {
    final current = state.asData?.value;
    if (current == null) {
      return;
    }
    try {
      final updated = await ref.read(messagingRepositoryProvider).edit(message, body);
      _replaceMessage(message.id, updated);
    } on ApiError catch (error) {
      _showNotice(error.message, isError: true);
    }
  }

  Future<void> remove(ChatMessage message) async {
    try {
      final removed = await ref.read(messagingRepositoryProvider).remove(message);
      _replaceMessage(message.id, removed);
    } on ApiError catch (error) {
      _showNotice(error.message, isError: true);
    }
  }

  Future<void> toggleReaction(ChatMessage message, String reaction) async {
    try {
      final updated = await ref.read(messagingRepositoryProvider).react(message, reaction);
      _replaceMessage(message.id, updated);
    } on ApiError catch (error) {
      _showNotice(error.message, isError: true);
    }
  }

  Future<void> report(ChatMessage message, {required String reason, String? details}) async {
    try {
      await ref
          .read(messagingRepositoryProvider)
          .report(message.id, reason: reason, details: details);
      _showNotice('Report sent. A moderator will review this message.');
    } on ApiError catch (error) {
      _showNotice(error.message, isError: true);
    }
  }

  Future<void> setMuted({required bool muted}) async {
    final repository = ref.read(messagingRepositoryProvider);
    try {
      await repository.setMuted(arg, muted: muted);
      final detail = await repository.conversation(arg, online: true);
      final current = state.asData?.value;
      if (current != null) {
        state = AsyncData(current.copyWith(detail: detail, clearNotice: true));
      }
      await ref.read(messagingInboxProvider.notifier).refresh();
    } on ApiError catch (error) {
      _showNotice(error.message, isError: true);
    }
  }

  Future<bool> leave() async {
    try {
      await ref.read(messagingRepositoryProvider).leave(arg);
    } on ApiError catch (error) {
      _showNotice(error.message, isError: true);
      return false;
    }
    await ref.read(messagingInboxProvider.notifier).refresh();
    return true;
  }

  void dismissNotice() {
    final current = state.asData?.value;
    if (current == null || current.notice == null) {
      return;
    }
    state = AsyncData(current.copyWith(clearNotice: true));
  }

  Future<void> _deliver(ChatMessage draft) async {
    if (!ref.read(connectivityProvider).isOnline) {
      _showNotice("You're offline. This message stays here until it is sent.");
      return;
    }
    try {
      final sent = await ref.read(messagingRepositoryProvider).deliver(draft);
      _replaceMessage(draft.id, sent);
      await ref.read(messagingInboxProvider.notifier).refresh();
    } on ApiError catch (error) {
      _replaceMessage(draft.id, draft.copyWith(delivery: MessageDelivery.failed));
      _showNotice(error.message, isError: true);
    }
  }

  void _replaceMessage(String id, ChatMessage replacement) {
    final current = state.asData?.value;
    if (current == null) {
      return;
    }
    state = AsyncData(
      current.copyWith(messages: _replace(current.messages, id, replacement)),
    );
  }

  void _showNotice(String message, {bool isError = false}) {
    final current = state.asData?.value;
    if (current == null) {
      return;
    }
    state = AsyncData(current.copyWith(notice: message, noticeIsError: isError));
  }
}

List<ChatMessage> _replace(List<ChatMessage> messages, String id, ChatMessage replacement) {
  return [
    for (final item in messages)
      if (item.id == id) replacement else item,
  ];
}
