import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class LaboratoryDetailScreen extends ConsumerWidget {
  const LaboratoryDetailScreen({super.key, required this.laboratoryId});

  final String laboratoryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(laboratoryProvider(laboratoryId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          title: 'This laboratory session is no longer available.',
          message: error is ApiError ? error.message : '$error',
        ),
      ),
      data: (item) {
        return Scaffold(
          appBar: AppBar(title: const Text('Laboratory')),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(item.title, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                [
                  item.courseCode,
                  item.status,
                  if (item.startAt != null) DateFormat.yMMMMEEEEd().add_jm().format(item.startAt!.toLocal()),
                  if (item.location != null) item.location,
                ].whereType<String>().join(' · '),
              ),
              if (item.objective != null) ...[
                const SizedBox(height: 16),
                const Text('Objective', style: TextStyle(fontWeight: FontWeight.w700)),
                Text(item.objective!),
              ],
              if (item.description != null) ...[
                const SizedBox(height: 16),
                const Text('About', style: TextStyle(fontWeight: FontWeight.w700)),
                Text(item.description!),
              ],
              if (item.instructions != null) ...[
                const SizedBox(height: 16),
                const Text('Instructions', style: TextStyle(fontWeight: FontWeight.w700)),
                Text(item.instructions!),
              ],
              if (item.safety != null) ...[
                const SizedBox(height: 16),
                const Text('Safety', style: TextStyle(fontWeight: FontWeight.w700)),
                if (item.safety!.level != null) Text('Level · ${item.safety!.level}'),
                if (item.safety!.instructions != null) Text(item.safety!.instructions!),
                if (item.safety!.requiredPpe.isNotEmpty) Text('PPE · ${item.safety!.requiredPpe.join(', ')}'),
                if (item.safety!.hazards.isNotEmpty) Text('Hazards · ${item.safety!.hazards.join(', ')}'),
              ],
              if (item.resources.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Linked resources', style: TextStyle(fontWeight: FontWeight.w700)),
                ...item.resources.map(
                  (resource) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(resource.title),
                    onTap: () => context.push('/app/learn/resource/${resource.id}'),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              CampusButton(
                label: 'Open course',
                secondary: true,
                onPressed: () => context.go('/app/learn/course/${item.courseOfferingId}/laboratory'),
              ),
            ],
          ),
        );
      },
    );
  }
}
