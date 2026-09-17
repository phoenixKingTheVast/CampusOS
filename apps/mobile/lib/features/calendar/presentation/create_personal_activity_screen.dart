import 'package:campusos/features/calendar/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class CreatePersonalActivityScreen extends ConsumerStatefulWidget {
  const CreatePersonalActivityScreen({super.key});

  @override
  ConsumerState<CreatePersonalActivityScreen> createState() => _CreatePersonalActivityScreenState();
}

class _CreatePersonalActivityScreenState extends ConsumerState<CreatePersonalActivityScreen> {
  final _title = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final now = DateTime.now();
      await ref.read(calendarRepositoryProvider).createPersonal({
        'title': _title.text.trim(),
        'startTime': DateTime(now.year, now.month, now.day, 19).toUtc().toIso8601String(),
        'endTime': DateTime(now.year, now.month, now.day, 21).toUtc().toIso8601String(),
        'reminderOffsetMinutes': 30,
      });
      if (mounted) {
        context.pop();
      }
    } catch (error) {
      setState(() => _error = '$error');
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New Reminder')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          CampusTextField(controller: _title, label: 'Title', hintText: 'Study Control Systems'),
          const SizedBox(height: 12),
          const Text('Today · 19:00–21:00'),
          const Text('Reminder · 30 minutes before'),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 24),
          CampusButton(label: 'Save', busy: _busy, onPressed: _title.text.trim().isEmpty ? null : _save),
        ],
      ),
    );
  }
}
