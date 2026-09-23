import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/features/services/providers.dart';
import 'package:campusos/shared/models/campus_service.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ServicesBrowseScreen extends ConsumerStatefulWidget {
  const ServicesBrowseScreen({super.key});

  @override
  ConsumerState<ServicesBrowseScreen> createState() => _ServicesBrowseScreenState();
}

class _ServicesBrowseScreenState extends ConsumerState<ServicesBrowseScreen> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(serviceCatalogProvider);
    final categories = ref.watch(serviceCategoriesProvider);
    final online = ref.watch(connectivityProvider).isOnline;

    return Scaffold(
      appBar: AppBar(title: const Text('Campus services')),
      body: catalog.when(
        skipLoadingOnReload: true,
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: error is Exception ? error.toString() : "CampusOS couldn't complete that request.",
          onRetry: () => ref.read(serviceCatalogProvider.notifier).refresh(),
        ),
        data: (state) => RefreshIndicator(
          onRefresh: () => ref.read(serviceCatalogProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              OfflineBanner(visible: !online || state.fromCache),
              TextField(
                controller: _query,
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(labelText: 'Search services'),
                onSubmitted: (value) => ref.read(serviceCatalogProvider.notifier).search(value),
              ),
              const SizedBox(height: 12),
              categories.when(
                data: (items) => Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _CategoryChip(
                      label: 'All',
                      selected: state.categoryKey == null,
                      onSelected: () => ref.read(serviceCatalogProvider.notifier).selectCategory(null),
                    ),
                    ...items.map(
                      (category) => _CategoryChip(
                        label: category.label,
                        selected: state.categoryKey == category.key,
                        onSelected: () =>
                            ref.read(serviceCatalogProvider.notifier).selectCategory(category.key),
                      ),
                    ),
                  ],
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
              const SizedBox(height: 16),
              if (state.items.isEmpty)
                const EmptyState(
                  title: 'No services published yet',
                  subtitle: 'Student and campus services appear here once published.',
                )
              else
                ...state.items.map((item) => _ServiceRow(item: item)),
              if (state.hasMore)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: OutlinedButton(
                    onPressed: state.loadingMore
                        ? null
                        : () => ref.read(serviceCatalogProvider.notifier).loadMore(),
                    child: Text(state.loadingMore ? 'Loading' : 'Show more'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      showCheckmark: true,
      onSelected: (_) => onSelected(),
    );
  }
}

class _ServiceRow extends StatelessWidget {
  const _ServiceRow({required this.item});

  final ServiceSummary item;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: item.semanticLabel,
      child: Card(
        margin: const EdgeInsets.only(bottom: 10),
        color: AppColors.ivory,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.line),
        ),
        child: ListTile(
          title: Text(item.title),
          subtitle: Text('${item.provider.providerName} · ${item.priceLabel}'),
          trailing: StatusPill(label: item.statusLabel),
          onTap: () => context.push(item.route),
        ),
      ),
    );
  }
}
