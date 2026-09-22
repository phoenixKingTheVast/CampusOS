import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/features/profile/presentation/person_row.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class PeopleTab extends ConsumerWidget {
  const PeopleTab({super.key, required this.courseOfferingId});

  final String courseOfferingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(coursePeopleProvider(courseOfferingId));
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(error is ApiError ? error.message : ApiError.genericMessage),
      ),
      data: (people) {
        if (people.teachingTeam.isEmpty && people.students.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(20),
            child: EmptyState(title: 'No people listed for this course yet'),
          );
        }
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            if (people.teachingTeam.isNotEmpty) ...[
              const Text('Teaching team', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              ...people.teachingTeam.map(
                (person) => PersonRow(
                  person: PersonCard(id: person.id, displayName: person.name),
                  subtitle: person.roleLabel,
                  onTap: () => context.push('/app/profile/${person.id}'),
                ),
              ),
              const SizedBox(height: 16),
            ],
            if (people.students.isNotEmpty) ...[
              Text(
                'Students · ${people.students.length}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              ...people.students.map(
                (person) => PersonRow(
                  person: PersonCard(id: person.id, displayName: person.name),
                  subtitle: person.roleLabel,
                  onTap: () => context.push('/app/profile/${person.id}'),
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}
