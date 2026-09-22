import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/shared/models/assessment.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class AssessmentsTab extends ConsumerWidget {
  const AssessmentsTab({
    super.key,
    required this.courseOfferingId,
    required this.exams,
  });

  final String courseOfferingId;
  final bool exams;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(courseAssessmentsProvider(courseOfferingId));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(error is ApiError ? error.message : ApiError.genericMessage),
      ),
      data: (list) {
        final items = list.filtered(exams: exams).items;
        if (items.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(20),
            child: EmptyState(
              title: exams ? 'No tests or exams published yet' : 'No assignments published yet',
              subtitle: 'Published assessments for this course offering appear here.',
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) => _AssessmentCard(item: items[index]),
        );
      },
    );
  }
}

class _AssessmentCard extends StatelessWidget {
  const _AssessmentCard({required this.item});

  final Assessment item;

  @override
  Widget build(BuildContext context) {
    final when = item.dueAt ?? item.startAt;
    return Semantics(
      button: true,
      label: '${item.typeLabel} ${item.title}',
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => context.push('/app/learn/assignment/${item.id}'),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.typeLabel.toUpperCase(),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                    fontSize: 12,
                  ),
                ),
                Text(item.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  [
                    if (item.urgency != null) item.urgency,
                    if (when != null) DateFormat.MMMd().add_jm().format(when.toLocal()),
                    if (item.location != null) item.location,
                    if (item.cancelled) 'Cancelled',
                  ].whereType<String>().join(' · '),
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
