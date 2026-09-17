import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/programme.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ClassVerificationScreen extends ConsumerStatefulWidget {
  const ClassVerificationScreen({super.key});

  @override
  ConsumerState<ClassVerificationScreen> createState() =>
      _ClassVerificationScreenState();
}

class _ClassVerificationScreenState extends ConsumerState<ClassVerificationScreen> {
  final _search = TextEditingController();
  List<AcademicClass> _items = const [];
  String? _error;
  String? _notice;
  bool _busy = false;

  Future<void> _run(String query) async {
    setState(() => _busy = true);
    try {
      final items = await ref.read(onboardingRepositoryProvider).searchClasses(query);
      setState(() {
        _items = items;
        _error = null;
      });
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _request(AcademicClass item) async {
    if (!item.hasRepresentative) {
      setState(() {
        _notice =
            'No class representative available to confirm this class. You can still use other CampusOS features.';
      });
      return;
    }
    try {
      await ref.read(onboardingRepositoryProvider).requestMembership(item.id);
      setState(() => _notice = 'Request sent. A class representative will confirm this.');
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Find your class')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              CampusTextField(
                label: 'Search classes',
                controller: _search,
                hint: 'Class code or name',
                textInputAction: TextInputAction.search,
                semanticLabel: 'Search classes',
                onChanged: (value) {
                  if (value.trim().length >= 2) {
                    _run(value.trim());
                  }
                },
              ),
              if (_busy) const LinearProgressIndicator(),
              if (_error != null) Text(_error!),
              if (_notice != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_notice!, style: const TextStyle(color: AppColors.navy)),
                ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  itemCount: _items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final item = _items[index];
                    return _ClassTile(
                      item: item,
                      onRequest: () => _request(item),
                    );
                  },
                ),
              ),
              CampusTextButton(
                label: 'Skip for now',
                onPressed: () => context.go('/app/home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ClassTile extends StatelessWidget {
  const _ClassTile({required this.item, required this.onRequest});

  final AcademicClass item;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.code, style: const TextStyle(fontWeight: FontWeight.w700)),
          Text(item.name),
          if (item.semester != null) Text(item.semester!, style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 8),
          if (!item.hasRepresentative)
            const Text(
              'No class representative available to confirm this class. You can still use other CampusOS features.',
            )
          else
            Align(
              alignment: Alignment.centerLeft,
              child: CampusTextButton(
                label: 'Request membership',
                semanticLabel: 'Request membership for ${item.code}',
                onPressed: onRequest,
              ),
            ),
        ],
      ),
    );
  }
}
