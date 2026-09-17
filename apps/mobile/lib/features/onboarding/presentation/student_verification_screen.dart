import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/programme.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class StudentVerificationScreen extends ConsumerStatefulWidget {
  const StudentVerificationScreen({super.key});

  @override
  ConsumerState<StudentVerificationScreen> createState() =>
      _StudentVerificationScreenState();
}

class _StudentVerificationScreenState extends ConsumerState<StudentVerificationScreen> {
  final _registration = TextEditingController();
  List<Programme> _programmes = const [];
  Programme? _selected;
  String? _error;
  bool _busy = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _registration.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await ref.read(onboardingRepositoryProvider).programmes();
      if (!mounted) {
        return;
      }
      setState(() {
        _programmes = items;
        _loading = false;
      });
    } on ApiError catch (error) {
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    if (_selected == null) {
      setState(() => _error = 'Select your programme.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(onboardingRepositoryProvider).submitVerification(
            registrationNumber: _registration.text.trim(),
            programmeId: _selected!.id,
            facultyId: _selected!.facultyId,
          );
      if (!mounted) {
        return;
      }
      context.go('/onboarding/verification-pending');
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
    return Scaffold(
      appBar: AppBar(title: const Text('Student verification')),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const Text(
                    'Confirm that you are a University of Zimbabwe student. You can skip this and still use CampusOS.',
                    style: TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 20),
                  CampusTextField(
                    label: 'Registration number',
                    controller: _registration,
                    semanticLabel: 'Student registration number',
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Programme',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Semantics(
                    label: 'Programme',
                    child: DropdownButtonFormField<String>(
                      value: _selected?.id,
                      items: _programmes
                          .map(
                            (item) => DropdownMenuItem(
                              value: item.id,
                              child: Text(item.name),
                            ),
                          )
                          .toList(),
                      onChanged: (id) {
                        Programme? next;
                        for (final item in _programmes) {
                          if (item.id == id) {
                            next = item;
                            break;
                          }
                        }
                        setState(() => _selected = next);
                      },
                      decoration: const InputDecoration(hintText: 'Select programme'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _selected == null
                        ? 'Faculty will be filled in from your programme.'
                        : 'Faculty: ${_selected!.facultyName}',
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  const SizedBox(height: 16),
                  CampusTextButton(
                    label: 'Skip student ID upload',
                    onPressed: () {},
                  ),
                  if (_error != null) Text(_error!),
                  const SizedBox(height: 16),
                  CampusButton(label: 'Submit', busy: _busy, onPressed: _submit),
                  CampusTextButton(
                    label: 'Continue without verifying',
                    semanticLabel: 'Continue without verifying student status',
                    onPressed: () => context.go('/onboarding/class-verification'),
                  ),
                ],
              ),
      ),
    );
  }
}

class VerificationPendingScreen extends StatelessWidget {
  const VerificationPendingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verification pending')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Your student status is pending.',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              const Text(
                'You can keep using CampusOS while we review your details.',
              ),
              const Spacer(),
              CampusButton(
                label: 'Continue using CampusOS',
                onPressed: () => context.go('/onboarding/class-verification'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
