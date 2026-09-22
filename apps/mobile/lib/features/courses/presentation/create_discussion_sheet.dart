import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CreateDiscussionSheet extends ConsumerStatefulWidget {
  const CreateDiscussionSheet({super.key, required this.courseOfferingId});

  final String courseOfferingId;

  @override
  ConsumerState<CreateDiscussionSheet> createState() => _CreateDiscussionSheetState();
}

class _CreateDiscussionSheetState extends ConsumerState<CreateDiscussionSheet> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await ref.read(courseRepositoryProvider).createDiscussion(
            courseOfferingId: widget.courseOfferingId,
            title: _title.text.trim(),
            body: _body.text.trim(),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CampusTextField(label: 'Title', controller: _title),
          const SizedBox(height: 12),
          CampusTextField(label: 'Body', controller: _body, maxLines: 4),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!),
          ],
          const SizedBox(height: 16),
          CampusButton(label: 'Post discussion', busy: _busy, onPressed: _save),
        ],
      ),
    );
  }
}
