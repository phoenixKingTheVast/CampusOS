import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/features/resources/domain/resource_accessibility.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:flutter/material.dart';

class ResourceRow extends StatelessWidget {
  const ResourceRow({
    super.key,
    required this.item,
    required this.onTap,
  });

  final ResourceItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = ResourceAccessibility.label(
      title: item.title,
      type: item.resourceType,
      course: item.courseCode ?? '',
      uploader: item.uploadedBy ?? 'Unknown',
      endorsed: item.endorsed,
      version: item.versionNumber,
      offline: item.offline,
      historical: item.historical,
      originalOffering: item.offeringLabel,
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Semantics(
        button: true,
        label: label,
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(
                    [
                      item.resourceType,
                      item.courseCode,
                      'Uploaded by ${item.uploadedBy ?? 'Unknown'}',
                    ].join(' · '),
                    style: const TextStyle(color: AppColors.muted, fontSize: 13),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (item.endorsed) 'Endorsed',
                      'Version ${item.versionNumber}',
                      if (item.offline) 'Available offline' else 'Not saved offline',
                    ].join(' · '),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  if (item.historical)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        'From ${item.offeringLabel ?? 'a previous offering'} · historical',
                        style: const TextStyle(color: AppColors.attention, fontWeight: FontWeight.w600),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
