import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/notifications/providers.dart';
import 'package:campusos/shared/models/notification.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class NotificationPreferencesScreen extends ConsumerStatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  ConsumerState<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState extends ConsumerState<NotificationPreferencesScreen> {
  static const _quietHoursKey = 'quietHours';

  final _busyKeys = <String>{};
  String? _error;

  Future<void> _setToggle(String key, bool value) async {
    setState(() {
      _busyKeys.add(key);
      _error = null;
    });
    try {
      await ref.read(notificationPreferencesProvider.notifier).setToggle(key, value);
    } on ApiError catch (error) {
      if (mounted) {
        setState(() => _error = error.message);
      }
    } finally {
      if (mounted) {
        setState(() => _busyKeys.remove(key));
      }
    }
  }

  Future<void> _saveQuietHours({required String? start, required String? end}) async {
    setState(() {
      _busyKeys.add(_quietHoursKey);
      _error = null;
    });
    try {
      await ref
          .read(notificationPreferencesProvider.notifier)
          .setQuietHours(start: start, end: end);
    } on ApiError catch (error) {
      if (mounted) {
        setState(() => _error = error.message);
      }
    } finally {
      if (mounted) {
        setState(() => _busyKeys.remove(_quietHoursKey));
      }
    }
  }

  Future<void> _pickTime({
    required bool isStart,
    required NotificationPreferences preferences,
  }) async {
    final current = isStart ? preferences.quietHoursStart : preferences.quietHoursEnd;
    final picked = await showTimePicker(
      context: context,
      initialTime: _parseHourMinute(current) ??
          (isStart ? const TimeOfDay(hour: 22, minute: 0) : const TimeOfDay(hour: 6, minute: 0)),
      helpText: isStart ? 'Quiet hours start' : 'Quiet hours end',
    );
    if (picked == null) {
      return;
    }
    await _saveQuietHours(
      start: isStart ? _formatHourMinute(picked) : preferences.quietHoursStart,
      end: isStart ? preferences.quietHoursEnd : _formatHourMinute(picked),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(notificationPreferencesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Notification preferences')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorRetry(
          message: error is ApiError ? error.message : ApiError.genericMessage,
          onRetry: () => ref.invalidate(notificationPreferencesProvider),
        ),
        data: (preferences) {
          final quietHoursBusy = _busyKeys.contains(_quietHoursKey);
          final hasQuietHours =
              preferences.quietHoursStart != null || preferences.quietHoursEnd != null;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              if (_error != null) PendingActionBanner(message: _error!, isError: true),
              if (_busyKeys.isNotEmpty)
                const PendingActionBanner(message: 'Saving your choice.'),
              const Text(
                'Choose what CampusOS notifies you about. Everything you switch off still '
                'appears in the notification centre.',
                style: TextStyle(fontSize: 14, color: AppColors.muted),
              ),
              for (final group in NotificationPreferenceGroup.all) ...[
                SectionHeader(group.title),
                for (final toggle in group.toggles)
                  _ToggleRow(
                    toggle: toggle,
                    value: preferences.value(toggle.key),
                    busy: _busyKeys.contains(toggle.key),
                    onChanged: (value) => _setToggle(toggle.key, value),
                  ),
              ],
              const SectionHeader('Quiet hours'),
              const Text(
                'Pushes are held back between these times, and only take effect once both a '
                'start and an end are set. Urgent announcements always come through.',
                style: TextStyle(fontSize: 14, color: AppColors.muted),
              ),
              const SizedBox(height: 4),
              _TimeRow(
                label: 'Start',
                value: preferences.quietHoursStart,
                busy: quietHoursBusy,
                onTap: () => _pickTime(isStart: true, preferences: preferences),
              ),
              _TimeRow(
                label: 'End',
                value: preferences.quietHoursEnd,
                busy: quietHoursBusy,
                onTap: () => _pickTime(isStart: false, preferences: preferences),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: CampusTextButton(
                  label: 'Turn off quiet hours',
                  semanticLabel: 'Turn off quiet hours',
                  onPressed: hasQuietHours && !quietHoursBusy
                      ? () => _saveQuietHours(start: null, end: null)
                      : null,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.toggle,
    required this.value,
    required this.busy,
    required this.onChanged,
  });

  final NotificationPreferenceToggle toggle;
  final bool value;
  final bool busy;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final description = toggle.description;
    return MergeSemantics(
      child: Semantics(
        toggled: value,
        enabled: !busy,
        label: [
          toggle.label,
          if (description != null) description,
          value ? 'On' : 'Off',
          if (busy) 'Saving',
        ].join('. '),
        onTap: busy ? null : () => onChanged(!value),
        child: ExcludeSemantics(
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: value,
            onChanged: busy ? null : onChanged,
            title: Text(
              toggle.label,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, color: AppColors.navy),
            ),
            subtitle: description == null
                ? null
                : Text(
                    description,
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, color: AppColors.muted),
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

class _TimeRow extends StatelessWidget {
  const _TimeRow({
    required this.label,
    required this.value,
    required this.busy,
    required this.onTap,
  });

  final String label;
  final String? value;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final parsed = _parseHourMinute(value);
    final display = parsed == null ? 'Not set' : parsed.format(context);
    return MergeSemantics(
      child: Semantics(
        button: true,
        enabled: !busy,
        label: [label, display, if (busy) 'Saving'].join('. '),
        onTap: busy ? null : onTap,
        child: ExcludeSemantics(
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            onTap: busy ? null : onTap,
            title: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, color: AppColors.navy),
            ),
            trailing: busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    display,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 15, color: AppColors.muted),
                  ),
          ),
        ),
      ),
    );
  }
}

TimeOfDay? _parseHourMinute(String? value) {
  if (value == null) {
    return null;
  }
  final parts = value.split(':');
  if (parts.length != 2) {
    return null;
  }
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null || hour > 23 || minute > 59) {
    return null;
  }
  return TimeOfDay(hour: hour, minute: minute);
}

/// The API stores quiet hours as `HH:mm` strings.
String _formatHourMinute(TimeOfDay value) {
  return '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
}
