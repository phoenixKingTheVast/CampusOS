import 'package:campusos/shared/models/resource.dart';

class ResourceSection {
  const ResourceSection({
    required this.key,
    required this.label,
    required this.items,
    this.historical = false,
  });

  final String key;
  final String label;
  final List<ResourceItem> items;
  final bool historical;
}

class ResourceCatalog {
  const ResourceCatalog({required this.sections});

  final List<ResourceSection> sections;

  bool get isEmpty => sections.every((section) => section.items.isEmpty);

  factory ResourceCatalog.fromItems(List<ResourceItem> items) {
    final current = <String, List<ResourceItem>>{};
    final historical = <String, List<ResourceItem>>{};
    for (final item in items) {
      if (item.historical) {
        final label = item.offeringLabel ?? item.semesterLabel ?? 'Previous offering';
        historical.putIfAbsent(label, () => []).add(item);
        continue;
      }
      final key = item.category?.groupKey ?? 'ungrouped';
      current.putIfAbsent(key, () => []).add(item);
    }

    return ResourceCatalog(
      sections: [
        ...current.entries.map(
          (entry) => ResourceSection(
            key: entry.key,
            label: entry.value.first.category?.groupLabel ?? 'Resources',
            items: entry.value,
          ),
        ),
        ...historical.entries.map(
          (entry) => ResourceSection(
            key: 'HISTORICAL:${entry.key}',
            label: entry.key,
            items: entry.value,
            historical: true,
          ),
        ),
      ],
    );
  }
}
