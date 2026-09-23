import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/features/provider/data/provider_repository.dart';
import 'package:campusos/features/provider/providers.dart';
import 'package:campusos/shared/models/campus_service.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// The provider workspace. Choosing provider mode is navigation only — every
/// action on these screens is re-authorised by the server.
class ProviderDashboardScreen extends ConsumerWidget {
  const ProviderDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspace = ref.watch(providerWorkspaceProvider);
    final online = ref.watch(connectivityProvider).isOnline;

    return Scaffold(
      appBar: AppBar(title: const Text('Provider workspace')),
      body: SafeArea(
        top: false,
        child: workspace.when(
          skipLoadingOnReload: true,
          skipLoadingOnRefresh: true,
          loading: () => const HomeSkeleton(),
          error: (error, _) => ErrorRetry(
            message: providerErrorMessage(error),
            onRetry: () => ref.read(providerWorkspaceProvider.notifier).refresh(),
          ),
          data: (data) {
            if (!data.profile.isProvider) {
              return _ProviderOnboarding(online: online);
            }
            return RefreshIndicator(
              onRefresh: () => ref.read(providerWorkspaceProvider.notifier).refresh(),
              child: _Workspace(data: data, online: online),
            );
          },
        ),
      ),
    );
  }
}

class _Workspace extends StatelessWidget {
  const _Workspace({required this.data, required this.online});

  final ProviderWorkspace data;
  final bool online;

  @override
  Widget build(BuildContext context) {
    final profile = data.profile;
    final dashboard = data.dashboard;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        OfflineBanner(
          visible: !online || data.fromCache,
          lastUpdated: data.lastUpdated == null
              ? null
              : 'Last updated ${formatRelative(data.lastUpdated!)}.',
        ),
        _ProfileHeader(profile: profile),
        if (dashboard == null)
          const EmptyState(
            title: 'Workspace not synced yet',
            subtitle:
                'Reconnect to load your requests, bookings and services for today.',
          )
        else ...[
          SectionHeader(
            'PENDING REQUESTS · ${_plural(dashboard.pendingRequestCount, 'request')}',
          ),
          if (dashboard.pendingRequests.isEmpty)
            const EmptyState(
              title: 'No requests waiting',
              subtitle: 'New booking requests appear here for you to confirm or decline.',
            )
          else
            ...dashboard.pendingRequests.map(
              (item) => _QueueRow(item: item, awaitingAction: true),
            ),
          _LinkRow(
            label: 'Open the booking queue',
            semanticLabel:
                'Open the booking queue. ${_plural(dashboard.pendingRequestCount, 'request')} waiting.',
            route: '/app/services/provider/bookings',
          ),
          SectionHeader(
            "TODAY'S BOOKINGS · ${_plural(dashboard.todayBookingCount, 'booking')}",
          ),
          if (dashboard.todaysBookings.isEmpty)
            const EmptyState(
              title: 'Nothing booked for today',
              subtitle: 'Confirmed bookings for today appear here.',
            )
          else
            ...dashboard.todaysBookings.map(
              (item) => _QueueRow(item: item, awaitingAction: false),
            ),
          const SectionHeader('YOUR WORKSPACE'),
          _MetricRow(
            title: 'Services',
            value: _plural(dashboard.activeServiceCount, 'live service'),
            route: '/app/services/provider/services',
          ),
          _MetricRow(
            title: 'Messages',
            value: dashboard.unreadMessageCount == 0
                ? 'No unread messages'
                : _plural(dashboard.unreadMessageCount, 'unread message'),
            route: '/app/messages',
            trailing: UnreadDot(count: dashboard.unreadMessageCount),
          ),
          _MetricRow(
            title: 'Rating',
            value: dashboard.ratingLabel,
            route: profile.id == null ? null : '/app/explore/provider/${profile.id}',
            trailing: RatingStars(
              rating: profile.ratingAverage,
              count: profile.ratingCount,
            ),
          ),
          _MetricRow(
            title: 'Verification',
            value: profile.verificationLabel,
            route: '/app/services/provider/verification',
          ),
          const _MetricRow(
            title: 'Provider profile',
            value: 'Name, tagline, about and locations',
            route: '/app/services/provider/profile/edit',
          ),
        ],
        SectionHeader('REVIEWS · ${_plural(profile.ratingCount, 'review')}'),
        if (data.reviews.isEmpty)
          const EmptyState(
            title: 'No reviews yet',
            subtitle: 'Reviews customers leave after a completed booking appear here.',
          )
        else
          ...data.reviews.map((review) => _ReviewCard(review: review, online: online)),
      ],
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.profile});

  final MyProviderProfile profile;

  @override
  Widget build(BuildContext context) {
    final name = profile.providerName ?? 'Your services';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (profile.tagline != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  profile.tagline!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted),
                ),
              ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StatusPill(
                  label: profile.verificationLabel,
                  tone: profile.verified ? StatusTone.positive : StatusTone.pending,
                  icon: profile.verified
                      ? Icons.verified_outlined
                      : Icons.hourglass_empty_rounded,
                ),
                if (profile.status != null)
                  StatusPill(label: _providerStatusLabel(profile.status!)),
                RatingStars(rating: profile.ratingAverage, count: profile.ratingCount),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QueueRow extends StatelessWidget {
  const _QueueRow({required this.item, required this.awaitingAction});

  final ProviderQueueItem item;
  final bool awaitingAction;

  @override
  Widget build(BuildContext context) {
    final start = item.start;
    final detail = [
      item.customerName,
      if (start != null) formatDayAndTime(start),
      if (item.quantity != null && item.quantity! > 1) 'Quantity ${item.quantity}',
    ].whereType<String>().join(' · ');
    final status = item.status ?? (awaitingAction ? 'REQUESTED' : 'CONFIRMED');
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Semantics(
        button: true,
        label: '${item.serviceTitle}. $detail. ${_bookingStatusWords(status)}.',
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => context.push(item.route),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.serviceTitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                  ),
                  if (detail.isNotEmpty)
                    Text(
                      detail,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  const SizedBox(height: 8),
                  StatusPill(
                    label: _bookingStatusWords(status),
                    tone: bookingStatusTone(status),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({
    required this.title,
    required this.value,
    this.route,
    this.trailing,
  });

  final String title;
  final String value;
  final String? route;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final destination = route;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Semantics(
        button: destination != null,
        label: '$title. $value.',
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: destination == null ? null : () => context.push(destination),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          value,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                  if (trailing != null) ...[
                    const SizedBox(width: 8),
                    trailing!,
                  ],
                  if (destination != null) ...[
                    const SizedBox(width: 8),
                    const Icon(Icons.chevron_right, color: AppColors.muted),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({
    required this.label,
    required this.semanticLabel,
    required this.route,
  });

  final String label;
  final String semanticLabel;
  final String route;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Semantics(
        button: true,
        label: semanticLabel,
        child: TextButton(
          onPressed: () => context.push(route),
          child: Text(label),
        ),
      ),
    );
  }
}

class _ReviewCard extends ConsumerStatefulWidget {
  const _ReviewCard({required this.review, required this.online});

  final ServiceReview review;
  final bool online;

  @override
  ConsumerState<_ReviewCard> createState() => _ReviewCardState();
}

class _ReviewCardState extends ConsumerState<_ReviewCard> {
  final _response = TextEditingController();
  bool _composing = false;
  bool _busy = false;
  String? _pending;
  String? _error;

  @override
  void dispose() {
    _response.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final body = _response.text.trim();
    if (body.isEmpty) {
      setState(() => _error = 'Write a response before sending it.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _pending = 'Sending your response…';
    });
    try {
      await ref
          .read(providerRepositoryProvider)
          .respondToReview(widget.review.id, body);
      await ref.read(providerWorkspaceProvider.notifier).refresh();
    } catch (error) {
      if (mounted) {
        setState(() {
          _pending = null;
          _error = providerErrorMessage(error);
        });
      }
      return;
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final review = widget.review;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            RatingStars(rating: review.rating.toDouble(), count: 1),
            if (review.serviceTitle != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  review.serviceTitle!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            if (review.body != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(review.body!),
              ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                [
                  review.authorName ?? 'A customer',
                  if (review.createdAt != null) formatRelative(review.createdAt!),
                ].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.muted),
              ),
            ),
            if (review.providerResponse != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Semantics(
                  label: 'Your response. ${review.providerResponse}',
                  child: ExcludeSemantics(
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.cream,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text('Your response: ${review.providerResponse}'),
                    ),
                  ),
                ),
              )
            else if (_composing) ...[
              const SizedBox(height: 10),
              if (_pending != null) PendingActionBanner(message: _pending!),
              if (_error != null) PendingActionBanner(message: _error!, isError: true),
              if (!widget.online)
                const PendingActionBanner(
                  message:
                      "You're offline. Reconnect to send your response — nothing has been sent yet.",
                  isError: true,
                ),
              CampusTextField(
                label: 'Your response',
                controller: _response,
                maxLines: 3,
                enabled: !_busy,
                semanticLabel: 'Your response to this review',
              ),
              const SizedBox(height: 10),
              CampusButton(
                label: 'Send response',
                busy: _busy,
                onPressed: widget.online && !_busy ? _submit : null,
                semanticLabel: 'Send your response to this review',
              ),
            ] else
              Align(
                alignment: Alignment.centerLeft,
                child: CampusTextButton(
                  label: 'Respond',
                  onPressed: () => setState(() => _composing = true),
                  semanticLabel: 'Respond to this review',
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// `isProvider == false` is a normal state, not a failure: it is the entry point
/// into provider mode.
class _ProviderOnboarding extends ConsumerStatefulWidget {
  const _ProviderOnboarding({required this.online});

  final bool online;

  @override
  ConsumerState<_ProviderOnboarding> createState() => _ProviderOnboardingState();
}

class _ProviderOnboardingState extends ConsumerState<_ProviderOnboarding> {
  final _name = TextEditingController();
  final _tagline = TextEditingController();
  final _about = TextEditingController();
  bool _busy = false;
  String? _pending;
  String? _error;
  String? _nameError;

  @override
  void dispose() {
    _name.dispose();
    _tagline.dispose();
    _about.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.length < 2) {
      setState(() => _nameError = 'Enter the name customers will see.');
      return;
    }
    setState(() {
      _busy = true;
      _nameError = null;
      _error = null;
      _pending = 'Creating your provider profile…';
    });
    try {
      await ref.read(providerWorkspaceProvider.notifier).createProfile(
            providerName: name,
            tagline: _tagline.text.trim(),
            about: _about.text.trim(),
          );
    } catch (error) {
      if (mounted) {
        setState(() {
          _pending = null;
          _error = providerErrorMessage(error);
        });
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text(
          'Offer a service on campus',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        const Text(
          'Create a provider profile to list services, take bookings and manage your '
          'availability. Your CampusOS account stays the same account.',
        ),
        const SizedBox(height: 16),
        if (_pending != null) PendingActionBanner(message: _pending!),
        if (_error != null) PendingActionBanner(message: _error!, isError: true),
        if (!widget.online)
          const PendingActionBanner(
            message:
                "You're offline. Reconnect to create your provider profile — nothing has been submitted yet.",
            isError: true,
          ),
        CampusTextField(
          label: 'Provider name',
          controller: _name,
          enabled: !_busy,
          errorText: _nameError,
          hint: 'The name customers will see',
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 12),
        CampusTextField(
          label: 'Tagline (optional)',
          controller: _tagline,
          enabled: !_busy,
          hint: 'One line about what you offer',
        ),
        const SizedBox(height: 12),
        CampusTextField(
          label: 'About (optional)',
          controller: _about,
          maxLines: 4,
          enabled: !_busy,
        ),
        const SizedBox(height: 20),
        CampusButton(
          label: 'Create provider profile',
          busy: _busy,
          onPressed: widget.online && !_busy ? _submit : null,
          semanticLabel: 'Create your provider profile',
        ),
      ],
    );
  }
}

String _plural(int count, String noun) => count == 1 ? '1 $noun' : '$count ${noun}s';

String _bookingStatusWords(String status) {
  switch (status.toUpperCase()) {
    case 'REQUESTED':
      return 'Awaiting your response';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'COMPLETED':
      return 'Completed';
    case 'DECLINED':
      return 'Declined';
    case 'CANCELLED':
      return 'Cancelled';
    case 'RESCHEDULED':
      return 'Rescheduled';
    default:
      return status;
  }
}

String _providerStatusLabel(String status) {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'Open for bookings';
    case 'PENDING_VERIFICATION':
      return 'Verification under review';
    case 'PAUSED':
      return 'Paused';
    case 'SUSPENDED':
      return 'Suspended';
    case 'CLOSED':
      return 'Closed';
    default:
      return 'Draft';
  }
}
