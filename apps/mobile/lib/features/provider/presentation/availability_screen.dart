import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/provider/data/provider_repository.dart';
import 'package:campusos/features/provider/providers.dart';
import 'package:campusos/shared/models/campus_service.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AvailabilityScreen extends ConsumerStatefulWidget {
  const AvailabilityScreen({super.key});

  @override
  ConsumerState<AvailabilityScreen> createState() => _AvailabilityScreenState();
}

class _AvailabilityScreenState extends ConsumerState<AvailabilityScreen> {
  String? _serviceId;
  int _day = 1;
  final _start = TextEditingController(text: '09:00');
  final _end = TextEditingController(text: '17:00');
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _start.dispose();
    _end.dispose();
    super.dispose();
  }

  int? _minute(String value) {
    final parts = value.split(':');
    if (parts.length != 2) {
      return null;
    }
    final hours = int.tryParse(parts[0]);
    final minutes = int.tryParse(parts[1]);
    if (hours == null || minutes == null || hours > 23 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  }

  Future<void> _add(ProviderServiceDetail detail) async {
    if (!ref.read(connectivityProvider).isOnline) {
      setState(() {
        _error = "You're offline. Reconnect to send your response — nothing has been sent yet.";
      });
      return;
    }
    final start = _minute(_start.text.trim());
    final end = _minute(_end.text.trim());
    if (start == null || end == null || end <= start) {
      setState(() => _error = 'The end time must be after the start time.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final rules = detail.detail.weeklyAvailability
          .map(AvailabilityRuleInput.fromWindow)
          .toList()
        ..add(AvailabilityRuleInput(dayOfWeek: _day, startMinute: start, endMinute: end));
      await ref.read(providerRepositoryProvider).replaceAvailability(detail.id, rules);
      ref.invalidate(providerServiceProvider(detail.id));
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
    final services = ref.watch(providerServicesProvider);
    final selected = _serviceId == null ? null : ref.watch(providerServiceProvider(_serviceId!));

    return Scaffold(
      appBar: AppBar(title: const Text('Availability')),
      body: services.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: providerErrorMessage(error),
          onRetry: () => ref.read(providerServicesProvider.notifier).refresh(),
        ),
        data: (items) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            if (items.isEmpty)
              const EmptyState(
                title: 'No services yet',
                subtitle: 'Create a service before setting the hours it can be booked.',
              )
            else
              DropdownButtonFormField<String>(
                initialValue: _serviceId,
                decoration: const InputDecoration(labelText: 'Service'),
                items: [
                  for (final item in items)
                    DropdownMenuItem(value: item.id, child: Text(item.summary.title)),
                ],
                onChanged: (value) => setState(() => _serviceId = value),
              ),
            if (selected != null)
              selected.when(
                loading: () => const Padding(
                  padding: EdgeInsets.only(top: 16),
                  child: Text('Loading hours'),
                ),
                error: (error, _) => Text(providerErrorMessage(error)),
                data: (detail) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader('WEEKLY HOURS'),
                    if (detail.detail.weeklyAvailability.isEmpty)
                      const EmptyState(
                        title: 'No hours yet',
                        subtitle: 'Add a weekly window. Campus time is Africa/Harare.',
                      )
                    else
                      ...detail.detail.weeklyAvailability.map((window) => Text(window.label)),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      initialValue: _day,
                      decoration: const InputDecoration(labelText: 'Day'),
                      items: [
                        for (var day = 0; day < weekdayLabels.length; day++)
                          DropdownMenuItem(value: day, child: Text(weekdayLabels[day])),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _day = value);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _start,
                      decoration: const InputDecoration(labelText: 'Start (HH:mm)'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _end,
                      decoration: const InputDecoration(labelText: 'End (HH:mm)'),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!),
                    ],
                    const SizedBox(height: 16),
                    CampusButton(
                      label: 'Add hours',
                      busy: _busy,
                      onPressed: () => _add(detail),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
