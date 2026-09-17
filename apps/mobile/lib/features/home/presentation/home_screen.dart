import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/analytics/analytics.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/home/domain/home_presentation.dart';
import 'package:campusos/features/home/providers.dart';
import 'package:campusos/shared/models/activity.dart';
import 'package:campusos/shared/models/home_snapshot.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/person_avatar.dart';
import 'package:campusos/shared/widgets/search_entry.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  var _sectionsTracked = false;

  @override
  void initState() {
    super.initState();
    const Analytics().track('home_opened');
  }

  void _trackSections(HomeSnapshot snapshot) {
    if (_sectionsTracked) {
      return;
    }
    _sectionsTracked = true;
    if (snapshot.upNext.isNotEmpty) {
      const Analytics().track('home_section_viewed', {'section': 'upNext'});
    }
    if (snapshot.today.isNotEmpty) {
      const Analytics().track('home_section_viewed', {'section': 'today'});
    }
    if (snapshot.attention.isNotEmpty) {
      const Analytics().track('home_section_viewed', {'section': 'attention'});
    }
    const Analytics().track('home_section_viewed', {'section': 'campus'});
    const Analytics().track('home_section_viewed', {'section': 'discover'});
  }

  @override
  Widget build(BuildContext context) {
    final home = ref.watch(homeProvider);
    final online = ref.watch(connectivityProvider).isOnline;
    final person = ref.watch(sessionProvider).person;

    return Scaffold(
      body: SafeArea(
        child: home.when(
          skipLoadingOnReload: true,
          skipLoadingOnRefresh: true,
          loading: () => const HomeSkeleton(),
          error: (error, _) => ErrorRetry(
            message: error is ApiError
                ? error.message
                : "CampusOS couldn't complete that request.",
            onRetry: () => ref.read(homeProvider.notifier).refresh(),
          ),
          data: (snapshot) {
            _trackSections(snapshot);
            final refreshFailure = HomePresentation.refreshFailureLabel(snapshot);
            return RefreshIndicator(
              onRefresh: () async {
                const Analytics().track('home_refresh');
                await ref.read(homeProvider.notifier).refresh();
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                children: [
                  _HomeHeader(
                    greeting: HomePresentation.greeting(
                      DateTime.now(),
                      snapshot.greetingName ?? person?.greetingName,
                    ),
                    unread: snapshot.unreadNotificationCount,
                    initials: person?.initials ?? 'C',
                  ),
                  const SizedBox(height: 16),
                  SearchEntry(
                    label: 'Search CampusOS',
                    onTap: () => context.push('/app/search'),
                  ),
                  const SizedBox(height: 12),
                  if (refreshFailure != null)
                    _StatusBanner(message: refreshFailure)
                  else
                    OfflineBanner(
                      visible: !online || snapshot.fromCache,
                      lastUpdated: HomePresentation.lastUpdatedLabel(snapshot.lastUpdated),
                    ),
                  if (HomePresentation.showVerifyStudentCta(snapshot))
                    const _VerifyCta(),
                  if (HomePresentation.showCaughtUp(snapshot))
                    const EmptyState(
                      title: "You're all caught up",
                      subtitle: 'Nothing needs your attention right now.',
                    ),
                  if (snapshot.upNext.isNotEmpty) ...[
                    const SectionHeader('Up Next'),
                    ...snapshot.upNext.map(_UpNextCard.new),
                  ],
                  if (snapshot.today.isNotEmpty) ...[
                    const SectionHeader('Today'),
                    ...snapshot.today.map(_TodayRow.new),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () => context.go('/app/calendar'),
                        child: const Text('See all calendar'),
                      ),
                    ),
                  ],
                  if (snapshot.attention.isNotEmpty) ...[
                    const SectionHeader('Needs Your Attention'),
                    ...snapshot.attention.map(_AttentionCard.new),
                  ],
                  if (HomePresentation.showCampusAndDiscover(snapshot)) ...[
                    const SectionHeader('Your Campus'),
                    if (snapshot.campus.isEmpty)
                      const EmptyState(title: 'Campus updates will appear here')
                    else
                      ...snapshot.campus.map((item) => _CampusRow(item, section: 'campus')),
                    const SectionHeader('Discover'),
                    if (snapshot.discover.isEmpty)
                      const EmptyState(title: 'Discover organisations, events and services')
                    else
                      ...snapshot.discover.map((item) => _CampusRow(item, section: 'discover')),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () {
                          const Analytics().track('home_discover_opened');
                          context.go('/app/explore');
                        },
                        child: const Text('See all in Explore'),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({
    required this.greeting,
    required this.unread,
    required this.initials,
  });

  final String greeting;
  final int unread;
  final String initials;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(greeting, style: Theme.of(context).textTheme.titleLarge),
              const Text(
                'CampusOS',
                style: TextStyle(
                  color: AppColors.deepGreen,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        Semantics(
          button: true,
          label: unread > 0 ? 'Notifications, $unread unread' : 'Notifications',
          child: IconButton(
            onPressed: () => context.push('/app/notifications'),
            icon: UnreadBadge(
              count: unread,
              child: const Icon(Icons.notifications_none, color: AppColors.navy),
            ),
          ),
        ),
        PersonAvatar(
          initials: initials,
          semanticLabel: 'Profile',
          onTap: () => context.push('/app/profile'),
        ),
      ],
    );
  }
}

class _VerifyCta extends StatelessWidget {
  const _VerifyCta();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Semantics(
        button: true,
        label: 'Verify student status',
        child: Material(
          color: const Color(0xFFE7F0E8),
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: () => context.push('/onboarding/student-verification'),
            borderRadius: BorderRadius.circular(16),
            child: const Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome to CampusOS',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Connect your university identity to unlock your academic campus.',
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Verify student status',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.deepGreen,
                    ),
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

class _UpNextCard extends StatelessWidget {
  const _UpNextCard(this.item);

  final ActivityItem item;

  @override
  Widget build(BuildContext context) {
    final timeRange = HomePresentation.upNextWhen(item);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Semantics(
        button: true,
        label: [
          item.source,
          item.type,
          item.title,
          timeRange,
          item.location,
          item.relative,
        ].whereType<String>().where((part) => part.isNotEmpty).join(', '),
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: item.route == null
                ? null
                : () {
                    const Analytics().track('home_item_opened', {'section': 'upNext'});
                    context.push(item.route!);
                  },
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (item.source != null)
                    Text(
                      item.source!,
                      style: const TextStyle(
                        color: AppColors.deepGreen,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  Text(item.title, style: Theme.of(context).textTheme.titleMedium),
                  if (item.type != null)
                    Text(item.type!, style: const TextStyle(color: AppColors.muted)),
                  const SizedBox(height: 8),
                  if (timeRange.isNotEmpty) Text(timeRange),
                  if (item.location != null) Text(item.location!),
                  if (item.relative != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        item.relative!,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'View',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.deepGreen,
                      ),
                    ),
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

class _TodayRow extends StatelessWidget {
  const _TodayRow(this.item);

  final ActivityItem item;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${HomePresentation.todayTimeLabel(item)} ${item.title}',
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: SizedBox(
          width: 52,
          child: Text(
            HomePresentation.todayTimeLabel(item),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        title: Text(item.title),
        subtitle: Text(item.source ?? item.type ?? ''),
        onTap: item.route == null
            ? null
            : () {
                const Analytics().track('home_item_opened', {'section': 'today'});
                context.push(item.route!);
              },
      ),
    );
  }
}

class _AttentionCard extends StatelessWidget {
  const _AttentionCard(this.item);

  final AttentionItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Semantics(
        button: true,
        label: HomePresentation.attentionLabel(item),
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: item.route == null
                ? null
                : () {
                    const Analytics().track('home_item_opened', {'section': 'attention'});
                    context.push(item.route!);
                  },
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  if (item.subtitle != null)
                    Text(item.subtitle!, style: const TextStyle(color: AppColors.muted)),
                  if (item.actionLabel != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        item.actionLabel!,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: AppColors.deepGreen,
                        ),
                      ),
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

class _CampusRow extends StatelessWidget {
  const _CampusRow(this.item, {this.section = 'campus'});

  final CampusCard item;
  final String section;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Semantics(
        button: true,
        label: '${item.title}. ${item.subtitle ?? item.kind}',
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: item.route == null
                ? null
                : () {
                    const Analytics().track('home_item_opened', {'section': section});
                    context.push(item.route!);
                  },
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                        if (item.subtitle != null)
                          Text(item.subtitle!, style: const TextStyle(color: AppColors.muted)),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: AppColors.muted),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: message,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFF4E7D8),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(message, style: const TextStyle(fontSize: 13, color: AppColors.navy)),
      ),
    );
  }
}
