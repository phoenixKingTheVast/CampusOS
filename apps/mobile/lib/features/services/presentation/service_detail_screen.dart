import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/services/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({super.key, required this.serviceId});

  final String serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(serviceDetailProvider(serviceId));
    final online = ref.watch(connectivityProvider).isOnline;

    return Scaffold(
      appBar: AppBar(title: const Text('Service')),
      body: detail.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: error is ApiError ? error.message : ApiError.genericMessage,
          onRetry: () => ref.invalidate(serviceDetailProvider(serviceId)),
        ),
        data: (service) {
          final summary = service.summary;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              OfflineBanner(visible: !online),
              Text(summary.title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              StatusPill(label: summary.statusLabel),
              const SizedBox(height: 12),
              Text(summary.priceLabel, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(
                summary.ratingLabel,
                style: const TextStyle(color: AppColors.muted),
              ),
              if (service.description != null && service.description!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(service.description!),
              ],
              const SizedBox(height: 16),
              Semantics(
                button: true,
                label: 'Open ${summary.provider.providerName}',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(summary.provider.providerName),
                  subtitle: Text(
                    summary.provider.verified ? 'Verified Provider' : 'Not university endorsed',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: summary.provider.id.isEmpty
                      ? null
                      : () => context.push(summary.provider.route),
                ),
              ),
              if (summary.locationLabel != null)
                Text(summary.locationLabel!, style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 16),
              if (service.canBook)
                CampusButton(
                  label: summary.bookingPolicy == 'CONTACT_FIRST' ? 'Contact' : 'Book',
                  onPressed: online
                      ? () => context.push('/app/explore/service/$serviceId/book')
                      : null,
                )
              else
                EmptyState(
                  title: 'Booking is not available',
                  subtitle: service.unavailableReason ??
                      (online
                          ? 'This service is not taking bookings.'
                          : "You're offline and this service/booking is not saved on this device."),
                ),
              const SectionHeader('REVIEWS'),
              if (service.reviews.isEmpty)
                const EmptyState(
                  title: 'No reviews yet',
                  subtitle: 'Reviews appear after a completed booking.',
                )
              else
                ...service.reviews.map(
                  (review) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      '${review.ratingLabel}. ${review.body ?? ''}'.trim(),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
