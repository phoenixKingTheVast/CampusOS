import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/features/explore/data/explore_repository.dart';
import 'package:campusos/features/explore/providers.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/search_entry.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ExploreScreen extends ConsumerWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final explore = ref.watch(exploreProvider);
    final online = ref.watch(connectivityProvider).isOnline;

    return Scaffold(
      appBar: AppBar(title: const Text('Explore')),
      body: SafeArea(
        top: false,
        child: explore.when(
          skipLoadingOnReload: true,
          skipLoadingOnRefresh: true,
          loading: () => const HomeSkeleton(),
          error: (error, _) => ErrorRetry(
            message: exploreErrorMessage(error),
            onRetry: () => ref.read(exploreProvider.notifier).refresh(),
          ),
          data: (snapshot) => RefreshIndicator(
            onRefresh: () => ref.read(exploreProvider.notifier).refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                OfflineBanner(
                  visible: !online || snapshot.fromCache,
                  lastUpdated: _lastUpdatedLabel(snapshot.lastUpdated),
                ),
                SearchEntry(
                  label: 'Search organisations, events and services',
                  onTap: () => context.push('/app/search'),
                ),
                const SizedBox(height: 8),
                if (snapshot.isEmpty)
                  const EmptyState(
                    title: 'Nothing to explore yet',
                    subtitle:
                        'Organisations, events and campus services appear here as they are published.',
                  ),
                if (snapshot.happeningNow.isNotEmpty) ...[
                  const SectionHeader('HAPPENING NOW'),
                  ...snapshot.happeningNow.map(_HappeningRow.new),
                ],
                if (snapshot.organizations.isNotEmpty) ...[
                  SectionHeader(
                    'ORGANISATIONS · ${_countLabel(snapshot.organizations.length, 'organisation')}',
                  ),
                  ...snapshot.organizations.map(_OrganizationCard.new),
                ],
                if (snapshot.events.isNotEmpty) ...[
                  SectionHeader(
                    'UPCOMING EVENTS · ${_countLabel(snapshot.events.length, 'event')}',
                  ),
                  ...snapshot.events.map(_EventRow.new),
                ],
                const SectionHeader('CAMPUS SERVICES'),
                if (snapshot.categories.isNotEmpty)
                  _CategoryLinks(categories: snapshot.categories),
                if (snapshot.services.isEmpty)
                  const EmptyState(
                    title: 'No services published yet',
                    subtitle: 'Student and campus services appear here once published.',
                  )
                else
                  ...snapshot.services.map(_ServiceCard.new),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Semantics(
                    button: true,
                    label: 'Browse the full service catalogue',
                    child: TextButton(
                      onPressed: () => context.push('/app/explore/services'),
                      child: const Text('Browse all services'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String? _lastUpdatedLabel(DateTime? value) {
    if (value == null) {
      return null;
    }
    return 'Last updated ${formatRelative(value)}.';
  }
}

String _countLabel(int count, String noun) =>
    count == 1 ? '1 $noun' : '$count ${noun}s';

class _ExploreTile extends StatelessWidget {
  const _ExploreTile({
    required this.semanticLabel,
    required this.route,
    required this.child,
  });

  final String semanticLabel;
  final String route;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Semantics(
        button: true,
        label: semanticLabel,
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: route.isEmpty ? null : () => context.push(route),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(child: child),
                  const SizedBox(width: 8),
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

class _HappeningRow extends StatelessWidget {
  const _HappeningRow(this.item);

  final ExploreHappening item;

  @override
  Widget build(BuildContext context) {
    final start = item.startTime;
    final when = start == null ? null : 'Started ${formatTimeOfDay(start)}';
    return _ExploreTile(
      semanticLabel: [
        'Happening now',
        item.title,
        item.subtitle,
        when,
      ].whereType<String>().join('. '),
      route: item.route,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          Text(
            [item.subtitle, when].whereType<String>().join(' · '),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _OrganizationCard extends StatelessWidget {
  const _OrganizationCard(this.item);

  final ExploreOrganization item;

  @override
  Widget build(BuildContext context) {
    return _ExploreTile(
      semanticLabel: item.semanticLabel,
      route: item.route,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (item.description != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                item.description!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.muted),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (item.typeLabel != null) StatusPill(label: item.typeLabel!),
                StatusPill(label: item.memberLabel),
                if (item.following)
                  const StatusPill(
                    label: 'Following',
                    tone: StatusTone.positive,
                    icon: Icons.check_rounded,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow(this.item);

  final ExploreEvent item;

  @override
  Widget build(BuildContext context) {
    final startsAt = item.startsAt;
    final detail = [
      if (startsAt != null) formatDayAndTime(startsAt),
      item.location,
      item.organizationName,
    ].whereType<String>().join(' · ');
    return _ExploreTile(
      semanticLabel: '${item.title}. $detail',
      route: item.route,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (detail.isNotEmpty)
            Text(
              detail,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.muted),
            ),
        ],
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard(this.item);

  final ExploreService item;

  @override
  Widget build(BuildContext context) {
    return _ExploreTile(
      semanticLabel: [
        item.semanticLabel,
        if (item.providerName != null) 'By ${item.providerName}.',
        if (item.verified) 'Verified provider.',
        if (item.ratingCount > 0)
          '${item.ratingAverage?.toStringAsFixed(1) ?? '—'} out of 5 from '
              '${_countLabel(item.ratingCount, 'review')}.',
      ].join(' '),
      route: item.route,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (item.description != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                item.description!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.muted),
              ),
            ),
          if (item.providerName != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                item.providerName!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.muted),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (item.categoryLabel != null) StatusPill(label: item.categoryLabel!),
                StatusPill(label: item.priceLabel, tone: StatusTone.neutral),
                if (item.verified)
                  const StatusPill(
                    label: 'Verified provider',
                    tone: StatusTone.positive,
                    icon: Icons.verified_outlined,
                  ),
                RatingStars(rating: item.ratingAverage, count: item.ratingCount),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryLinks extends StatelessWidget {
  const _CategoryLinks({required this.categories});

  final List<ExploreCategoryLink> categories;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final category in categories)
            Semantics(
              button: true,
              label: 'Browse ${category.label} services',
              child: ExcludeSemantics(
                child: ActionChip(
                  label: Text(category.label),
                  backgroundColor: AppColors.ivory,
                  side: const BorderSide(color: AppColors.line),
                  labelStyle: const TextStyle(fontSize: 13, color: AppColors.navy),
                  onPressed: () => context.push(category.route),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
