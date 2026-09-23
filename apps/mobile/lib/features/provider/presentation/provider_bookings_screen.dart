import 'package:campusos/app/providers.dart';
import 'package:campusos/features/provider/providers.dart';
import 'package:campusos/shared/models/booking.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ProviderBookingsScreen extends ConsumerWidget {
  const ProviderBookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(providerBookingQueueProvider);
    final online = ref.watch(connectivityProvider).isOnline;

    return Scaffold(
      appBar: AppBar(title: const Text('Booking queue')),
      body: queue.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: "CampusOS couldn't complete that request.",
          onRetry: () => ref.read(providerBookingQueueProvider.notifier).refresh(),
        ),
        data: (view) => RefreshIndicator(
          onRefresh: () => ref.read(providerBookingQueueProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              OfflineBanner(visible: !online || view.fromCache),
              Wrap(
                spacing: 8,
                children: [
                  for (var index = 0; index < BookingFilter.provider.length; index++)
                    FilterChip(
                      label: Text(BookingFilter.provider[index].label),
                      selected: view.filterIndex == index,
                      showCheckmark: true,
                      onSelected: (_) =>
                          ref.read(providerBookingQueueProvider.notifier).setFilter(index),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              if (view.items.isEmpty)
                const EmptyState(
                  title: 'No bookings in this queue',
                  subtitle: 'Requests and confirmed bookings appear here. Confirming them is checked by the server.',
                )
              else
                ...view.items.map(
                  (booking) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(booking.service.title),
                    subtitle: Text(booking.stateLabel),
                    trailing: StatusPill(label: booking.statusLabel),
                    onTap: () => context.push(booking.route),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
