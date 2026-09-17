import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/presentation/create_announcement_sheet.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/shared/models/announcement.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class AnnouncementsTab extends ConsumerWidget {
  const AnnouncementsTab({super.key, required this.courseOfferingId});

  final String courseOfferingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(courseAnnouncementsProvider(courseOfferingId));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(error is ApiError ? error.message : "You don't have permission to do that."),
      ),
      data: (list) {
        return Scaffold(
          backgroundColor: Colors.transparent,
          floatingActionButton: list.permissions.canCreateAnnouncement
              ? Semantics(
                  button: true,
                  label: 'Create announcement',
                  child: FloatingActionButton(
                    onPressed: () async {
                      final created = await showModalBottomSheet<bool>(
                        context: context,
                        isScrollControlled: true,
                        builder: (_) => CreateAnnouncementSheet(courseOfferingId: courseOfferingId),
                      );
                      if (created == true) {
                        ref.invalidate(courseAnnouncementsProvider(courseOfferingId));
                      }
                    },
                    child: const Icon(Icons.add),
                  ),
                )
              : null,
          body: list.items.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(20),
                  child: EmptyState(title: 'No announcements yet'),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 88),
                  itemCount: list.items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _AnnouncementCard(
                    item: list.items[index],
                    canEdit: list.permissions.canEditAnnouncement,
                    onOpen: () async {
                      await ref.read(courseRepositoryProvider).markAnnouncementRead(list.items[index].id);
                      if (context.mounted) {
                        await context.push('/app/learn/announcement/${list.items[index].id}');
                        ref.invalidate(courseAnnouncementsProvider(courseOfferingId));
                      }
                    },
                  ),
                ),
        );
      },
    );
  }
}

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({
    required this.item,
    required this.canEdit,
    required this.onOpen,
  });

  final Announcement item;
  final bool canEdit;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${item.priorityLabel ?? 'Announcement'} ${item.title}',
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onOpen,
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
                if (item.priorityLabel != null)
                  Text(
                    item.priorityLabel!,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                      fontSize: 12,
                    ),
                  ),
                Text(item.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(item.body),
                const SizedBox(height: 8),
                Text(
                  [
                    item.authorName,
                    if (item.publishedAt != null) DateFormat.MMMd().add_jm().format(item.publishedAt!.toLocal()),
                    if (!item.isRead) 'Unread',
                  ].whereType<String>().join(' · '),
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
                if (canEdit)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text('You can edit this announcement', style: TextStyle(fontSize: 12)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
