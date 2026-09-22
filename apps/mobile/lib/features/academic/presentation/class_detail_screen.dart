import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/academic/providers.dart';
import 'package:campusos/features/profile/presentation/person_row.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class ClassDetailScreen extends ConsumerStatefulWidget {
  const ClassDetailScreen({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<ClassDetailScreen> createState() => _ClassDetailScreenState();
}

class _ClassDetailScreenState extends ConsumerState<ClassDetailScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _request() async {
    setState(() => _busy = true);
    try {
      await ref.read(academicRepositoryProvider).requestMembership(widget.classId);
      ref.invalidate(academicClassProvider(widget.classId));
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
    final async = ref.watch(academicClassProvider(widget.classId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          title: 'This class is no longer available.',
          message: error is ApiError ? error.message : '$error',
        ),
      ),
      data: (item) {
        return Scaffold(
          appBar: AppBar(title: Text(item.code)),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(item.name, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                [
                  'Year ${item.yearOfStudy}',
                  item.facultyName,
                  item.semester,
                  if (item.isMember) 'Member',
                  if (item.isPending) 'Request pending',
                ].join(' · '),
                style: const TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 8),
              Text('${item.upcomingCount} upcoming activities'),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              if (item.canRequestMembership) ...[
                const SizedBox(height: 16),
                CampusButton(label: 'Request to join class', busy: _busy, onPressed: _request),
              ] else if (item.isPending)
                const Padding(
                  padding: EdgeInsets.only(top: 16),
                  child: Text('Your class membership request is pending a class representative.'),
                ),
              if (item.representatives.isNotEmpty) ...[
                const SizedBox(height: 24),
                const Text('Class representatives', style: TextStyle(fontWeight: FontWeight.w700)),
                ...item.representatives.map(
                  (person) => PersonRow(
                    person: PersonCard(id: person.id, displayName: person.name),
                    subtitle: 'Class representative',
                    onTap: () => context.push('/app/profile/${person.id}'),
                  ),
                ),
              ],
              if (item.activities.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Upcoming', style: TextStyle(fontWeight: FontWeight.w700)),
                ...item.activities.map(
                  (activity) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(activity.title),
                    subtitle: Text(
                      [
                        if (activity.startTime != null)
                          DateFormat.MMMd().add_jm().format(activity.startTime!.toLocal()),
                        activity.location,
                      ].whereType<String>().join(' · '),
                    ),
                    onTap: activity.route == null ? null : () => context.push(activity.route!),
                  ),
                ),
              ],
              if (item.members.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Members · ${item.members.length}', style: const TextStyle(fontWeight: FontWeight.w700)),
                ...item.members.map(
                  (person) => PersonRow(
                    person: PersonCard(id: person.id, displayName: person.name),
                    subtitle: person.role?.replaceAll('_', ' '),
                    onTap: () => context.push('/app/profile/${person.id}'),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
