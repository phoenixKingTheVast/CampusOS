import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/home/domain/home_presentation.dart';
import 'package:campusos/features/messaging/providers.dart';
import 'package:campusos/shared/models/conversation.dart';
import 'package:campusos/shared/models/message.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final ScrollController _scroll = ScrollController();
  final TextEditingController _composer = TextEditingController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    // Re-opening a conversation that is still cached in memory does not reload
    // it, so the read position is confirmed here as well as on first load.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && ref.read(conversationProvider(widget.conversationId)).hasValue) {
        _controller.markRead();
      }
    });
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _composer.dispose();
    super.dispose();
  }

  ConversationController get _controller =>
      ref.read(conversationProvider(widget.conversationId).notifier);

  /// The list is reversed, so its far end holds the oldest message.
  void _onScroll() {
    if (!_scroll.hasClients) {
      return;
    }
    final position = _scroll.position;
    if (position.pixels >= position.maxScrollExtent - 240) {
      _controller.loadOlder();
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = conversationProvider(widget.conversationId);
    final async = ref.watch(provider);
    final online = ref.watch(connectivityProvider).isOnline;
    ref.listen(provider, (previous, next) {
      if (previous?.hasValue != true && next.hasValue) {
        _controller.markRead();
      }
    });
    final detail = async.asData?.value.detail;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          detail?.title ?? 'Conversation',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          Semantics(
            button: true,
            label: 'Refresh conversation',
            child: IconButton(
              onPressed: () => _controller.refresh(),
              icon: const Icon(Icons.refresh_rounded),
            ),
          ),
          if (detail != null) _optionsMenu(detail),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorRetry(
          message: error is ApiError ? error.message : ApiError.genericMessage,
          onRetry: () => ref.invalidate(provider),
        ),
        data: (state) => _body(state, online: online),
      ),
    );
  }

  Widget _optionsMenu(ConversationDetail detail) {
    return Semantics(
      button: true,
      label: 'Conversation options',
      child: PopupMenuButton<String>(
        icon: const Icon(Icons.more_horiz_rounded),
        itemBuilder: (context) => [
          PopupMenuItem<String>(
            value: 'mute',
            child: Text(detail.muted ? 'Unmute notifications' : 'Mute notifications'),
          ),
          if (detail.participants.isNotEmpty)
            const PopupMenuItem<String>(
              value: 'participants',
              child: Text('View participants'),
            ),
          if (detail.canLeave)
            const PopupMenuItem<String>(
              value: 'leave',
              child: Text('Leave conversation'),
            ),
        ],
        onSelected: (value) {
          if (value == 'mute') {
            _controller.setMuted(muted: !detail.muted);
            return;
          }
          if (value == 'participants') {
            _showParticipants(detail);
            return;
          }
          if (value == 'leave') {
            _leave();
          }
        },
      ),
    );
  }

  Widget _body(ConversationState state, {required bool online}) {
    final detail = state.detail;
    final notice = state.notice;
    final boundary = _unreadBoundary(state.messages, state.readUpTo);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Column(
            children: [
              OfflineBanner(
                visible: !online || state.fromCache,
                lastUpdated: HomePresentation.lastUpdatedLabel(state.lastUpdated),
              ),
              if (notice != null)
                PendingActionBanner(message: notice, isError: state.noticeIsError),
            ],
          ),
        ),
        _ContextHeader(
          detail: detail,
          onOpenContext: () {
            final route = detail.contextRoute;
            if (route != null) {
              context.push(route);
            }
          },
        ),
        if (state.messages.isEmpty)
          const Expanded(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: EmptyState(
                title: 'No messages yet',
                subtitle: 'Anything sent here is visible to everyone in the conversation.',
              ),
            ),
          )
        else
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              reverse: true,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              itemCount: state.messages.length + (state.hasMore ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == state.messages.length) {
                  return _OlderMessages(
                    loading: state.loadingOlder,
                    onLoad: () => _controller.loadOlder(),
                  );
                }
                final message = state.messages[index];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (index == boundary) const SectionHeader('New messages'),
                    _MessageRow(
                      message: message,
                      showSender: !message.mine && detail.kind.toUpperCase() != 'DIRECT',
                      onActions: () => _showActions(message),
                      onRetry: () => _controller.retry(message),
                      onReact: (reaction) => _controller.toggleReaction(message, reaction),
                    ),
                  ],
                );
              },
            ),
          ),
        SafeArea(
          top: false,
          child: detail.canSend
              ? _Composer(controller: _composer, onSend: _send)
              : _SendBlocked(reason: detail.sendBlockedReason),
        ),
      ],
    );
  }

  void _send() {
    final text = _composer.text;
    if (text.trim().isEmpty) {
      return;
    }
    _composer.clear();
    _controller.send(text);
    if (_scroll.hasClients) {
      _scroll.animateTo(
        0,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _showActions(ChatMessage message) {
    return showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: SectionHeader('Message'),
            ),
            if (message.canEdit)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Edit message'),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _editMessage(message);
                },
              ),
            if (message.canRemove)
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded),
                title: const Text('Remove message'),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _removeMessage(message);
                },
              ),
            ListTile(
              leading: const Icon(Icons.add_reaction_outlined),
              title: const Text('React'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _pickReaction(message);
              },
            ),
            if (!message.mine)
              ListTile(
                leading: const Icon(Icons.flag_outlined),
                title: const Text('Report message'),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _reportMessage(message);
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _editMessage(ChatMessage message) async {
    final field = TextEditingController(text: message.body);
    final edited = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Edit message'),
        content: CampusTextField(
          label: 'Message',
          controller: field,
          maxLines: 4,
          autofocus: true,
          textCapitalization: TextCapitalization.sentences,
        ),
        actions: [
          CampusTextButton(
            label: 'Cancel',
            onPressed: () => Navigator.of(dialogContext).pop(),
          ),
          CampusTextButton(
            label: 'Save',
            semanticLabel: 'Save changes to this message',
            onPressed: () => Navigator.of(dialogContext).pop(field.text),
          ),
        ],
      ),
    );
    field.dispose();
    final body = edited?.trim() ?? '';
    if (!mounted || body.isEmpty || body == message.body) {
      return;
    }
    await _controller.edit(message, body);
  }

  Future<void> _removeMessage(ChatMessage message) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remove this message?'),
        content: const Text(
          'Everyone in the conversation will see that a message was removed.',
        ),
        actions: [
          CampusTextButton(
            label: 'Keep',
            onPressed: () => Navigator.of(dialogContext).pop(false),
          ),
          CampusTextButton(
            label: 'Remove',
            semanticLabel: 'Remove this message',
            onPressed: () => Navigator.of(dialogContext).pop(true),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }
    await _controller.remove(message);
  }

  Future<void> _pickReaction(ChatMessage message) {
    return showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeader('Add a reaction'),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final reaction in messageReactionPalette)
                    Semantics(
                      button: true,
                      label: 'React with $reaction',
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          Navigator.of(sheetContext).pop();
                          _controller.toggleReaction(message, reaction);
                        },
                        child: ExcludeSemantics(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.line),
                            ),
                            child: Text(reaction, style: const TextStyle(fontSize: 22)),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _reportMessage(ChatMessage message) {
    return showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: SectionHeader('Why are you reporting this message?'),
            ),
            for (final entry in messageReportReasons.entries)
              ListTile(
                title: Text(entry.value),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _controller.report(message, reason: entry.key);
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _showParticipants(ConversationDetail detail) {
    return showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: SectionHeader(
                detail.participants.length == 1
                    ? '1 participant'
                    : '${detail.participants.length} participants',
              ),
            ),
            for (final member in detail.participants)
              ListTile(
                title: Text(member.displayName),
                subtitle: member.username == null ? null : Text('@${member.username}'),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  context.push('/app/profile/${member.personId}');
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _leave() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Leave this conversation?'),
        content: const Text('You will stop receiving its messages.'),
        actions: [
          CampusTextButton(
            label: 'Stay',
            onPressed: () => Navigator.of(dialogContext).pop(false),
          ),
          CampusTextButton(
            label: 'Leave',
            semanticLabel: 'Leave this conversation',
            onPressed: () => Navigator.of(dialogContext).pop(true),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    final left = await _controller.leave();
    if (left && mounted) {
      context.pop();
    }
  }
}

/// The index of the oldest message the viewer has not read yet. The list is
/// newest first, so that is the highest matching index.
int _unreadBoundary(List<ChatMessage> messages, DateTime? readUpTo) {
  if (readUpTo == null) {
    return -1;
  }
  for (var index = messages.length - 1; index >= 0; index -= 1) {
    final message = messages[index];
    if (!message.mine && message.createdAt.isAfter(readUpTo)) {
      return index;
    }
  }
  return -1;
}

String _timeLabel(DateTime value) {
  final local = value.toLocal();
  final now = DateTime.now();
  final today = local.year == now.year && local.month == now.month && local.day == now.day;
  return today ? formatTimeOfDay(local) : formatDayAndTime(local);
}

class _ContextHeader extends StatelessWidget {
  const _ContextHeader({required this.detail, required this.onOpenContext});

  final ConversationDetail detail;
  final VoidCallback onOpenContext;

  @override
  Widget build(BuildContext context) {
    final description = detail.description;
    final contextLabel = _contextLabel(detail.contextType);
    final hasContext = detail.contextRoute != null && contextLabel != null;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              StatusPill(label: detail.kindLabel),
              if (detail.participants.isNotEmpty)
                Text(
                  detail.participants.length == 1
                      ? '1 participant'
                      : '${detail.participants.length} participants',
                  style: const TextStyle(fontSize: 13, color: AppColors.muted),
                ),
              if (detail.muted)
                const StatusPill(
                  label: 'Muted',
                  icon: Icons.notifications_off_outlined,
                ),
              if (detail.locked)
                const StatusPill(
                  label: 'Closed',
                  tone: StatusTone.warning,
                  icon: Icons.lock_outline_rounded,
                ),
            ],
          ),
          if (description != null) ...[
            const SizedBox(height: 8),
            Text(description, style: const TextStyle(fontSize: 14, color: AppColors.muted)),
          ],
          if (hasContext)
            Align(
              alignment: Alignment.centerLeft,
              child: CampusTextButton(label: contextLabel, onPressed: onOpenContext),
            ),
        ],
      ),
    );
  }
}

String? _contextLabel(String? contextType) {
  switch (contextType?.toUpperCase()) {
    case 'BOOKING':
      return 'Open booking';
    case 'ORGANIZATION':
      return 'Open organization';
    case 'COURSE_OFFERING':
      return 'Open course';
    case 'CLASS':
      return 'Open class';
    case 'STUDY_GROUP':
      return 'Open study group';
    default:
      return null;
  }
}

class _MessageRow extends StatelessWidget {
  const _MessageRow({
    required this.message,
    required this.showSender,
    required this.onActions,
    required this.onRetry,
    required this.onReact,
  });

  final ChatMessage message;
  final bool showSender;
  final VoidCallback onActions;
  final VoidCallback onRetry;
  final ValueChanged<String> onReact;

  /// A message that has not reached the server has nothing to edit, react to or
  /// report yet.
  bool get _hasActions => !message.removed && message.delivery == MessageDelivery.sent;

  @override
  Widget build(BuildContext context) {
    final mine = message.mine;
    final timeLabel = _timeLabel(message.createdAt);
    final actions = _hasActions
        ? Semantics(
            button: true,
            label: 'Message actions',
            child: IconButton(
              onPressed: onActions,
              icon: const Icon(Icons.more_horiz_rounded, size: 20, color: AppColors.muted),
            ),
          )
        : const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
            children: [
              if (mine) actions,
              Flexible(
                child: Semantics(
                  label: message.semanticLabel(timeLabel),
                  child: GestureDetector(
                    onLongPress: _hasActions ? onActions : null,
                    child: ExcludeSemantics(
                      child: _Bubble(
                        message: message,
                        showSender: showSender,
                        timeLabel: timeLabel,
                      ),
                    ),
                  ),
                ),
              ),
              if (!mine) actions,
            ],
          ),
          if (message.reactions.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final reaction in message.reactions)
                    _ReactionChip(
                      reaction: reaction,
                      onTap: () => onReact(reaction.reaction),
                    ),
                ],
              ),
            ),
          if (mine && message.delivery != MessageDelivery.sent)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  StatusPill(
                    label: message.deliveryLabel,
                    tone: message.delivery == MessageDelivery.failed
                        ? StatusTone.critical
                        : StatusTone.pending,
                    icon: message.delivery == MessageDelivery.failed
                        ? Icons.error_outline_rounded
                        : Icons.schedule_rounded,
                  ),
                  CampusTextButton(
                    label: message.delivery == MessageDelivery.failed ? 'Retry' : 'Send now',
                    semanticLabel: message.delivery == MessageDelivery.failed
                        ? 'Retry sending this message'
                        : 'Send this message now',
                    onPressed: onRetry,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.message,
    required this.showSender,
    required this.timeLabel,
  });

  final ChatMessage message;
  final bool showSender;
  final String timeLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: message.mine ? const Color(0xFFE6F0E9) : AppColors.ivory,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showSender) ...[
            Text(
              message.senderName ?? 'Someone',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.deepGreen,
              ),
            ),
            const SizedBox(height: 4),
          ],
          if (message.removed)
            Text(
              message.removedLabel ?? 'Message removed',
              style: const TextStyle(
                fontSize: 15,
                fontStyle: FontStyle.italic,
                color: AppColors.muted,
              ),
            )
          else
            Text(
              message.body,
              style: const TextStyle(fontSize: 16, height: 1.35, color: AppColors.navy),
            ),
          const SizedBox(height: 4),
          Text(
            message.edited ? '$timeLabel · Edited' : timeLabel,
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _ReactionChip extends StatelessWidget {
  const _ReactionChip({required this.reaction, required this.onTap});

  final MessageReaction reaction;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: [
        '${reaction.reaction} ${reaction.count}',
        if (reaction.mine) 'Including you. Activate to remove your reaction'
        else 'Activate to react',
      ].join('. '),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: ExcludeSemantics(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: reaction.mine ? const Color(0xFFE6F0E9) : AppColors.cream,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.line),
            ),
            child: Text(
              '${reaction.reaction} ${reaction.count}',
              style: const TextStyle(fontSize: 13, color: AppColors.navy),
            ),
          ),
        ),
      ),
    );
  }
}

class _OlderMessages extends StatelessWidget {
  const _OlderMessages({required this.loading, required this.onLoad});

  final bool loading;
  final VoidCallback onLoad;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Semantics(
        label: 'Loading older messages',
        child: const Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }
    return Center(
      child: CampusTextButton(label: 'Load older messages', onPressed: onLoad),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.onSend});

  final TextEditingController controller;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: const BoxDecoration(
        color: AppColors.ivory,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Semantics(
              textField: true,
              label: 'Message',
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 5,
                keyboardType: TextInputType.multiline,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(hintText: 'Message'),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Semantics(
            button: true,
            label: 'Send message',
            child: IconButton(
              onPressed: onSend,
              icon: const Icon(Icons.send_rounded, color: AppColors.deepGreen),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sending is refused by the server, so its own explanation is shown rather
/// than a guess made on the client.
class _SendBlocked extends StatelessWidget {
  const _SendBlocked({required this.reason});

  final String? reason;

  @override
  Widget build(BuildContext context) {
    final message = reason;
    if (message == null) {
      return const SizedBox.shrink();
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: const BoxDecoration(
        color: AppColors.ivory,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_outline_rounded, size: 18, color: AppColors.muted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(fontSize: 14, color: AppColors.navy),
            ),
          ),
        ],
      ),
    );
  }
}
