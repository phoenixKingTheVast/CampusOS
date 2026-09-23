import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/settings/providers.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PrivacySettingsScreen extends ConsumerStatefulWidget {
  const PrivacySettingsScreen({super.key});

  @override
  ConsumerState<PrivacySettingsScreen> createState() => _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState extends ConsumerState<PrivacySettingsScreen> {
  String? _busyField;
  String? _error;

  Future<void> _patch(String field, Object? value) async {
    setState(() {
      _busyField = field;
      _error = null;
    });
    try {
      await ref.read(privacySettingsProvider.notifier).apply({field: value});
    } on ApiError catch (error) {
      if (mounted) {
        setState(() => _error = error.message);
      }
    } finally {
      if (mounted) {
        setState(() => _busyField = null);
      }
    }
  }

  Future<void> _chooseAudience(PrivacyAudienceField field, String selected) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => _AudienceSheet(field: field, selected: selected),
    );
    if (choice == null || choice == selected || !mounted) {
      return;
    }
    await _patch(field.field, choice);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(privacySettingsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorRetry(
          message: error is ApiError ? error.message : ApiError.genericMessage,
          onRetry: () => ref.invalidate(privacySettingsProvider),
        ),
        data: (settings) {
          final saving = _busyField != null;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              if (_error != null) PendingActionBanner(message: _error!, isError: true),
              if (saving) const PendingActionBanner(message: 'Saving your choice.'),
              const Text(
                'People you share a class, course or organization with can always see you there, '
                'whatever you choose here.',
                style: TextStyle(fontSize: 14, color: AppColors.muted),
              ),
              const SectionHeader('Discovery'),
              _FindableRow(
                value: settings.findable,
                busy: _busyField == 'findable',
                enabled: !saving,
                onChanged: (value) => _patch('findable', value),
              ),
              const SectionHeader('Audiences'),
              for (final field in PrivacyAudienceField.all)
                _AudienceRow(
                  field: field,
                  value: settings.value(field.field),
                  busy: _busyField == field.field,
                  enabled: !saving,
                  onTap: () => _chooseAudience(field, settings.value(field.field)),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _FindableRow extends StatelessWidget {
  const _FindableRow({
    required this.value,
    required this.busy,
    required this.enabled,
    required this.onChanged,
  });

  final bool value;
  final bool busy;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  static const _description =
      'When this is off, people can only reach your profile through a class, course or '
      'organization you share.';

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Semantics(
        toggled: value,
        enabled: enabled,
        label: [
          'Findable in search',
          _description,
          value ? 'On' : 'Off',
          if (busy) 'Saving',
        ].join('. '),
        onTap: enabled ? () => onChanged(!value) : null,
        child: ExcludeSemantics(
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: value,
            onChanged: enabled ? onChanged : null,
            title: const Text(
              'Findable in search',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 16, color: AppColors.navy),
            ),
            subtitle: const Text(
              _description,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, color: AppColors.muted),
            ),
            secondary: SizedBox(
              width: 20,
              height: 20,
              child: busy ? const CircularProgressIndicator(strokeWidth: 2) : null,
            ),
          ),
        ),
      ),
    );
  }
}

class _AudienceRow extends StatelessWidget {
  const _AudienceRow({
    required this.field,
    required this.value,
    required this.busy,
    required this.enabled,
    required this.onTap,
  });

  final PrivacyAudienceField field;
  final String value;
  final bool busy;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final description = field.description;
    final selection = privacyAudienceLabel(value);
    return MergeSemantics(
      child: Semantics(
        button: true,
        enabled: enabled,
        label: [
          field.label,
          selection,
          if (description != null) description,
          if (busy) 'Saving',
        ].join('. '),
        onTap: enabled ? onTap : null,
        child: ExcludeSemantics(
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            onTap: enabled ? onTap : null,
            title: Text(
              field.label,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, color: AppColors.navy),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  selection,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, color: AppColors.forest),
                ),
                if (description != null)
                  Text(
                    description,
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, color: AppColors.muted),
                  ),
              ],
            ),
            trailing: busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.chevron_right, color: AppColors.muted),
          ),
        ),
      ),
    );
  }
}

class _AudienceSheet extends StatelessWidget {
  const _AudienceSheet({required this.field, required this.selected});

  final PrivacyAudienceField field;
  final String selected;

  @override
  Widget build(BuildContext context) {
    final description = field.description;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MergeSemantics(
              child: Semantics(
                header: true,
                label: field.label,
                child: ExcludeSemantics(
                  child: Text(
                    field.label,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy,
                    ),
                  ),
                ),
              ),
            ),
            if (description != null) ...[
              const SizedBox(height: 6),
              Text(
                description,
                style: const TextStyle(fontSize: 13, color: AppColors.muted),
              ),
            ],
            const SizedBox(height: 8),
            for (final option in field.options)
              _AudienceOption(
                label: privacyAudienceLabel(option),
                selected: option == selected,
                onTap: () => Navigator.of(context).pop(option),
              ),
          ],
        ),
      ),
    );
  }
}

class _AudienceOption extends StatelessWidget {
  const _AudienceOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Semantics(
        button: true,
        selected: selected,
        inMutuallyExclusiveGroup: true,
        label: '$label. ${selected ? 'Selected' : 'Not selected'}',
        onTap: onTap,
        child: ExcludeSemantics(
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            onTap: onTap,
            title: Text(
              label,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 16,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: AppColors.navy,
              ),
            ),
            trailing: selected
                ? const Icon(Icons.check, color: AppColors.deepGreen)
                : const SizedBox(width: 24),
          ),
        ),
      ),
    );
  }
}
