import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/features/resources/domain/resource_catalog.dart';
import 'package:campusos/features/resources/presentation/resource_row.dart';
import 'package:campusos/features/resources/presentation/upload_resource_sheet.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ResourcesTab extends ConsumerStatefulWidget {
  const ResourcesTab({super.key, required this.courseOfferingId});

  final String courseOfferingId;

  @override
  ConsumerState<ResourcesTab> createState() => _ResourcesTabState();
}

class _ResourcesTabState extends ConsumerState<ResourcesTab> {
  final _query = TextEditingController();
  String _needle = '';

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final online = ref.watch(connectivityProvider).isOnline;
    final async = ref.watch(courseResourcesProvider(widget.courseOfferingId));
    return async.when(
      loading: () => const HomeSkeleton(),
      error: (error, _) {
        final message = error is ApiError ? error.message : ApiError.resourceUnauthorizedMessage;
        if (!online) {
          return const Padding(
            padding: EdgeInsets.all(20),
            child: EmptyState(
              title: "You're offline.",
              subtitle: 'Connect to the internet to load course resources.',
            ),
          );
        }
        return Center(child: Text(message));
      },
      data: (list) {
        final filtered = _filter(list.items);
        final catalog = ResourceCatalog.fromItems(filtered);
        return Scaffold(
          backgroundColor: Colors.transparent,
          floatingActionButton: list.permissions.canCreateResource
              ? Semantics(
                  button: true,
                  label: 'Upload resource',
                  child: FloatingActionButton(
                    onPressed: () => _upload(list),
                    child: const Icon(Icons.upload_file),
                  ),
                )
              : null,
          body: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                child: Semantics(
                  textField: true,
                  label: 'Search this course',
                  child: TextField(
                    controller: _query,
                    decoration: const InputDecoration(
                      hintText: 'Search this course',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (value) => setState(() => _needle = value),
                  ),
                ),
              ),
              OfflineBanner(
                visible: !online,
                lastUpdated: 'Showing saved resources',
              ),
              Expanded(
                child: catalog.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(20),
                        child: EmptyState(
                          title: _needle.trim().isEmpty ? 'No resources yet.' : 'No matching resources.',
                          subtitle: _needle.trim().isEmpty
                              ? 'Resources uploaded for this course will appear here.'
                              : 'Try a different search.',
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 88),
                        children: [
                          for (final section in catalog.sections) ...[
                            Padding(
                              padding: const EdgeInsets.only(top: 12, bottom: 8),
                              child: Text(
                                section.historical
                                    ? 'HISTORICAL · ${section.label}'
                                    : section.label.toUpperCase(),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.muted,
                                ),
                              ),
                            ),
                            ...section.items.map(
                              (item) => ResourceRow(
                                item: item,
                                onTap: () => context.push('/app/learn/resource/${item.id}'),
                              ),
                            ),
                          ],
                        ],
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  List<ResourceItem> _filter(List<ResourceItem> items) {
    final needle = _needle.trim().toLowerCase();
    if (needle.isEmpty) {
      return items;
    }
    return items
        .where(
          (item) =>
              item.title.toLowerCase().contains(needle) ||
              item.resourceType.toLowerCase().contains(needle) ||
              (item.description ?? '').toLowerCase().contains(needle) ||
              (item.offeringLabel ?? '').toLowerCase().contains(needle),
        )
        .toList();
  }

  Future<void> _upload(ResourceList list) async {
    final categories = await ref.read(resourceRepositoryProvider).categories();
    if (!mounted) {
      return;
    }
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => UploadResourceSheet(
        courseOfferingId: widget.courseOfferingId,
        categories: categories,
      ),
    );
    if (created == true) {
      ref.invalidate(courseResourcesProvider(widget.courseOfferingId));
    }
  }
}
