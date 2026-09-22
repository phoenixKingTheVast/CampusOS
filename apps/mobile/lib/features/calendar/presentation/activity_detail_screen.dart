import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/calendar/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class ActivityDetailScreen extends ConsumerWidget {
  const ActivityDetailScreen({super.key, required this.activityId});

  final String activityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(activityProvider(activityId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          title: 'This activity is no longer available.',
          message: error is ApiError ? error.message : '$error',
        ),
      ),
      data: (item) {
        return Scaffold(
          appBar: AppBar(title: Text(item.categoryLabel)),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                item.cancelled ? '${item.title} (Cancelled)' : item.title,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              Text(DateFormat.yMMMMEEEEd().format(item.startTime.toLocal())),
              Text(
                '${DateFormat.jm().format(item.startTime.toLocal())} – ${DateFormat.jm().format(item.endTime.toLocal())}',
              ),
              if (item.location != null) Text('Venue · ${item.location}'),
              Text(item.status),
              if (item.description != null) ...[
                const SizedBox(height: 16),
                const Text('About', style: TextStyle(fontWeight: FontWeight.w700)),
                Text(item.description!),
              ],
              if (item.route != null && item.route != '/app/calendar/activity/${item.id}') ...[
                const SizedBox(height: 20),
                CampusButton(
                  label: 'Open source',
                  onPressed: () => context.push(item.route!),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
