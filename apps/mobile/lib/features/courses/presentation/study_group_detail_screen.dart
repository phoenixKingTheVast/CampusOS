import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/features/profile/presentation/person_row.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class StudyGroupDetailScreen extends ConsumerStatefulWidget {
  const StudyGroupDetailScreen({super.key, required this.studyGroupId});

  final String studyGroupId;

  @override
  ConsumerState<StudyGroupDetailScreen> createState() => _StudyGroupDetailScreenState();
}

class _StudyGroupDetailScreenState extends ConsumerState<StudyGroupDetailScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _join() async {
    setState(() => _busy = true);
    try {
      await ref.read(courseRepositoryProvider).joinStudyGroup(widget.studyGroupId);
      ref.invalidate(studyGroupProvider(widget.studyGroupId));
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
    final async = ref.watch(studyGroupProvider(widget.studyGroupId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          title: 'This study group is no longer available.',
          message: error is ApiError ? error.message : '$error',
        ),
      ),
      data: (group) {
        return Scaffold(
          appBar: AppBar(title: const Text('Study group')),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(group.name, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                [
                  if (group.courseCode != null) group.courseCode,
                  group.memberLabel,
                  if (group.isMember) 'Joined',
                  if (group.membershipStatus == 'PENDING') 'Request pending',
                ].whereType<String>().join(' · '),
                style: const TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 8),
              const Text(
                'A study group is student collaboration. It does not replace the course or the class.',
                style: TextStyle(color: AppColors.muted),
              ),
              if (group.description != null) ...[
                const SizedBox(height: 16),
                const Text('About', style: TextStyle(fontWeight: FontWeight.w700)),
                Text(group.description!),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              if (group.canJoin) ...[
                const SizedBox(height: 16),
                CampusButton(
                  label: group.membershipStatus == 'PENDING' ? 'Request pending' : 'Join group',
                  busy: _busy,
                  onPressed: group.membershipStatus == 'PENDING' ? null : _join,
                ),
              ],
              if (group.canChat) ...[
                const SizedBox(height: 8),
                CampusButton(
                  label: 'Open group chat',
                  secondary: true,
                  onPressed: () => context.push('/app/messages/${group.conversationId}'),
                ),
              ],
              if (group.members.isNotEmpty) ...[
                const SizedBox(height: 24),
                const Text('Members', style: TextStyle(fontWeight: FontWeight.w700)),
                ...group.members.map(
                  (member) => PersonRow(
                    person: PersonCard(id: member.id, displayName: member.name),
                    subtitle: member.role,
                    onTap: () => context.push('/app/profile/${member.id}'),
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
