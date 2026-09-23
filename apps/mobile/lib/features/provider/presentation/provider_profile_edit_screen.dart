import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/provider/data/provider_repository.dart';
import 'package:campusos/features/provider/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ProviderProfileEditScreen extends ConsumerStatefulWidget {
  const ProviderProfileEditScreen({super.key});

  @override
  ConsumerState<ProviderProfileEditScreen> createState() => _ProviderProfileEditScreenState();
}

class _ProviderProfileEditScreenState extends ConsumerState<ProviderProfileEditScreen> {
  final _name = TextEditingController();
  final _tagline = TextEditingController();
  final _about = TextEditingController();
  final _location = TextEditingController();
  bool _seeded = false;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _tagline.dispose();
    _about.dispose();
    _location.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!ref.read(connectivityProvider).isOnline) {
      setState(() {
        _error = "You're offline. Reconnect to send your response — nothing has been sent yet.";
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(providerRepositoryProvider).updateProfile(
            providerName: _name.text.trim(),
            tagline: _tagline.text.trim(),
            about: _about.text.trim(),
            contactPreference: 'CAMPUSOS_MESSAGES',
          );
      await ref.read(providerWorkspaceProvider.notifier).refresh();
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _addLocation() async {
    final label = _location.text.trim();
    if (label.isEmpty) {
      return;
    }
    try {
      await ref.read(providerRepositoryProvider).upsertLocation(label: label);
      _location.clear();
      await ref.read(providerWorkspaceProvider.notifier).refresh();
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final workspace = ref.watch(providerWorkspaceProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Provider profile')),
      body: workspace.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: providerErrorMessage(error),
          onRetry: () => ref.read(providerWorkspaceProvider.notifier).refresh(),
        ),
        data: (data) {
          if (!_seeded && data.profile.isProvider) {
            _seeded = true;
            _name.text = data.profile.providerName ?? '';
            _tagline.text = data.profile.tagline ?? '';
            _about.text = data.profile.about ?? '';
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              CampusTextField(label: 'Provider name', controller: _name),
              const SizedBox(height: 12),
              CampusTextField(label: 'Tagline', controller: _tagline),
              const SizedBox(height: 12),
              CampusTextField(label: 'About', controller: _about, maxLines: 4),
              const SizedBox(height: 8),
              const Text('Customers reach you through CampusOS messages.'),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!),
              ],
              const SizedBox(height: 16),
              CampusButton(label: 'Save', busy: _busy, onPressed: _save),
              const SizedBox(height: 24),
              const Text('Locations'),
              for (final location in data.profile.locations)
                Text(location.label),
              const SizedBox(height: 12),
              CampusTextField(label: 'Add a location label', controller: _location),
              const SizedBox(height: 8),
              CampusButton(label: 'Add location', secondary: true, onPressed: _addLocation),
            ],
          );
        },
      ),
    );
  }
}
