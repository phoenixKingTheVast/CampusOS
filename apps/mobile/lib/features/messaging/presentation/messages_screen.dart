import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/home/domain/home_presentation.dart';
import 'package:campusos/features/messaging/providers.dart';
import 'package:campusos/shared/models/conversation.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/person_avatar.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key});

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) {
      return;
    }
    final position = _scroll.position;
    if (position.pixels >= position.maxScrollExtent - 320) {
      ref.read(messagingInboxProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(messagingInboxProvider);
    final online = ref.watch(connectivityProvider).isOnline;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          Semantics(
            button: true,
            label: 'Refresh conversations',
            child: IconButton(
              onPressed: () => ref.read(messagingInboxProvider.notifier).refresh(),
              icon: const Icon(Icons.refresh_rounded),
            ),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorRetry(
          message: error is ApiError ? error.message : ApiError.genericMessage,
          onRetry: () => ref.invalidate(messagingInboxProvider),
        ),
        data: (state) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: OfflineBanner(
                visible: !online || state.fromCache,
                lastUpdated: HomePresentation.lastUpdatedLabel(state.lastUpdated),
              ),
            ),
            if (state.conversations.isEmpty)
              const Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: EmptyState(
                    title: 'No conversations yet',
                    subtitle:
                        'Direct messages, class and course threads, and booking conversations all appear here.',
                  ),
                ),
              )
            else
              Expanded(
                child: ListView.separated(
                  controller: _scroll,
                  padding: const EdgeInsets.only(bottom: 24),
                  itemCount: state.conversations.length + (state.hasMore ? 1 : 0),
                  separatorBuilder: (_, __) => const Divider(
                    height: 1,
                    thickness: 1,
                    color: AppColors.line,
                  ),
                  itemBuilder: (context, index) {
                    if (index == state.conversations.length) {
                      return const _LoadingMore();
                    }
                    final item = state.conversations[index];
                    return _ConversationRow(
                      item: item,
                      onOpen: () => context.push(item.route),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ConversationRow extends StatelessWidget {
  const _ConversationRow({required this.item, required this.onOpen});

  final ConversationSummary item;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final preview = item.lastMessage;
    final activity = item.lastActivityAt;
    return Semantics(
      button: true,
      label: item.accessibilityLabel == null
          ? item.semanticLabel
          : '${item.accessibilityLabel}. ${item.kindLabel}',
      child: InkWell(
        onTap: onOpen,
        child: ExcludeSemantics(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                PersonAvatar(initials: conversationInitials(item.title), size: 42),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: item.hasUnread ? FontWeight.w700 : FontWeight.w600,
                          color: AppColors.navy,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        item.kindLabel,
                        style: const TextStyle(fontSize: 12, color: AppColors.muted),
                      ),
                      if (preview != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          preview.senderName == null
                              ? preview.preview
                              : '${preview.senderName}: ${preview.preview}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, color: AppColors.muted),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (activity != null)
                      Text(
                        formatRelative(activity),
                        style: const TextStyle(fontSize: 12, color: AppColors.muted),
                      ),
                    if (item.hasUnread) ...[
                      const SizedBox(height: 8),
                      UnreadDot(count: item.unreadCount),
                    ],
                    if (item.muted) ...[
                      const SizedBox(height: 8),
                      const Text(
                        'Muted',
                        style: TextStyle(fontSize: 12, color: AppColors.muted),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LoadingMore extends StatelessWidget {
  const _LoadingMore();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading more conversations',
      child: const Padding(
        padding: EdgeInsets.all(20),
        child: Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

/// Initials for a conversation title. Group and course threads have no single
/// person behind them, so the title itself is used.
String conversationInitials(String title) {
  final parts = title.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) {
    return 'C';
  }
  if (parts.length == 1) {
    return parts.first.substring(0, 1).toUpperCase();
  }
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
}
