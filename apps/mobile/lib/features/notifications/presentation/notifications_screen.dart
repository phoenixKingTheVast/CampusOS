import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/notifications/providers.dart';
import 'package:campusos/shared/models/notification.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final _scrollController = ScrollController();
  bool _opening = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) {
      return;
    }
    final position = _scrollController.position;
    if (position.pixels < position.maxScrollExtent - 320) {
      return;
    }
    final current = ref.read(notificationCentreProvider).asData?.value;
    if (current == null || current.loadingMore || current.loadMoreFailed || !current.hasMore) {
      return;
    }
    ref.read(notificationCentreProvider.notifier).loadMore();
  }

  Future<void> _open(CampusNotification item) async {
    if (_opening) {
      return;
    }
    setState(() => _opening = true);
    try {
      final route = await ref.read(notificationCentreProvider.notifier).open(item.id);
      if (!mounted) {
        return;
      }
      if (route == null || route.isEmpty) {
        _showMessage('This notification has nothing to open.');
        return;
      }
      context.push(route);
    } on ApiError catch (error) {
      if (!mounted) {
        return;
      }
      await _showUnavailable(
        error.code == 'OFFLINE'
            ? "You're offline. CampusOS checks your access before opening this, so try again once you're back online."
            : error.message,
      );
    } finally {
      if (mounted) {
        setState(() => _opening = false);
      }
    }
  }

  Future<void> _markRead(CampusNotification item) async {
    final confirmed = await ref.read(notificationCentreProvider.notifier).markRead(item.id);
    if (!mounted || confirmed) {
      return;
    }
    _showMessage(
      "Marked as read on this device. CampusOS couldn't reach the server, so it may still be unread elsewhere.",
    );
  }

  Future<void> _markAllRead() async {
    final confirmed = await ref.read(notificationCentreProvider.notifier).markAllRead();
    if (!mounted || confirmed) {
      return;
    }
    _showMessage(
      "Marked as read on this device. CampusOS couldn't reach the server, so they may still be unread elsewhere.",
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Semantics(liveRegion: true, child: Text(message))),
    );
  }

  Future<void> _showUnavailable(String message) {
    return showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Not available'),
        content: Text(message),
        actions: [
          CampusTextButton(
            label: 'OK',
            semanticLabel: 'Dismiss',
            onPressed: () => Navigator.of(dialogContext).pop(),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(notificationCentreProvider);
    final filterIndex = ref.watch(notificationFilterProvider);
    final unreadCount = async.asData?.value.unreadCount ?? 0;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Flexible(
              child: Text('Notifications', maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            const SizedBox(width: 8),
            UnreadDot(count: unreadCount),
          ],
        ),
        actions: [
          MergeSemantics(
            child: Semantics(
              button: true,
              enabled: unreadCount > 0,
              label: unreadCount > 0
                  ? 'Mark all as read. $unreadCount unread.'
                  : 'Mark all as read. Nothing unread.',
              onTap: unreadCount > 0 ? _markAllRead : null,
              child: ExcludeSemantics(
                child: TextButton(
                  onPressed: unreadCount > 0 ? _markAllRead : null,
                  child: const Text('Mark all read'),
                ),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 10),
            child: FilterChipRow(
              labels: [for (final filter in NotificationFilter.all) filter.label],
              selectedIndex: filterIndex,
              onSelected: (index) => ref.read(notificationFilterProvider.notifier).select(index),
              semanticsPrefix: 'Notification filter',
            ),
          ),
          if (_opening) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorRetry(
                message: error is ApiError ? error.message : ApiError.genericMessage,
                onRetry: () => ref.invalidate(notificationCentreProvider),
              ),
              data: (state) => _NotificationList(
                state: state,
                filter: NotificationFilter.all[filterIndex],
                scrollController: _scrollController,
                onRefresh: () => ref.read(notificationCentreProvider.notifier).refresh(),
                onRetryMore: () => ref.read(notificationCentreProvider.notifier).loadMore(),
                onOpen: _open,
                onMarkRead: _markRead,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationList extends StatelessWidget {
  const _NotificationList({
    required this.state,
    required this.filter,
    required this.scrollController,
    required this.onRefresh,
    required this.onRetryMore,
    required this.onOpen,
    required this.onMarkRead,
  });

  final NotificationCentreState state;
  final NotificationFilter filter;
  final ScrollController scrollController;
  final Future<void> Function() onRefresh;
  final VoidCallback onRetryMore;
  final ValueChanged<CampusNotification> onOpen;
  final ValueChanged<CampusNotification> onMarkRead;

  @override
  Widget build(BuildContext context) {
    final syncedAt = state.syncedAt;
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: CustomScrollView(
        controller: scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            sliver: SliverToBoxAdapter(
              child: OfflineBanner(
                visible: state.fromCache,
                lastUpdated: syncedAt == null ? null : 'Last updated ${formatRelative(syncedAt)}.',
              ),
            ),
          ),
          if (state.items.isEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              sliver: SliverToBoxAdapter(
                child: EmptyState(
                  title: filter.unreadOnly ? 'Nothing unread' : "You're all caught up",
                  subtitle: filter.unreadOnly
                      ? 'Everything in your notification centre has been read.'
                      : filter.category == null
                          ? 'Notifications about your courses, classes, organizations and bookings appear here.'
                          : 'Nothing in ${filter.label} yet.',
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _NotificationRow(
                      item: state.items[index],
                      onOpen: () => onOpen(state.items[index]),
                      onMarkRead: () => onMarkRead(state.items[index]),
                    ),
                  ),
                  childCount: state.items.length,
                ),
              ),
            ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            sliver: SliverToBoxAdapter(
              child: _ListFooter(state: state, onRetry: onRetryMore),
            ),
          ),
        ],
      ),
    );
  }
}

class _ListFooter extends StatelessWidget {
  const _ListFooter({required this.state, required this.onRetry});

  final NotificationCentreState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (state.loadingMore) {
      return Semantics(
        liveRegion: true,
        label: 'Loading more notifications.',
        child: const Center(
          child: Padding(
            padding: EdgeInsets.all(8),
            child: SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      );
    }
    if (state.loadMoreFailed) {
      return Column(
        children: [
          const PendingActionBanner(
            message: "CampusOS couldn't load more notifications.",
            isError: true,
          ),
          CampusTextButton(
            label: 'Try again',
            semanticLabel: 'Try loading more notifications again',
            onPressed: onRetry,
          ),
        ],
      );
    }
    return const SizedBox.shrink();
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.item,
    required this.onOpen,
    required this.onMarkRead,
  });

  final CampusNotification item;
  final VoidCallback onOpen;
  final VoidCallback onMarkRead;

  @override
  Widget build(BuildContext context) {
    final createdAt = item.createdAt;
    final timeLabel = createdAt == null ? '' : formatRelative(createdAt);
    final priority = _priorityLabel(item.priority);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: item.read ? AppColors.line : AppColors.forest),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: MergeSemantics(
              child: Semantics(
                button: true,
                label: [
                  if (priority != null) priority,
                  item.semanticLabel(timeLabel),
                ].join('. '),
                onTap: onOpen,
                child: Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    onTap: onOpen,
                    borderRadius: BorderRadius.circular(16),
                    child: ExcludeSemantics(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 3, right: 10),
                              child: Icon(
                                item.read ? Icons.circle_outlined : Icons.circle,
                                size: 13,
                                color: item.read ? AppColors.muted : AppColors.deepGreen,
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: item.read ? FontWeight.w500 : FontWeight.w800,
                                      color: AppColors.navy,
                                    ),
                                  ),
                                  if (item.body.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      item.body,
                                      maxLines: 3,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 14, color: AppColors.navy),
                                    ),
                                  ],
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    children: [
                                      if (!item.read)
                                        const StatusPill(
                                          label: 'Unread',
                                          tone: StatusTone.pending,
                                          icon: Icons.circle,
                                        ),
                                      StatusPill(label: item.categoryLabel),
                                      if (priority != null)
                                        StatusPill(
                                          label: priority,
                                          tone: item.priority.toUpperCase() == 'CRITICAL'
                                              ? StatusTone.critical
                                              : StatusTone.warning,
                                          icon: Icons.priority_high_rounded,
                                        ),
                                      if (timeLabel.isNotEmpty)
                                        Text(
                                          timeLabel,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            color: AppColors.muted,
                                          ),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (!item.read)
            MergeSemantics(
              child: Semantics(
                button: true,
                label: 'Mark as read. ${item.title}',
                onTap: onMarkRead,
                child: ExcludeSemantics(
                  child: IconButton(
                    onPressed: onMarkRead,
                    icon: const Icon(Icons.check_rounded),
                    color: AppColors.deepGreen,
                    tooltip: 'Mark as read',
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String? _priorityLabel(String priority) {
    switch (priority.toUpperCase()) {
      case 'CRITICAL':
        return 'Urgent';
      case 'HIGH':
        return 'Important';
      default:
        return null;
    }
  }
}
