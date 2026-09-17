import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/domain/course_tab.dart';
import 'package:campusos/features/courses/presentation/announcements_tab.dart';
import 'package:campusos/features/courses/presentation/course_tab_bar.dart';
import 'package:campusos/features/courses/presentation/overview_tab.dart';
import 'package:campusos/features/courses/presentation/placeholder_course_tab.dart';
import 'package:campusos/features/courses/presentation/resources_tab.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/shared/models/course_offering.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class CourseDetailScreen extends ConsumerWidget {
  const CourseDetailScreen({
    super.key,
    required this.courseOfferingId,
    required this.tab,
  });

  final String courseOfferingId;
  final CourseTab tab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offering = ref.watch(courseOfferingProvider(courseOfferingId));
    return offering.when(
      loading: () => const Scaffold(body: HomeSkeleton()),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Text(error is ApiError ? error.message : "You don't have access to this course."),
        ),
      ),
      data: (detail) {
        return Scaffold(
          appBar: AppBar(
            leadingWidth: 96,
            leading: Semantics(
              button: true,
              label: 'Back to ${detail.code}',
              child: TextButton.icon(
                onPressed: () => context.go('/app/learn'),
                icon: const Icon(Icons.chevron_left),
                label: Text(detail.code),
              ),
            ),
          ),
          body: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: _CourseHeader(detail: detail),
              ),
              CourseTabBar(
                selected: tab,
                onSelected: (next) {
                  context.go('/app/learn/course/$courseOfferingId/${next.path}');
                },
              ),
              const Divider(height: 1),
              Expanded(child: _tabBody(detail)),
            ],
          ),
        );
      },
    );
  }

  Widget _tabBody(CourseOfferingDetail detail) {
    switch (tab) {
      case CourseTab.overview:
        return OverviewTab(detail: detail);
      case CourseTab.announcements:
        return AnnouncementsTab(courseOfferingId: courseOfferingId);
      case CourseTab.resources:
        return ResourcesTab(courseOfferingId: courseOfferingId);
      case CourseTab.assignments:
      case CourseTab.exams:
      case CourseTab.laboratory:
      case CourseTab.discussion:
      case CourseTab.studyGroups:
      case CourseTab.people:
        return PlaceholderCourseTab(
          courseOfferingId: courseOfferingId,
          title: tab.label,
        );
    }
  }
}

class _CourseHeader extends StatelessWidget {
  const _CourseHeader({required this.detail});

  final CourseOfferingDetail detail;

  @override
  Widget build(BuildContext context) {
    final next = detail.nextActivity;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(detail.title, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 4),
        Text(
          '${detail.code} · ${detail.semester}',
          style: const TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600),
        ),
        Text(detail.lecturerLabel),
        if (detail.department != null) Text(detail.department!, style: const TextStyle(color: AppColors.muted)),
        if (detail.status != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(detail.status!, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        if (next != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              next.startTime == null
                  ? next.title
                  : '${next.title} · ${DateFormat.jm().format(next.startTime!.toLocal())}',
            ),
          ),
      ],
    );
  }
}
