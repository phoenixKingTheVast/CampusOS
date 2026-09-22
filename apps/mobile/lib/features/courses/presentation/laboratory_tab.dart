import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/shared/models/laboratory.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class LaboratoryTab extends ConsumerWidget {
  const LaboratoryTab({super.key, required this.courseOfferingId});

  final String courseOfferingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(courseLaboratoriesProvider(courseOfferingId));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(error is ApiError ? error.message : ApiError.genericMessage),
      ),
      data: (list) {
        if (list.items.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(20),
            child: EmptyState(
              title: 'No laboratory sessions yet',
              subtitle: 'Published laboratory activities for this course offering appear here.',
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          itemCount: list.items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) => _LabCard(item: list.items[index]),
        );
      },
    );
  }
}

class _LabCard extends StatelessWidget {
  const _LabCard({required this.item});

  final Laboratory item;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Laboratory ${item.title}',
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => context.push('/app/learn/laboratory/${item.id}'),
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
                Text(item.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  [
                    item.status,
                    if (item.startAt != null) DateFormat.MMMd().add_jm().format(item.startAt!.toLocal()),
                    if (item.location != null) item.location,
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
