import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/features/calendar/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class EventDetailScreen extends ConsumerWidget {
  const EventDetailScreen({super.key, required this.eventId});

  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(eventProvider(eventId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(title: 'This event is no longer available.', message: '$error'),
      ),
      data: (event) {
        return Scaffold(
          appBar: AppBar(title: Text(event.title)),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (event.cancelled)
                const Text('CANCELLED', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700)),
              Text(event.title, style: Theme.of(context).textTheme.headlineMedium),
              if (event.organizerName != null) Text(event.organizerName!),
              const SizedBox(height: 12),
              Text(DateFormat.yMMMMEEEEd().format(event.startsAt.toLocal())),
              Text(
                event.endsAt == null
                    ? DateFormat.jm().format(event.startsAt.toLocal())
                    : '${DateFormat.jm().format(event.startsAt.toLocal())} – ${DateFormat.jm().format(event.endsAt!.toLocal())}',
              ),
              if (event.location != null) Text('Venue · ${event.location}'),
              const SizedBox(height: 8),
              Text('${event.goingCount} going · ${event.interestedCount} interested'),
              Text(event.categoryLabel, style: const TextStyle(color: AppColors.muted)),
              if (event.description != null) ...[
                const SizedBox(height: 16),
                const Text('About', style: TextStyle(fontWeight: FontWeight.w700)),
                Text(event.description!),
              ],
              const SizedBox(height: 20),
              if (event.permissions.contains('RESPOND') && !event.cancelled) ...[
                CampusButton(
                  label: event.myResponse == 'GOING' ? 'Going' : 'Mark as going',
                  semanticLabel: event.myResponse == 'GOING' ? 'Going. Selected.' : 'Mark as going',
                  onPressed: () => ref.read(eventRepositoryProvider).respond(eventId, 'GOING').then((_) {
                    ref.invalidate(eventProvider(eventId));
                  }),
                ),
                const SizedBox(height: 8),
                CampusButton(
                  label: 'Interested',
                  secondary: true,
                  onPressed: () => ref.read(eventRepositoryProvider).respond(eventId, 'INTERESTED').then((_) {
                    ref.invalidate(eventProvider(eventId));
                  }),
                ),
              ],
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.pop(),
                child: const Text('Share uses a CampusOS event link, not a public file URL.'),
              ),
            ],
          ),
        );
      },
    );
  }
}
