import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/services/providers.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ProviderPublicScreen extends ConsumerWidget {
  const ProviderPublicScreen({super.key, required this.providerId});

  final String providerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(serviceProviderProfileProvider(providerId));

    return Scaffold(
      appBar: AppBar(title: const Text('Provider')),
      body: profile.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: error is ApiError ? error.message : ApiError.genericMessage,
          onRetry: () => ref.invalidate(serviceProviderProfileProvider(providerId)),
        ),
        data: (provider) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            Text(provider.providerName, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(provider.verified ? 'Verified Provider' : 'Not university endorsed'),
            if (provider.tagline != null) ...[
              const SizedBox(height: 8),
              Text(provider.tagline!),
            ],
            if (provider.about != null) ...[
              const SizedBox(height: 12),
              Text(provider.about!),
            ],
            const SizedBox(height: 8),
            Text(provider.ratingLabel),
            const SectionHeader('SERVICES'),
            if (provider.services.isEmpty)
              const EmptyState(
                title: 'No services published yet',
                subtitle: 'Published services from this provider appear here.',
              )
            else
              ...provider.services.map(
                (service) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(service.title),
                  subtitle: Text(service.priceLabel),
                  onTap: () => context.push(service.route),
                ),
              ),
            const SectionHeader('PROFILE'),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('CampusOS profile'),
              subtitle: const Text('The same person, not a separate account.'),
              onTap: () => context.push(provider.personRoute),
            ),
          ],
        ),
      ),
    );
  }
}
