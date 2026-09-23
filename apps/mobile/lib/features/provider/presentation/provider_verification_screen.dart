import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/provider/data/provider_repository.dart';
import 'package:campusos/features/provider/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ProviderVerificationScreen extends ConsumerStatefulWidget {
  const ProviderVerificationScreen({super.key});

  @override
  ConsumerState<ProviderVerificationScreen> createState() =>
      _ProviderVerificationScreenState();
}

class _ProviderVerificationScreenState extends ConsumerState<ProviderVerificationScreen> {
  final _notes = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
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
      await ref.read(providerRepositoryProvider).submitVerification(notes: _notes.text.trim());
      await ref.read(providerWorkspaceProvider.notifier).refresh();
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
    final workspace = ref.watch(providerWorkspaceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Provider verification')),
      body: workspace.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: providerErrorMessage(error),
          onRetry: () => ref.read(providerWorkspaceProvider.notifier).refresh(),
        ),
        data: (data) {
          final latest = data.profile.latestVerification;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              Text(data.profile.verificationLabel, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              const Text(
                'Signing in does not endorse a provider. The university label appears only when the server says the provider is verified.',
              ),
              if (latest?.rejectionReason != null) ...[
                const SizedBox(height: 12),
                Text(latest!.rejectionReason!),
              ],
              if (!data.profile.isProvider)
                const EmptyState(
                  title: 'No provider profile yet',
                  subtitle: 'Create a provider profile before requesting verification.',
                )
              else ...[
                const SizedBox(height: 16),
                CampusTextField(
                  label: 'Notes for reviewers',
                  controller: _notes,
                  maxLines: 4,
                ),
                const SizedBox(height: 8),
                const Text('Evidence is optional. A photo is not required to submit.'),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!),
                ],
                const SizedBox(height: 16),
                CampusButton(label: 'Submit for review', busy: _busy, onPressed: _submit),
              ],
            ],
          );
        },
      ),
    );
  }
}
