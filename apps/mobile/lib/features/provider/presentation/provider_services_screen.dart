import 'package:campusos/app/providers.dart';
import 'package:campusos/features/provider/data/provider_repository.dart';
import 'package:campusos/features/provider/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ProviderServicesScreen extends ConsumerWidget {
  const ProviderServicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final services = ref.watch(providerServicesProvider);
    final online = ref.watch(connectivityProvider).isOnline;

    return Scaffold(
      appBar: AppBar(title: const Text('Your services')),
      body: services.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: providerErrorMessage(error),
          onRetry: () => ref.read(providerServicesProvider.notifier).refresh(),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () => ref.read(providerServicesProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              OfflineBanner(visible: !online),
              CampusButton(
                label: 'Create a service',
                onPressed: online ? () => context.push('/app/services/provider/services/create') : null,
              ),
              const SizedBox(height: 16),
              if (items.isEmpty)
                const EmptyState(
                  title: 'No services yet',
                  subtitle: 'Drafts and published services you own appear here.',
                )
              else
                ...items.map(
                  (item) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(item.summary.title),
                    subtitle: Text(item.summary.priceLabel),
                    trailing: StatusPill(label: item.summary.statusLabel),
                    onTap: () => context.push('/app/services/provider/services/${item.id}/edit'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
