import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/presentation/create_study_group_sheet.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/shared/models/study_group.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class StudyGroupsTab extends ConsumerWidget {
  const StudyGroupsTab({super.key, required this.courseOfferingId});

  final String courseOfferingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(courseStudyGroupsProvider(courseOfferingId));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(error is ApiError ? error.message : ApiError.genericMessage),
      ),
      data: (list) {
        return Scaffold(
          backgroundColor: Colors.transparent,
          floatingActionButton: list.permissions.canCreateStudyGroup
              ? Semantics(
                  button: true,
                  label: 'Create study group',
                  child: FloatingActionButton(
                    onPressed: () async {
                      final created = await showModalBottomSheet<bool>(
                        context: context,
                        isScrollControlled: true,
                        builder: (_) => CreateStudyGroupSheet(courseOfferingId: courseOfferingId),
                      );
                      if (created == true) {
                        ref.invalidate(courseStudyGroupsProvider(courseOfferingId));
                      }
                    },
                    child: const Icon(Icons.add),
                  ),
                )
              : null,
          body: list.items.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(20),
                  child: EmptyState(
                    title: 'No study groups yet',
                    subtitle:
                        'A study group is a student collaboration space. It does not replace this course or your class.',
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 88),
                  itemCount: list.items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _StudyGroupCard(item: list.items[index]),
                ),
        );
      },
    );
  }
}

class _StudyGroupCard extends StatelessWidget {
  const _StudyGroupCard({required this.item});

  final StudyGroup item;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${item.name}. ${item.memberLabel}.',
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => context.push('/app/learn/study-group/${item.id}'),
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
                Text(item.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  [
                    item.memberLabel,
                    if (item.isMember) 'Joined',
                    if (item.membershipStatus == 'PENDING') 'Request pending',
                  ].join(' · '),
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
                if (item.description != null) ...[
                  const SizedBox(height: 6),
                  Text(item.description!, maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
