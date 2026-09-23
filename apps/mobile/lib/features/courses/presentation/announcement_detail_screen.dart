import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/announcement.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class AnnouncementDetailScreen extends ConsumerWidget {
  const AnnouncementDetailScreen({super.key, required this.announcementId});

  final String announcementId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<Announcement>(
      future: ref.read(courseRepositoryProvider).getAnnouncement(announcementId),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          final error = snapshot.error;
          return Scaffold(
            appBar: AppBar(),
            body: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(error is ApiError ? error.message : ApiError.genericMessage),
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        final item = snapshot.data!;
        return Scaffold(
          appBar: AppBar(
            title: Text(item.priorityLabel ?? 'Announcement'),
            leading: IconButton(
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/app/learn/course/${item.courseOfferingId}/announcements');
                }
              },
              icon: const Icon(Icons.chevron_left),
            ),
          ),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(item.title, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                [
                  item.authorName,
                  if (item.publishedAt != null)
                    DateFormat.yMMMd().add_jm().format(item.publishedAt!.toLocal()),
                ].whereType<String>().join(' · '),
              ),
              const SizedBox(height: 16),
              Text(item.body, style: const TextStyle(fontSize: 16, height: 1.4)),
              const SizedBox(height: 24),
              CampusButton(
                label: 'Open course',
                secondary: true,
                onPressed: () => context.go(
                  '/app/learn/course/${item.courseOfferingId}/announcements',
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
