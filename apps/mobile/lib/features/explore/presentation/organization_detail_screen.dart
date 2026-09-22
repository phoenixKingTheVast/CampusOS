import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/explore/providers.dart';
import 'package:campusos/features/profile/presentation/person_row.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class OrganizationDetailScreen extends ConsumerStatefulWidget {
  const OrganizationDetailScreen({super.key, required this.organizationId});

  final String organizationId;

  @override
  ConsumerState<OrganizationDetailScreen> createState() => _OrganizationDetailScreenState();
}

class _OrganizationDetailScreenState extends ConsumerState<OrganizationDetailScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      ref.invalidate(organizationProvider(widget.organizationId));
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
    final async = ref.watch(organizationProvider(widget.organizationId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          title: 'This organization is no longer available.',
          message: error is ApiError ? error.message : '$error',
        ),
      ),
      data: (org) {
        return Scaffold(
          appBar: AppBar(title: Text(org.typeLabel ?? 'Organisation')),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (org.suspended)
                const Text('SUSPENDED', style: TextStyle(color: AppColors.attention, fontWeight: FontWeight.w700)),
              if (org.closed)
                const Text('CLOSED', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700)),
              Text(org.name, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                [
                  '${org.memberCount} members',
                  '${org.followerCount} followers',
                  if (org.isMember) 'Member',
                  if (org.membershipStatus == 'PENDING') 'Request pending',
                  if (org.following) 'Following',
                ].join(' · '),
                style: const TextStyle(color: AppColors.muted),
              ),
              if (org.description != null) ...[
                const SizedBox(height: 16),
                Text(org.description!),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: 16),
              if (org.canJoin)
                CampusButton(
                  label: org.membershipPolicy == 'REQUEST_TO_JOIN' ? 'Request to join' : 'Join organisation',
                  busy: _busy,
                  onPressed: () => _run(() => ref.read(organizationRepositoryProvider).join(org.id)),
                ),
              if (org.canFollow) ...[
                const SizedBox(height: 8),
                CampusButton(
                  label: org.following ? 'Unfollow' : 'Follow',
                  secondary: true,
                  busy: _busy,
                  onPressed: () => _run(
                    () => org.following
                        ? ref.read(organizationRepositoryProvider).unfollow(org.id)
                        : ref.read(organizationRepositoryProvider).follow(org.id),
                  ),
                ),
              ],
              if (org.conversationId != null) ...[
                const SizedBox(height: 8),
                CampusButton(
                  label: 'Open organisation chat',
                  secondary: true,
                  onPressed: () => context.push('/app/messages/${org.conversationId}'),
                ),
              ],
              if (org.officers.isNotEmpty) ...[
                const SizedBox(height: 24),
                const Text('Officers', style: TextStyle(fontWeight: FontWeight.w700)),
                ...org.officers.map(
                  (officer) => PersonRow(
                    person: PersonCard(id: officer.personId, displayName: officer.name),
                    subtitle: officer.officerTitle ?? officer.role,
                    onTap: () => context.push('/app/profile/${officer.personId}'),
                  ),
                ),
              ],
              if (org.upcoming.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Upcoming events', style: TextStyle(fontWeight: FontWeight.w700)),
                ...org.upcoming.map(
                  (event) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(event.title),
                    subtitle: Text(
                      [
                        if (event.startsAt != null) DateFormat.MMMd().add_jm().format(event.startsAt!.toLocal()),
                        event.location,
                      ].whereType<String>().join(' · '),
                    ),
                    onTap: event.route == null ? null : () => context.push(event.route!),
                  ),
                ),
              ],
              if (org.posts.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Posts', style: TextStyle(fontWeight: FontWeight.w700)),
                ...org.posts.map(
                  (post) => Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          [
                            post.authorName,
                            if (post.publishedAt != null)
                              DateFormat.MMMd().add_jm().format(post.publishedAt!.toLocal()),
                          ].whereType<String>().join(' · '),
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(post.body),
                      ],
                    ),
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
