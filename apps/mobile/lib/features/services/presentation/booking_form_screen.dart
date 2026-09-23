import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/services/data/bookings_repository.dart';
import 'package:campusos/features/services/providers.dart';
import 'package:campusos/shared/models/campus_service.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

class BookingFormScreen extends ConsumerStatefulWidget {
  const BookingFormScreen({super.key, required this.serviceId});

  final String serviceId;

  @override
  ConsumerState<BookingFormScreen> createState() => _BookingFormScreenState();
}

class _BookingFormScreenState extends ConsumerState<BookingFormScreen> {
  final _notes = TextEditingController();
  final _fields = <String, Object>{};
  final _clientActionId = const Uuid().v4();
  AvailabilitySlot? _slot;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit(BookingForm form) async {
    final online = ref.read(connectivityProvider).isOnline;
    if (!online) {
      setState(() {
        _error = "You're offline. Reconnect to send your response — nothing has been sent yet.";
      });
      return;
    }
    if (form.requiresTime && _slot == null) {
      setState(() => _error = 'Pick one of the offered start times.');
      return;
    }
    for (final field in form.fields) {
      if (field.fieldType == 'FILE' && field.required) {
        setState(() => _error = '${field.label} needs a file, and this release does not upload booking files.');
        return;
      }
      if (field.required && field.fieldType != 'FILE' && !_fields.containsKey(field.key)) {
        setState(() => _error = '${field.label} is required.');
        return;
      }
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final created = await ref.read(bookingsRepositoryProvider).create(
            serviceId: widget.serviceId,
            clientActionId: _clientActionId,
            online: true,
            requestedStart: _slot?.start,
            requestedEnd: _slot?.end,
            customerNotes: _notes.text,
            fieldValues: _fields,
          );
      if (!mounted) {
        return;
      }
      context.go(created.booking.route);
    } on ApiError catch (error) {
      setState(() => _error = error.code == 'CONFLICT'
          ? BookingsRepository.unavailableMessage
          : error.message);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final form = ref.watch(bookingFormProvider(widget.serviceId));
    final days = ref.watch(serviceAvailabilityProvider(widget.serviceId));

    return Scaffold(
      appBar: AppBar(title: const Text('Request a booking')),
      body: form.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: error is ApiError ? error.message : ApiError.genericMessage,
          onRetry: () => ref.invalidate(bookingFormProvider(widget.serviceId)),
        ),
        data: (bookingForm) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            Text(bookingForm.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(bookingForm.priceLabel),
            if (bookingForm.policyMessage.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(bookingForm.policyMessage),
            ],
            const SizedBox(height: 8),
            const Text('CampusOS does not take payment for this booking.'),
            if (bookingForm.requiresTime) ...[
              const SectionHeader('TIME'),
              days.when(
                loading: () => const Text('Loading times'),
                error: (error, _) => Text(
                  error is ApiError ? error.message : ApiError.genericMessage,
                ),
                data: (items) {
                  final slots = items.expand((day) => day.slots.where((slot) => slot.available));
                  if (slots.isEmpty) {
                    return const EmptyState(
                      title: 'No open times',
                      subtitle: 'This service has no available start times in the next two weeks.',
                    );
                  }
                  return Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final slot in slots)
                        FilterChip(
                          label: Text(slot.label),
                          selected: _slot?.start == slot.start,
                          showCheckmark: true,
                          onSelected: (_) => setState(() => _slot = slot),
                        ),
                    ],
                  );
                },
              ),
            ],
            const SectionHeader('DETAILS'),
            for (final field in bookingForm.fields) ...[
              if (field.fieldType == 'FILE')
                Text('${field.label} is a file. This release does not upload booking files.')
              else if (field.fieldType == 'BOOLEAN')
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(field.label),
                  value: _fields[field.key] == true,
                  onChanged: (value) => setState(() => _fields[field.key] = value),
                )
              else if (field.fieldType == 'SELECT' && field.options.isNotEmpty)
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(labelText: field.label),
                  items: [
                    for (final option in field.options)
                      DropdownMenuItem(value: option, child: Text(option)),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _fields[field.key] = value);
                    }
                  },
                )
              else
                CampusTextField(
                  label: field.label,
                  keyboardType: field.fieldType == 'NUMBER' ? TextInputType.number : null,
                  onChanged: (value) => _fields[field.key] = value,
                ),
              const SizedBox(height: 12),
            ],
            CampusTextField(
              label: 'Note for the provider',
              controller: _notes,
              maxLines: 3,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!),
            ],
            const SizedBox(height: 16),
            CampusButton(
              label: 'Send request',
              busy: _busy,
              onPressed: () => _submit(bookingForm),
            ),
          ],
        ),
      ),
    );
  }
}
