import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class UploadResourceSheet extends ConsumerStatefulWidget {
  const UploadResourceSheet({
    super.key,
    required this.courseOfferingId,
    required this.categories,
  });

  final String courseOfferingId;
  final List<ResourceCategory> categories;

  @override
  ConsumerState<UploadResourceSheet> createState() => _UploadResourceSheetState();
}

class _PickedFile {
  const _PickedFile({
    required this.name,
    required this.bytes,
    required this.mimeType,
  });

  final String name;
  final List<int> bytes;
  final String mimeType;
}

class _UploadResourceSheetState extends ConsumerState<UploadResourceSheet> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  ResourceCategory? _category;
  String _status = 'Choose a file to begin.';
  bool _busy = false;
  String? _error;
  _PickedFile? _file;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    setState(() => _error = null);
    final result = await FilePicker.platform.pickFiles(withData: true);
    if (!mounted || result == null || result.files.isEmpty) {
      return;
    }
    final picked = result.files.single;
    final bytes = picked.bytes;
    if (bytes == null || bytes.isEmpty) {
      setState(() => _error = 'That file could not be read on this device.');
      return;
    }
    setState(() {
      _file = _PickedFile(
        name: picked.name,
        bytes: bytes,
        mimeType: _mimeType(picked.extension),
      );
      _status = picked.name;
    });
  }

  String _mimeType(String? extension) {
    switch (extension?.toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'txt':
        return 'text/plain';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'ppt':
        return 'application/vnd.ms-powerpoint';
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      default:
        return 'application/octet-stream';
    }
  }

  Future<void> _upload() async {
    final file = _file;
    if (file == null || file.bytes.isEmpty) {
      setState(() => _error = 'Choose a file first.');
      return;
    }
    if (_title.text.trim().length < 3) {
      setState(() => _error = 'Add a title before uploading.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _status = 'Uploading...';
    });
    try {
      await ref.read(resourceRepositoryProvider).uploadResource(
            courseOfferingId: widget.courseOfferingId,
            title: _title.text.trim(),
            description: _description.text.trim(),
            resourceType: _category?.key ?? 'STUDENT_NOTES',
            categoryId: _category?.id,
            fileName: file.name,
            mimeType: file.mimeType,
            bytes: file.bytes,
            onStatus: (status) {
              if (mounted) {
                setState(() => _status = status);
              }
            },
          );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CampusTextField(label: 'Title', controller: _title),
            const SizedBox(height: 12),
            CampusTextField(label: 'Description', controller: _description, maxLines: 3),
            const SizedBox(height: 12),
            if (widget.categories.isNotEmpty)
              DropdownButtonFormField<String>(
                initialValue: _category?.key,
                decoration: const InputDecoration(labelText: 'Category'),
                items: widget.categories
                    .map(
                      (item) => DropdownMenuItem(
                        value: item.key,
                        child: Text(item.label),
                      ),
                    )
                    .toList(),
                onChanged: (key) {
                  ResourceCategory? next;
                  for (final item in widget.categories) {
                    if (item.key == key) {
                      next = item;
                      break;
                    }
                  }
                  setState(() => _category = next);
                },
              ),
            const SizedBox(height: 12),
            CampusButton(
              label: 'Choose file',
              secondary: true,
              onPressed: _busy ? null : _pick,
            ),
            const SizedBox(height: 12),
            Text(_status),
            if (_error != null) Text(_error!),
            const SizedBox(height: 16),
            CampusButton(label: 'Upload resource', busy: _busy, onPressed: _upload),
          ],
        ),
      ),
    );
  }
}
