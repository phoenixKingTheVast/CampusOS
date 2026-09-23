import 'package:campusos/app/providers.dart';
import 'package:campusos/features/services/providers.dart';
import 'package:campusos/shared/models/booking.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class BookingsScreen extends ConsumerWidget {
  const BookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookings = ref.watch(myBookingsProvider);
    final online = ref.watch(connectivityProvider).isOnline;

    return Scaffold(
      appBar: AppBar(title: const Text('My bookings')),
      body: bookings.when(
        skipLoadingOnReload: true,
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: "CampusOS couldn't complete that request.",
          onRetry: () => ref.read(myBookingsProvider.notifier).refresh(),
        ),
        data: (state) => RefreshIndicator(
          onRefresh: () => ref.read(myBookingsProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              OfflineBanner(visible: !online || state.fromCache),
              Wrap(
                spacing: 8,
                children: [
                  for (var index = 0; index < BookingFilter.customer.length; index++)
                    FilterChip(
                      label: Text(BookingFilter.customer[index].label),
                      selected: state.filterIndex == index,
                      showCheckmark: true,
                      onSelected: (_) => ref.read(myBookingsProvider.notifier).selectFilter(index),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              if (state.items.isEmpty)
                const EmptyState(
                  title: 'No bookings yet',
                  subtitle: 'Bookings you request from campus services appear here.',
                )
              else
                ...state.items.map(
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
