import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class AssignmentDetailScreen extends ConsumerWidget {
  const AssignmentDetailScreen({super.key, required this.assessmentId});

  final String assessmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(assessmentProvider(assessmentId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          title: 'This assessment is no longer available.',
          message: error is ApiError ? error.message : '$error',
        ),
      ),
      data: (item) {
        final when = item.dueAt ?? item.startAt;
        return Scaffold(
          appBar: AppBar(title: Text(item.typeLabel)),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (item.cancelled)
                const Text('CANCELLED', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700)),
              Text(item.title, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                [
                  item.courseCode,
                  item.offeringLabel,
                  item.status,
                ].whereType<String>().join(' · '),
                style: const TextStyle(color: AppColors.muted),
              ),
              if (when != null) Text(DateFormat.yMMMMEEEEd().add_jm().format(when.toLocal())),
              if (item.location != null) Text('Venue · ${item.location}'),
              if (item.weight != null) Text('Weight · ${item.weight}%'),
              if (item.description != null) ...[
                const SizedBox(height: 16),
                const Text('About', style: TextStyle(fontWeight: FontWeight.w700)),
                Text(item.description!),
              ],
              if (item.instructions != null) ...[
                const SizedBox(height: 16),
                const Text('Instructions', style: TextStyle(fontWeight: FontWeight.w700)),
                Text(item.instructions!),
              ],
              if (item.submissionBoundary != null) ...[
                const SizedBox(height: 16),
                const Text('Submission', style: TextStyle(fontWeight: FontWeight.w700)),
                Text(item.submissionBoundary!.label),
              ],
              if (item.resources.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Linked resources', style: TextStyle(fontWeight: FontWeight.w700)),
                ...item.resources.map(
                  (resource) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(resource.title),
                    onTap: () => context.push('/app/learn/resource/${resource.id}'),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              CampusButton(
                label: 'Open course',
                secondary: true,
                onPressed: () => context.go(
                  '/app/learn/course/${item.courseOfferingId}/${item.isExam ? 'exams' : 'assignments'}',
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
