import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/profile/presentation/person_row.dart';
import 'package:campusos/features/profile/presentation/social_list_screen.dart';
import 'package:campusos/features/profile/providers.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/person_avatar.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Actions drawn as full-width buttons, in the order the server lists them.
const _primaryActions = <String>[
  'EDIT_PROFILE',
  'FOLLOW',
  'UNFOLLOW',
  'CONNECT',
  'ACCEPT_CONNECTION',
  'CANCEL_CONNECTION_REQUEST',
  'REMOVE_CONNECTION',
  'MESSAGE',
];

const _safetyActions = <String>['BLOCK', 'UNBLOCK', 'REPORT'];

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key, this.personId});

  /// Null means the signed-in person's own profile.
  final String? personId;

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  String? _pendingAction;
  String? _banner;
  bool _bannerIsError = false;

  @override
  Widget build(BuildContext context) {
    final personId = widget.personId ?? ref.watch(viewerIdProvider);
    if (personId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Profile')),
        body: const SafeArea(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: EmptyState(
              title: 'Sign in to see your profile',
              subtitle: ApiError.unauthenticatedMessage,
            ),
          ),
        ),
      );
    }

    final async = ref.watch(personProfileProvider(personId));
    final online = ref.watch(connectivityProvider).isOnline;
    return Scaffold(
      appBar: AppBar(
        title: Text(async.asData?.value.isSelf == true ? 'Your profile' : 'Profile'),
      ),
      body: SafeArea(
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ErrorRetry(
            message: error is ApiError ? error.message : ApiError.genericMessage,
            onRetry: () =>
                ref.read(personProfileProvider(personId).notifier).refresh(),
          ),
          data: (profile) => RefreshIndicator(
            onRefresh: () =>
                ref.read(personProfileProvider(personId).notifier).refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                OfflineBanner(visible: !online),
                if (_banner != null)
                  PendingActionBanner(
                    message: _banner!,
                    isError: _bannerIsError,
                  ),
                ..._header(context, profile),
                if (profile.restricted)
                  ..._restricted(profile)
                else
                  ..._body(context, profile),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _header(BuildContext context, PersonProfile profile) {
    final handle = profile.handle;
    final accountState = profile.accountState;
    return [
      Row(
        children: [
          PersonAvatar(
            initials: personInitials(profile.name),
            size: 64,
            semanticLabel: profile.isSelf
                ? 'Your profile photo'
                : 'Profile photo for ${profile.name}',
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  profile.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (handle != null)
                  Text(
                    handle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.muted),
                  ),
              ],
            ),
          ),
        ],
      ),
      // A restricted profile carries no relationship, so nothing is claimed
      // about one.
      if (!profile.isSelf && !profile.restricted)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Align(
            alignment: Alignment.centerLeft,
            child: StatusPill(
              label: profile.relationship.label,
              tone: _relationshipTone(profile.relationship),
            ),
          ),
        ),
      if (profile.isSelf && accountState != null)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Align(
            alignment: Alignment.centerLeft,
            child: StatusPill(
              label: 'Account: ${accountState.replaceAll('_', ' ').toLowerCase()}',
              tone: _accountStateTone(accountState),
            ),
          ),
        ),
      if (profile.bio != null)
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Text(profile.bio!, style: const TextStyle(fontSize: 15)),
        ),
    ];
  }

  List<Widget> _restricted(PersonProfile profile) {
    final message =
        profile.restrictionMessage ?? "This profile isn't visible to you.";
    return [
      Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 8),
        child: Semantics(
          liveRegion: true,
          label: message,
          child: ExcludeSemantics(
            child: Text(
              message,
              style: const TextStyle(fontSize: 15, color: AppColors.muted),
            ),
          ),
        ),
      ),
      ..._safety(profile),
    ];
  }

  List<Widget> _body(BuildContext context, PersonProfile profile) {
    final messagingReason = profile.messagingReason;
    return [
      const SizedBox(height: 20),
      _CountsRow(profile: profile),
      const SizedBox(height: 24),
      for (final action in profile.actions.where(_primaryActions.contains))
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: CampusButton(
            label: _actionLabel(action),
            secondary: _isReversal(action),
            busy: _pendingAction == action,
            semanticLabel: profile.isSelf
                ? _actionLabel(action)
                : '${_actionLabel(action)} ${profile.name}',
            onPressed:
                _pendingAction == null ? () => _handle(action, profile) : null,
          ),
        ),
      if (!profile.isSelf && !profile.canMessage && messagingReason != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(
            messagingReason,
            style: const TextStyle(fontSize: 13, color: AppColors.muted),
          ),
        ),
      ..._sharedContext(context, profile),
      if (profile.isSelf)
        ..._selfLinks(context, profile)
      else
        ..._safety(profile),
    ];
  }

  List<Widget> _safety(PersonProfile profile) {
    final actions = profile.actions.where(_safetyActions.contains).toList();
    if (actions.isEmpty) {
      return const [];
    }
    return [
      const SizedBox(height: 8),
      const SectionHeader('Safety'),
      for (final action in actions)
        Align(
          alignment: Alignment.centerLeft,
          child: CampusTextButton(
            label: _actionLabel(action),
            semanticLabel: '${_actionLabel(action)} ${profile.name}',
            onPressed:
                _pendingAction == null ? () => _handle(action, profile) : null,
          ),
        ),
    ];
  }

  List<Widget> _sharedContext(BuildContext context, PersonProfile profile) {
    final items = profile.sharedContext.all
        .where((item) => item.label.isNotEmpty)
        .toList();
    if (items.isEmpty) {
      return const [];
    }
    return [
      const SizedBox(height: 8),
      SectionHeader(
        profile.isSelf ? 'Your classes and groups' : 'You both belong to',
      ),
      for (final item in items)
        _LinkRow(
          label: item.label,
          detail: [_kindLabel(item.kind), item.detail]
              .whereType<String>()
              .join(' · '),
          onTap: item.route == null ? null : () => context.push(item.route!),
        ),
    ];
  }

  List<Widget> _selfLinks(BuildContext context, PersonProfile profile) {
    return [
      const SizedBox(height: 8),
      const SectionHeader('Your account'),
      _LinkRow(
        label: 'Connection requests',
        detail: 'People waiting for your answer',
        onTap: () => SocialListScreen.push(
          context,
          personId: profile.id,
          list: SocialListKind.connectionRequests,
        ),
      ),
      _LinkRow(
        label: 'Blocked accounts',
        detail: 'Review and undo blocks',
        onTap: () => SocialListScreen.push(
          context,
          personId: profile.id,
          list: SocialListKind.blocked,
        ),
      ),
      _LinkRow(
        label: 'Privacy settings',
        detail: 'Who can see, follow and message you',
        onTap: () => context.push('/app/settings/privacy'),
      ),
      const SizedBox(height: 20),
      CampusButton(
        label: 'Sign out',
        secondary: true,
        semanticLabel: 'Sign out of CampusOS',
        onPressed: _signOut,
      ),
    ];
  }

  Future<void> _handle(String action, PersonProfile profile) async {
    final repository = ref.read(profileRepositoryProvider);
    switch (action) {
      case 'EDIT_PROFILE':
        context.push('/app/profile/edit');
      case 'FOLLOW':
        await _run(
          action,
          personId: profile.id,
          body: () => repository.follow(profile.id),
        );
      case 'UNFOLLOW':
        await _run(
          action,
          personId: profile.id,
          body: () => repository.unfollow(profile.id),
        );
      case 'CONNECT':
        await _run(
          action,
          personId: profile.id,
          body: () => repository.requestConnection(profile.id),
        );
      case 'ACCEPT_CONNECTION':
        await _run(
          action,
          personId: profile.id,
          body: () => repository.acceptConnection(profile.id),
        );
      case 'CANCEL_CONNECTION_REQUEST':
        await _run(
          action,
          personId: profile.id,
          body: () => repository.withdrawConnection(profile.id),
        );
      case 'REMOVE_CONNECTION':
        await _removeConnection(profile);
      case 'MESSAGE':
        await _startConversation(profile);
      case 'BLOCK':
        await _block(profile);
      case 'UNBLOCK':
        await _unblock(profile);
      case 'REPORT':
        await _report(profile);
    }
  }

  Future<void> _removeConnection(PersonProfile profile) async {
    final confirmed = await confirmSocialAction(
      context,
      title: 'Remove ${profile.name} as a connection?',
      message:
          'You will both stop being connections. Either of you can send a new request later.',
      confirmLabel: 'Remove connection',
    );
    if (!confirmed) {
      return;
    }
    await _run(
      'REMOVE_CONNECTION',
      personId: profile.id,
      body: () =>
          ref.read(profileRepositoryProvider).withdrawConnection(profile.id),
    );
  }

  Future<void> _block(PersonProfile profile) async {
    final confirmed = await confirmSocialAction(
      context,
      title: 'Block ${profile.name}?',
      message:
          'You will not see each other on CampusOS, and any follow or connection between you is removed. '
          'Blocking does not remove shared class, course or organization memberships, so you may still meet in those spaces.',
      confirmLabel: 'Block',
    );
    if (!confirmed) {
      return;
    }
    await _run(
      'BLOCK',
      personId: profile.id,
      body: () => ref.read(profileRepositoryProvider).block(profile.id),
    );
  }

  Future<void> _unblock(PersonProfile profile) async {
    final confirmed = await confirmSocialAction(
      context,
      title: 'Unblock ${profile.name}?',
      message:
          'You will be able to see each other again. The follows and connection the block removed are not restored.',
      confirmLabel: 'Unblock',
    );
    if (!confirmed) {
      return;
    }
    await _run(
      'UNBLOCK',
      personId: profile.id,
      body: () => ref.read(profileRepositoryProvider).unblock(profile.id),
    );
  }

  Future<void> _report(PersonProfile profile) async {
    final input = await showDialog<_ReportInput>(
      context: context,
      builder: (_) => _ReportDialog(personName: profile.name),
    );
    if (input == null) {
      return;
    }
    String? acknowledgement;
    final sent = await _run(
      'REPORT',
      personId: profile.id,
      reload: false,
      body: () async {
        acknowledgement = await ref.read(profileRepositoryProvider).report(
              profile.id,
              reason: input.reason,
              details: input.details,
            );
      },
    );
    if (!sent || !mounted) {
      return;
    }
    setState(() {
      _banner = acknowledgement;
      _bannerIsError = false;
    });
  }

  Future<void> _startConversation(PersonProfile profile) async {
    String? conversationId;
    final started = await _run(
      'MESSAGE',
      personId: profile.id,
      reload: false,
      body: () async {
        conversationId = await ref
            .read(profileRepositoryProvider)
            .startDirectConversation(profile.id);
      },
    );
    final id = conversationId;
    if (!started || id == null) {
      return;
    }
    if (!mounted) {
      return;
    }
    context.push('/app/messages/$id');
  }

  Future<void> _signOut() async {
    final confirmed = await confirmSocialAction(
      context,
      title: 'Sign out?',
      message:
          'You will need your phone number and a new verification code to sign back in.',
      confirmLabel: 'Sign out',
      destructive: false,
    );
    if (!confirmed) {
      return;
    }
    await ref.read(profileRepositoryProvider).logout();
    ref.read(sessionProvider.notifier).clear();
    if (!mounted) {
      return;
    }
    context.go('/welcome');
  }

  /// Runs one relationship mutation. Connectivity is required, the pending
  /// state is explicit, and nothing on screen moves until the profile has been
  /// re-read from the server.
  Future<bool> _run(
    String action, {
    required String personId,
    required Future<void> Function() body,
    bool reload = true,
  }) async {
    if (!ref.read(connectivityProvider).isOnline) {
      setState(() {
        _pendingAction = null;
        _banner = _offlineMessage(action);
        _bannerIsError = true;
      });
      return false;
    }
    setState(() {
      _pendingAction = action;
      _banner = _pendingMessage(action);
      _bannerIsError = false;
    });
    try {
      await body();
    } on ApiError catch (error) {
      if (!mounted) {
        return false;
      }
      setState(() {
        _pendingAction = null;
        _banner = error.message;
        _bannerIsError = true;
      });
      return false;
    }
    if (!mounted) {
      return false;
    }
    if (reload) {
      await ref.read(personProfileProvider(personId).notifier).refresh();
      if (!mounted) {
        return false;
      }
    }
    setState(() {
      _pendingAction = null;
      _banner = null;
    });
    return true;
  }
}

class _CountsRow extends StatelessWidget {
  const _CountsRow({required this.profile});

  final PersonProfile profile;

  @override
  Widget build(BuildContext context) {
    final counts = profile.counts;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _CountTile(
            title: 'Followers',
            count: counts.followers,
            spoken: (value) =>
                '$value ${value == 1 ? 'follower' : 'followers'}',
            hidden: 'Follower count is hidden by privacy settings',
            onTap: () => context.push('/app/profile/${profile.id}/followers'),
          ),
        ),
        Expanded(
          child: _CountTile(
            title: 'Following',
            count: counts.following,
            spoken: (value) =>
                'Following $value ${value == 1 ? 'person' : 'people'}',
            hidden: 'Following count is hidden by privacy settings',
            onTap: () => context.push('/app/profile/${profile.id}/following'),
          ),
        ),
        Expanded(
          child: _CountTile(
            title: 'Connections',
            count: counts.connections,
            spoken: (value) =>
                '$value ${value == 1 ? 'connection' : 'connections'}',
            hidden: 'Connection count is hidden by privacy settings',
            onTap: () => context.push('/app/profile/${profile.id}/connections'),
          ),
        ),
      ],
    );
  }
}

/// A null count means privacy hid the list behind it, so the tile shows that it
/// is unavailable rather than a zero, and does not open the list.
class _CountTile extends StatelessWidget {
  const _CountTile({
    required this.title,
    required this.count,
    required this.spoken,
    required this.hidden,
    required this.onTap,
  });

  final String title;
  final int? count;
  final String Function(int) spoken;
  final String hidden;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final value = count;
    return Semantics(
      button: value != null,
      label: value == null ? hidden : '${spoken(value)}. Opens the list.',
      child: InkWell(
        onTap: value == null ? null : onTap,
        borderRadius: BorderRadius.circular(12),
        child: ExcludeSemantics(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  value == null ? 'Hidden' : '$value',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: value == null ? 15 : 20,
                    fontWeight: FontWeight.w700,
                    color: value == null ? AppColors.muted : AppColors.navy,
                  ),
                ),
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.label, required this.detail, this.onTap});

  final String label;
  final String detail;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: onTap != null,
      label: detail.isEmpty ? label : '$label. $detail',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: ExcludeSemantics(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        label,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.navy,
                        ),
                      ),
                      if (detail.isNotEmpty)
                        Text(
                          detail,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.muted,
                          ),
                        ),
                    ],
                  ),
                ),
                if (onTap != null)
                  const Icon(
                    Icons.chevron_right,
                    size: 20,
                    color: AppColors.muted,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ReportInput {
  const _ReportInput({required this.reason, this.details});

  final String reason;
  final String? details;
}

class _ReportDialog extends StatefulWidget {
  const _ReportDialog({required this.personName});

  final String personName;

  @override
  State<_ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends State<_ReportDialog> {
  final _details = TextEditingController();
  String _reason = personReportReasons.keys.first;

  @override
  void dispose() {
    _details.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Report ${widget.personName}?'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'A moderator reviews every report. Blocking is separate and takes effect immediately.',
              style: TextStyle(fontSize: 14, color: AppColors.muted),
            ),
            const SizedBox(height: 12),
            for (final entry in personReportReasons.entries)
              Semantics(
                button: true,
                inMutuallyExclusiveGroup: true,
                selected: _reason == entry.key,
                label: entry.value,
                child: InkWell(
                  onTap: () => setState(() => _reason = entry.key),
                  child: ExcludeSemantics(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          Icon(
                            _reason == entry.key
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked,
                            size: 20,
                            color: _reason == entry.key
                                ? AppColors.deepGreen
                                : AppColors.muted,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              entry.value,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 15),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            CampusTextField(
              label: 'Details (optional)',
              controller: _details,
              maxLines: 3,
              semanticLabel: 'Report details, optional',
            ),
          ],
        ),
      ),
      actions: [
        Semantics(
          button: true,
          label: 'Cancel',
          child: TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
        ),
        Semantics(
          button: true,
          label: 'Send report',
          child: TextButton(
            onPressed: () => Navigator.of(context).pop(
              _ReportInput(reason: _reason, details: _details.text),
            ),
            child: const Text('Send report'),
          ),
        ),
      ],
    );
  }
}

String _actionLabel(String action) {
  switch (action) {
    case 'EDIT_PROFILE':
      return 'Edit profile';
    case 'FOLLOW':
      return 'Follow';
    case 'UNFOLLOW':
      return 'Unfollow';
    case 'CONNECT':
      return 'Connect';
    case 'ACCEPT_CONNECTION':
      return 'Accept connection request';
    case 'CANCEL_CONNECTION_REQUEST':
      return 'Cancel connection request';
    case 'REMOVE_CONNECTION':
      return 'Remove connection';
    case 'MESSAGE':
      return 'Message';
    case 'BLOCK':
      return 'Block';
    case 'UNBLOCK':
      return 'Unblock';
    case 'REPORT':
      return 'Report';
    default:
      return action;
  }
}

bool _isReversal(String action) {
  return action == 'UNFOLLOW' ||
      action == 'CANCEL_CONNECTION_REQUEST' ||
      action == 'REMOVE_CONNECTION';
}

String _pendingMessage(String action) {
  switch (action) {
    case 'FOLLOW':
      return 'Sending your follow…';
    case 'UNFOLLOW':
      return 'Unfollowing…';
    case 'CONNECT':
      return 'Sending your connection request…';
    case 'ACCEPT_CONNECTION':
      return 'Accepting the connection request…';
    case 'CANCEL_CONNECTION_REQUEST':
      return 'Cancelling your connection request…';
    case 'REMOVE_CONNECTION':
      return 'Removing the connection…';
    case 'MESSAGE':
      return 'Opening the conversation…';
    case 'BLOCK':
      return 'Blocking…';
    case 'UNBLOCK':
      return 'Unblocking…';
    case 'REPORT':
      return 'Sending your report…';
    default:
      return 'Working…';
  }
}

String _offlineMessage(String action) {
  switch (action) {
    case 'MESSAGE':
      return "You're offline. Reconnect to start a conversation.";
    case 'REPORT':
      return "You're offline. Reconnect to send a report.";
    default:
      return "You're offline. Reconnect to change this relationship.";
  }
}

String _kindLabel(String kind) {
  switch (kind) {
    case 'CLASS':
      return 'Class';
    case 'COURSE_OFFERING':
      return 'Course';
    case 'ORGANIZATION':
      return 'Organization';
    case 'STUDY_GROUP':
      return 'Study group';
    default:
      return 'Shared';
  }
}

StatusTone _relationshipTone(ProfileRelationship relationship) {
  if (relationship.blockedByMe) {
    return StatusTone.critical;
  }
  if (relationship.connected) {
    return StatusTone.positive;
  }
  if (relationship.connection == 'REQUESTED_BY_ME' ||
      relationship.connection == 'REQUESTED_BY_THEM') {
    return StatusTone.pending;
  }
  if (relationship.following || relationship.followedBy) {
    return StatusTone.positive;
  }
  return StatusTone.neutral;
}

StatusTone _accountStateTone(String accountState) {
  switch (accountState) {
    case 'ACTIVE':
      return StatusTone.positive;
    case 'SUSPENDED':
      return StatusTone.critical;
    default:
      return StatusTone.pending;
  }
}
