import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class ResourceAboutSheet extends StatelessWidget {
  const ResourceAboutSheet({super.key, required this.detail});

  final ResourceDetail detail;

  @override
  Widget build(BuildContext context) {
    final resource = detail.resource;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: ListView(
        shrinkWrap: true,
        children: [
          const Text('About', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          _Row(label: 'Uploaded by', value: resource.uploadedBy ?? 'Unknown'),
          _Row(label: 'Author', value: resource.authoredBy ?? 'Unknown'),
          _Row(label: 'Course', value: '${resource.courseCode ?? ''} ${resource.courseTitle ?? ''}'.trim()),
          _Row(label: 'Offering', value: resource.offeringLabel ?? resource.semesterLabel ?? ''),
          _Row(
            label: 'Endorsed by',
            value: detail.endorsement?.endorserName ?? resource.endorserName ?? 'Not endorsed',
          ),
          const SizedBox(height: 16),
          const Text('Versions', style: TextStyle(fontWeight: FontWeight.w700)),
          if (detail.versions.isEmpty)
            Text('Version ${resource.versionNumber}')
          else
            ...detail.versions.map(
              (version) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('Version ${version.versionNumber}${version.current ? ' · current' : ''}'),
                subtitle: Text(
                  [
                    version.changeSummary,
                    if (version.createdAt != null)
                      DateFormat.yMMMd().add_jm().format(version.createdAt!.toLocal()),
                  ].whereType<String>().join(' · '),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          Text(value, style: const TextStyle(fontSize: 16)),
        ],
      ),
    );
  }
}
