import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/provider/data/provider_repository.dart';
import 'package:campusos/features/provider/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ServiceEditorScreen extends ConsumerStatefulWidget {
  const ServiceEditorScreen({super.key, this.serviceId});

  final String? serviceId;

  @override
  ConsumerState<ServiceEditorScreen> createState() => _ServiceEditorScreenState();
}

class _ServiceEditorScreenState extends ConsumerState<ServiceEditorScreen> {
  final _title = TextEditingController();
  final _summary = TextEditingController();
  final _description = TextEditingController();
  final _price = TextEditingController();
  String? _categoryKey;
  String _bookingPolicy = 'REQUEST_APPROVAL';
  String? _error;
  bool _busy = false;
  bool _seeded = false;
  List<String> _transitions = const [];

  bool get _editing => widget.serviceId != null;

  @override
  void dispose() {
    _title.dispose();
    _summary.dispose();
    _description.dispose();
    _price.dispose();
    super.dispose();
  }

  void _seed(ProviderServiceDetail detail) {
    if (_seeded) {
      return;
    }
    _seeded = true;
    final summary = detail.summary;
    _title.text = summary.title;
    _summary.text = summary.summary ?? '';
    _description.text = detail.detail.description ?? '';
    _price.text = detail.priceAmount?.toString() ?? '';
    _categoryKey = summary.categoryKey;
    _bookingPolicy = summary.bookingPolicy;
  }

  ProviderServiceInput _input() {
    final amount = double.tryParse(_price.text.trim());
    return ProviderServiceInput(
      categoryKey: _categoryKey,
      title: _title.text.trim(),
      summary: _summary.text.trim(),
      description: _description.text.trim(),
      pricingModel: amount == null ? 'CUSTOM' : 'FIXED',
      priceAmount: amount,
      bookingPolicy: _bookingPolicy,
    );
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
      final repository = ref.read(providerRepositoryProvider);
      final detail = _editing
          ? await repository.updateService(widget.serviceId!, _input())
          : await repository.createService(_input());
      ref.invalidate(providerServicesProvider);
      if (!mounted) {
        return;
      }
      if (!_editing) {
        context.replace('/app/services/provider/services/${detail.id}/edit');
      }
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _transition(String action) async {
    final id = widget.serviceId;
    if (id == null) {
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(providerRepositoryProvider).changeServiceStatus(id, action);
      ref.invalidate(providerServiceProvider(id));
      ref.invalidate(providerServicesProvider);
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
    final categories = ref.watch(providerServiceCategoriesProvider);
    final existing = _editing ? ref.watch(providerServiceProvider(widget.serviceId!)) : null;

    if (existing != null) {
      existing.whenData((detail) {
        _transitions = detail.summary.status == 'DRAFT' ? const ['PUBLISH'] : const [];
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            setState(() => _seed(detail));
          }
        });
      });
    }

    return Scaffold(
      appBar: AppBar(title: Text(_editing ? 'Edit service' : 'New service')),
      body: existing != null && existing.isLoading
          ? const HomeSkeleton()
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                CampusTextField(label: 'Title', controller: _title),
                const SizedBox(height: 12),
                CampusTextField(label: 'Summary', controller: _summary),
                const SizedBox(height: 12),
                CampusTextField(label: 'Description', controller: _description, maxLines: 4),
                const SizedBox(height: 12),
                categories.when(
                  data: (items) => DropdownButtonFormField<String>(
                    initialValue: _categoryKey,
                    decoration: const InputDecoration(labelText: 'Category'),
                    items: [
                      for (final category in items)
                        DropdownMenuItem(value: category.key, child: Text(category.label)),
                    ],
                    onChanged: (value) => setState(() => _categoryKey = value),
                  ),
                  loading: () => const Text('Loading categories'),
                  error: (_, __) => const Text('Categories could not be loaded.'),
                ),
                const SizedBox(height: 12),
                CampusTextField(
                  label: 'Price amount',
                  controller: _price,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  hint: 'Leave blank when the price is custom',
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _bookingPolicy,
                  decoration: const InputDecoration(labelText: 'Booking policy'),
                  items: const [
                    DropdownMenuItem(value: 'OPEN_BOOKING', child: Text('Open booking')),
                    DropdownMenuItem(value: 'REQUEST_APPROVAL', child: Text('Request approval')),
                    DropdownMenuItem(value: 'REQUIRES_QUOTE', child: Text('Requires a quote')),
                    DropdownMenuItem(value: 'CONTACT_FIRST', child: Text('Contact first')),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _bookingPolicy = value);
                    }
                  },
                ),
                const SizedBox(height: 8),
                const Text('Publishing does not move money. Payments are not part of this release.'),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!),
                ],
                const SizedBox(height: 16),
                CampusButton(label: 'Save', busy: _busy, onPressed: _save),
                if (_editing)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: CampusButton(
                      label: 'Availability',
                      secondary: true,
                      onPressed: () => context.push('/app/services/provider/availability'),
                    ),
                  ),
                for (final action in _transitions)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: CampusButton(
                      label: action == 'PUBLISH' ? 'Publish' : action,
                      secondary: true,
                      busy: _busy,
                      onPressed: () => _transition(action),
                    ),
                  ),
              ],
            ),
    );
  }
}
