import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/presentation/create_discussion_sheet.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/shared/models/discussion.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class DiscussionTab extends ConsumerWidget {
  const DiscussionTab({super.key, required this.courseOfferingId});

  final String courseOfferingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(courseDiscussionsProvider(courseOfferingId));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(error is ApiError ? error.message : ApiError.genericMessage),
      ),
      data: (list) {
        return Scaffold(
          backgroundColor: Colors.transparent,
          floatingActionButton: list.permissions.canCreateDiscussion
              ? Semantics(
                  button: true,
                  label: 'Start discussion',
                  child: FloatingActionButton(
                    onPressed: () async {
                      final created = await showModalBottomSheet<bool>(
                        context: context,
                        isScrollControlled: true,
                        builder: (_) => CreateDiscussionSheet(courseOfferingId: courseOfferingId),
                      );
                      if (created == true) {
                        ref.invalidate(courseDiscussionsProvider(courseOfferingId));
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
                    title: 'No discussions yet',
                    subtitle: 'Course discussions stay attached to this offering. They are not a class or study group.',
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 88),
                  itemCount: list.items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _DiscussionCard(item: list.items[index]),
                ),
        );
      },
    );
  }
}

class _DiscussionCard extends StatelessWidget {
  const _DiscussionCard({required this.item});

  final Discussion item;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: item.title,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => context.push('/app/learn/discussion/${item.id}'),
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
                if (item.pinned)
                  const Text('PINNED', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                Text(item.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(item.body, maxLines: 2, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 8),
                Text(
                  [
                    item.authorName,
                    if (item.createdAt != null) DateFormat.MMMd().add_jm().format(item.createdAt!.toLocal()),
                    '${item.replyCount} ${item.replyCount == 1 ? 'reply' : 'replies'}',
                    if (item.closed) 'Closed',
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
