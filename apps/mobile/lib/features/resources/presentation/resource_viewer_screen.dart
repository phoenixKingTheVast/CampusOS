import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/resources/domain/metadata_edit_window.dart';
import 'package:campusos/features/resources/presentation/resource_about_sheet.dart';
import 'package:campusos/features/resources/providers.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ResourceViewerScreen extends ConsumerWidget {
  const ResourceViewerScreen({super.key, required this.resourceId});

  final String resourceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(resourceProvider(resourceId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(_messageFor(error)),
        ),
      ),
      data: (detail) {
        final resource = detail.resource;
        return Scaffold(
          appBar: AppBar(
            title: Text(resource.title),
            actions: [
              Semantics(
                button: true,
                label: 'Share resource',
                child: IconButton(
                  icon: const Icon(Icons.ios_share),
                  onPressed: () => _share(context, ref, resource),
                ),
              ),
              Semantics(
                button: true,
                label: 'More actions',
                child: IconButton(
                  icon: const Icon(Icons.more_horiz),
                  onPressed: () => _more(context, ref, detail),
                ),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (resource.isProcessing)
                const Text(ApiError.fileProcessingMessage, style: TextStyle(fontSize: 16)),
              if (resource.isRemoved)
                const Text(ApiError.resourceRemovedMessage, style: TextStyle(fontSize: 16)),
              if (resource.hasNewerOfflineVersion)
                _UpdateBanner(onUpdate: () => _saveOffline(context, ref, resource)),
              if (!resource.isProcessing && !resource.isRemoved)
                _DocumentPreview(resource: resource),
              const SizedBox(height: 16),
              Text(
                resource.description ?? 'Open this file from the course resources list.',
                style: const TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 16),
              Text(
                [
                  resource.resourceType,
                  resource.courseCode,
                  resource.offeringLabel,
                  'Version ${resource.versionNumber}',
                  if (resource.offline) 'Saved offline',
                ].whereType<String>().join(' · '),
                style: const TextStyle(color: AppColors.muted),
              ),
              if (!resource.canEditMetadata)
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text('Metadata locked. Request a correction from a lecturer if needed.'),
                ),
              if (detail.related.isNotEmpty) ...[
                const SizedBox(height: 24),
                const Text('Related resources', style: TextStyle(fontWeight: FontWeight.w700)),
                ...detail.related.map(
                  (item) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(item.title),
                    subtitle: Text([item.type, item.offering].whereType<String>().join(' · ')),
                    onTap: () => context.push('/app/learn/resource/${item.id}'),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              CampusButton(
                label: 'About this resource',
                secondary: true,
                semanticLabel: 'View details',
                onPressed: () => showModalBottomSheet<void>(
                  context: context,
                  builder: (_) => ResourceAboutSheet(detail: detail),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _messageFor(Object error) {
    if (error is ApiError) {
      if (error.isPermissionDenied) {
        return ApiError.resourceUnauthorizedMessage;
      }
      if (error.isNotFound) {
        return ApiError.resourceRemovedMessage;
      }
      return error.message;
    }
    return ApiError.genericMessage;
  }

  Future<void> _share(BuildContext context, WidgetRef ref, ResourceItem resource) async {
    try {
      final reference = await ref.read(resourceRepositoryProvider).shareReference(resource.id);
      await Clipboard.setData(ClipboardData(text: reference));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('CampusOS resource reference copied.')),
        );
      }
    } on ApiError catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _saveOffline(BuildContext context, WidgetRef ref, ResourceItem resource) async {
    try {
      await ref.read(resourceRepositoryProvider).saveOffline(resource);
      ref.invalidate(resourceProvider(resource.id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved for offline use.')),
        );
      }
    } on ApiError catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    }
  }

  Future<void> _more(BuildContext context, WidgetRef ref, ResourceDetail detail) async {
    final resource = detail.resource;
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: const Text('Save offline'),
                onTap: () {
                  Navigator.pop(context);
                  _saveOffline(context, ref, resource);
                },
              ),
              if (resource.offline)
                ListTile(
                  title: const Text('Remove offline copy'),
                  onTap: () async {
                    Navigator.pop(context);
                    await ref.read(resourceRepositoryProvider).removeOffline(resource.id);
                    ref.invalidate(resourceProvider(resource.id));
                  },
                ),
              ListTile(
                title: const Text('Share'),
                onTap: () {
                  Navigator.pop(context);
                  _share(context, ref, resource);
                },
              ),
              ListTile(
                title: const Text('Report'),
                onTap: () async {
                  Navigator.pop(context);
                  await ref.read(resourceRepositoryProvider).report(resource.id);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Thanks. We'll review this resource.")),
                    );
                  }
                },
              ),
              if (MetadataEditWindow.canEdit(canEditMetadata: resource.canEditMetadata))
                ListTile(
                  title: const Text('Edit details'),
                  onTap: () {
                    Navigator.pop(context);
                    _edit(context, ref, resource);
                  },
                )
              else
                const ListTile(
                  title: Text('Metadata locked'),
                  subtitle: Text('Request correction'),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _edit(BuildContext context, WidgetRef ref, ResourceItem resource) async {
    if (!MetadataEditWindow.canEdit(canEditMetadata: resource.canEditMetadata)) {
      return;
    }
    final title = TextEditingController(text: resource.title);
    final description = TextEditingController(text: resource.description ?? '');
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CampusTextField(label: 'Title', controller: title),
              const SizedBox(height: 12),
              CampusTextField(label: 'Description', controller: description, maxLines: 3),
              const SizedBox(height: 16),
              CampusButton(
                label: 'Save',
                onPressed: () async {
                  await ref.read(resourceRepositoryProvider).updateMetadata(
                        resourceId: resource.id,
                        canEditMetadata: resource.canEditMetadata,
                        title: title.text.trim(),
                        description: description.text.trim(),
                      );
                  ref.invalidate(resourceProvider(resource.id));
                  if (context.mounted) {
                    Navigator.pop(context);
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _DocumentPreview extends StatelessWidget {
  const _DocumentPreview({required this.resource});

  final ResourceItem resource;

  @override
  Widget build(BuildContext context) {
    final mime = resource.mimeType ?? '';
    final label = mime.contains('pdf')
        ? 'PDF preview'
        : mime.startsWith('image/')
            ? 'Image preview'
            : mime.startsWith('audio/')
                ? 'Audio player'
                : mime.startsWith('video/')
                    ? 'Video player'
                    : 'Document preview';
    return Semantics(
      label: '$label for ${resource.title}',
      child: Container(
        height: 220,
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.picture_as_pdf_outlined, size: 42, color: AppColors.deepGreen),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            Text(
              [
                resource.originalName ?? resource.title,
                if (resource.sizeBytes != null) '${(resource.sizeBytes! / (1024 * 1024)).toStringAsFixed(1)} MB',
              ].join(' · '),
              style: const TextStyle(color: AppColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _UpdateBanner extends StatelessWidget {
  const _UpdateBanner({required this.onUpdate});

  final VoidCallback onUpdate;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFE8EFE6),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          const Text('A newer version is available. '),
          Semantics(
            button: true,
            label: 'Update offline copy',
            child: TextButton(onPressed: onUpdate, child: const Text('Update')),
          ),
        ],
      ),
    );
  }
}
