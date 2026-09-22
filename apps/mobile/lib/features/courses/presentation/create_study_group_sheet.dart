import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CreateStudyGroupSheet extends ConsumerStatefulWidget {
  const CreateStudyGroupSheet({super.key, required this.courseOfferingId});

  final String courseOfferingId;

  @override
  ConsumerState<CreateStudyGroupSheet> createState() => _CreateStudyGroupSheetState();
}

class _CreateStudyGroupSheetState extends ConsumerState<CreateStudyGroupSheet> {
  final _name = TextEditingController();
  final _description = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await ref.read(courseRepositoryProvider).createStudyGroup(
            courseOfferingId: widget.courseOfferingId,
            name: _name.text.trim(),
            description: _description.text.trim().isEmpty ? null : _description.text.trim(),
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
          CampusTextField(label: 'Group name', controller: _name),
          const SizedBox(height: 12),
          CampusTextField(label: 'Description', controller: _description, maxLines: 3),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!),
          ],
          const SizedBox(height: 16),
          CampusButton(label: 'Create study group', busy: _busy, onPressed: _save),
        ],
      ),
    );
  }
}
