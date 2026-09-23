import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/home/domain/home_presentation.dart';
import 'package:campusos/features/learn/presentation/course_offering_card.dart';
import 'package:campusos/features/learn/providers.dart';
import 'package:campusos/shared/models/activity.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/search_entry.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class LearnScreen extends ConsumerWidget {
  const LearnScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final learn = ref.watch(learnProvider);
    final online = ref.watch(connectivityProvider).isOnline;
    return Scaffold(
      body: SafeArea(
        child: learn.when(
          skipLoadingOnReload: true,
          skipLoadingOnRefresh: true,
          loading: () => const HomeSkeleton(),
          error: (error, _) => ErrorRetry(
            message: error is ApiError ? error.message : "CampusOS couldn't complete that request.",
            onRetry: () => ref.read(learnProvider.notifier).refresh(),
          ),
          data: (snapshot) {
            return RefreshIndicator(
              onRefresh: () => ref.read(learnProvider.notifier).refresh(),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                children: [
                  Text('Learn', style: Theme.of(context).textTheme.displayLarge),
                  const SizedBox(height: 12),
                  SearchEntry(
                    label: 'Search courses and resources',
                    onTap: () => context.push('/app/search?type=courses'),
                  ),
                  OfflineBanner(
                    visible: !online || snapshot.fromCache,
                    lastUpdated: HomePresentation.lastUpdatedLabel(snapshot.lastUpdated),
                  ),
                  if (snapshot.currentActivities.isNotEmpty) ...[
                    const SectionHeader('Today'),
                    ...snapshot.currentActivities.map((item) => _ActivityTile(item: item)),
                  ],
                  if (snapshot.upcomingActivities.isNotEmpty) ...[
                    const SectionHeader('Coming Up'),
                    ...snapshot.upcomingActivities.map((item) => _ActivityTile(item: item)),
                  ],
                  if (snapshot.attentionItems.isNotEmpty) ...[
                    const SectionHeader('Needs Attention'),
                    ...snapshot.attentionItems.map(
                      (item) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(item.title),
                        subtitle: Text(item.subtitle ?? ''),
                        onTap: item.route == null ? null : () => context.push(item.route!),
                      ),
                    ),
                  ],
                  const SectionHeader('My Courses'),
                  if (snapshot.courses.isEmpty)
                    const EmptyState(
                      title: 'No course offerings yet',
                      subtitle: 'Verified enrolments will appear here.',
                    )
                  else
                    ...snapshot.courses.map(
                      (course) => CourseOfferingCard(
                        course: course,
                        onTap: () => context.push('/app/learn/course/${course.courseOfferingId}'),
                      ),
                    ),
                  if (snapshot.primaryClass != null) ...[
                    const SectionHeader('My Class'),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(snapshot.primaryClass!.code),
                      subtitle: Text(
                        [
                          snapshot.primaryClass!.name,
                          'Year ${snapshot.primaryClass!.yearOfStudy ?? '-'}',
                          '${snapshot.primaryClass!.announcementCount} announcements',
                          '${snapshot.primaryClass!.upcomingCount} upcoming activities',
                        ].join(' · '),
                      ),
                      onTap: () => context.push(
                        snapshot.primaryClass!.route ?? '/app/class/${snapshot.primaryClass!.id}',
                      ),
                    ),
                  ],
                  if (snapshot.studyGroups.isNotEmpty) ...[
                    const SectionHeader('Study Groups'),
                    ...snapshot.studyGroups.map(
                      (group) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(group.name),
                        subtitle: Text('${group.memberCount} members'),
                        onTap: () => context.push('/app/learn/study-group/${group.id}'),
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

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.item});

  final ActivityItem item;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(item.title),
      subtitle: Text([item.courseCode, item.status].whereType<String>().join(' · ')),
      onTap: item.route == null ? null : () => context.push(item.route!),
    );
  }
}
