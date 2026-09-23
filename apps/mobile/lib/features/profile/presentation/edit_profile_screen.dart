import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/profile/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _bio = TextEditingController();
  bool _seeded = false;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!ref.read(connectivityProvider).isOnline) {
      setState(() => _error = "You're offline. Reconnect to edit your profile.");
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final current = ref.read(myProfileProvider).asData?.value;
      final repository = ref.read(profileRepositoryProvider);
      final person = await repository.updateProfile(
        displayName: _name.text.trim(),
        bio: _bio.text.trim(),
        givenName: current?.givenName ?? '',
        middleName: current?.middleName ?? '',
        familyName: current?.familyName ?? '',
      );
      final nextUsername = _username.text.trim().replaceFirst(RegExp(r'^@'), '');
      final saved = nextUsername.isEmpty || nextUsername == person.username
          ? person
          : await repository.updateUsername(nextUsername);
      ref.read(sessionProvider.notifier).setAuthenticated(saved);
      ref.invalidate(myProfileProvider);
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
    final profile = ref.watch(myProfileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Edit profile')),
      body: profile.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: error is ApiError ? error.message : ApiError.genericMessage,
          onRetry: () => ref.invalidate(myProfileProvider),
        ),
        data: (person) {
          if (!_seeded) {
            _seeded = true;
            _name.text = person.displayName ?? '';
            _username.text = person.username ?? '';
            _bio.text = person.bio ?? '';
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              const Text('Choose how other students and staff will see you.'),
              const SizedBox(height: 16),
              CampusTextField(label: 'Display name', controller: _name),
              const SizedBox(height: 12),
              CampusTextField(label: 'Username', controller: _username, hint: '@username'),
              const SizedBox(height: 12),
              CampusTextField(label: 'Bio', controller: _bio, maxLines: 3),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!),
              ],
              const SizedBox(height: 16),
              CampusButton(label: 'Save', busy: _busy, onPressed: _save),
            ],
          );
        },
      ),
    );
  }
}
