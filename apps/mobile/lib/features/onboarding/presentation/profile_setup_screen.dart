import 'dart:async';

import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _bio = TextEditingController();
  Timer? _debounce;
  String? _error;
  String? _usernameStatus;
  bool _available = false;
  bool _busy = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _name.dispose();
    _username.dispose();
    _bio.dispose();
    super.dispose();
  }

  void _onUsername(String value) {
    _debounce?.cancel();
    setState(() {
      _available = false;
      _usernameStatus = null;
    });
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      final cleaned = value.trim().replaceFirst(RegExp(r'^@'), '');
      if (cleaned.length < 3) {
        return;
      }
      try {
        final ok = await ref.read(onboardingRepositoryProvider).usernameAvailable(cleaned);
        if (!mounted) {
          return;
        }
        setState(() {
          _available = ok;
          _usernameStatus = ok ? '@$cleaned is available' : '@$cleaned is taken';
        });
      } on ApiError catch (error) {
        if (!mounted) {
          return;
        }
        setState(() => _usernameStatus = error.message);
      }
    });
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      final person = await ref.read(onboardingRepositoryProvider).saveProfile(
            displayName: _name.text.trim(),
            username: _username.text.trim(),
            bio: _bio.text.trim(),
          );
      ref.read(sessionProvider.notifier).setAuthenticated(person);
      if (!mounted) {
        return;
      }
      context.go('/onboarding/student-verification');
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
      appBar: AppBar(title: const Text('Your profile')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text('Choose how other students and staff will see you.'),
            const SizedBox(height: 20),
            CampusTextField(
              label: 'Display name',
              controller: _name,
              textCapitalization: TextCapitalization.words,
              semanticLabel: 'Display name',
            ),
            const SizedBox(height: 16),
            CampusTextField(
              label: 'Username',
              controller: _username,
              hint: '@username',
              prefix: const Padding(
                padding: EdgeInsets.only(left: 12, top: 14),
                child: Text('@'),
              ),
              onChanged: _onUsername,
              semanticLabel: 'Username',
            ),
            if (_usernameStatus != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _usernameStatus!,
                  style: TextStyle(
                    color: _available ? const Color(0xFF0F4C3A) : Theme.of(context).colorScheme.error,
                  ),
                ),
              ),
            const SizedBox(height: 16),
            CampusTextField(
              label: 'Bio (optional)',
              controller: _bio,
              maxLines: 3,
              semanticLabel: 'Bio, optional',
            ),
            const SizedBox(height: 12),
            CampusTextButton(
              label: 'Skip photo',
              onPressed: () {},
            ),
            if (_error != null) Text(_error!),
            const SizedBox(height: 24),
            CampusButton(
              label: 'Continue',
              busy: _busy,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}
