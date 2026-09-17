import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/profile/presentation/person_row.dart';
import 'package:campusos/features/profile/providers.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SocialListScreen extends ConsumerStatefulWidget {
  const SocialListScreen({
    super.key,
    required this.personId,
    required this.list,
  });

  final String personId;
  final SocialListKind list;

  /// Blocked accounts and connection requests have no route of their own, so
  /// the viewer's own profile opens them imperatively.
  static Future<void> push(
    BuildContext context, {
    required String personId,
    required SocialListKind list,
  }) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => SocialListScreen(personId: personId, list: list),
      ),
    );
  }

  @override
  ConsumerState<SocialListScreen> createState() => _SocialListScreenState();
}

class _SocialListScreenState extends ConsumerState<SocialListScreen> {
  final _pending = <String>{};
  String? _banner;
  bool _bannerIsError = false;
  bool _loadingMore = false;

  SocialListRequest get _request =>
      SocialListRequest(personId: widget.personId, kind: widget.list);

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(socialListProvider(_request));
    final online = ref.watch(connectivityProvider).isOnline;
    return Scaffold(
      appBar: AppBar(title: Text(widget.list.title)),
      body: SafeArea(
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ErrorRetry(
            message: error is ApiError ? error.message : ApiError.genericMessage,
            onRetry: () =>
                ref.read(socialListProvider(_request).notifier).refresh(),
          ),
          data: (page) {
            if (!page.visible) {
              return _HiddenList(
                message: page.message ?? widget.list.hiddenMessage,
              );
            }
            return RefreshIndicator(
              onRefresh: () =>
                  ref.read(socialListProvider(_request).notifier).refresh(),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                children: [
                  OfflineBanner(visible: !online),
                  if (_banner != null)
                    PendingActionBanner(
                      message: _banner!,
                      isError: _bannerIsError,
                    ),
                  if (page.items.isEmpty)
                    EmptyState(
                      title: widget.list.emptyTitle,
                      subtitle: widget.list.emptySubtitle,
                    )
                  else
                    for (final person in page.items) _row(person),
                  if (page.nextCursor != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: CampusButton(
                        label: 'Load more',
                        secondary: true,
                        busy: _loadingMore,
                        semanticLabel: 'Load more people',
                        onPressed: _loadingMore ? null : _loadMore,
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _row(PersonCard person) {
    final busy = _pending.contains(person.id);
    final blockedList = widget.list == SocialListKind.blocked;
    final actions = <Widget>[];

    if (blockedList) {
      actions.add(
        CampusTextButton(
          label: busy ? 'Unblocking…' : 'Unblock',
          semanticLabel: 'Unblock ${person.name}',
          onPressed: busy ? null : () => _unblock(person),
        ),
      );
    } else if (widget.list == SocialListKind.connectionRequests) {
      actions.add(
        CampusTextButton(
          label: busy ? 'Working…' : 'Accept',
          semanticLabel: 'Accept connection request from ${person.name}',
          onPressed: busy ? null : () => _accept(person),
        ),
      );
      actions.add(
        CampusTextButton(
          label: 'Decline',
          semanticLabel: 'Decline connection request from ${person.name}',
          onPressed: busy ? null : () => _decline(person),
        ),
      );
    }

    return PersonRow(
      person: person,
      subtitle: person.blockedAt == null
          ? null
          : 'Blocked ${formatShortDate(person.blockedAt!)}',
      // A blocked person's profile is withheld by the server, so the row does
      // not offer a tap that can only fail.
      onTap: blockedList
          ? null
          : () => context.push('/app/profile/${person.id}'),
      actions: actions,
    );
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    final message =
        await ref.read(socialListProvider(_request).notifier).loadMore();
    if (!mounted) {
      return;
    }
    setState(() {
      _loadingMore = false;
      _banner = message;
      _bannerIsError = message != null;
    });
  }

  Future<void> _unblock(PersonCard person) async {
    final confirmed = await confirmSocialAction(
      context,
      title: 'Unblock ${person.name}?',
      message:
          'You will be able to see each other again. The follows and connection the block removed are not restored.',
      confirmLabel: 'Unblock',
    );
    if (!confirmed) {
      return;
    }
    await _mutate(
      person,
      'Unblocking ${person.name}…',
      () => ref.read(profileRepositoryProvider).unblock(person.id),
    );
  }

  Future<void> _accept(PersonCard person) async {
    await _mutate(
      person,
      'Accepting the request from ${person.name}…',
      () => ref.read(profileRepositoryProvider).acceptConnection(person.id),
    );
  }

  Future<void> _decline(PersonCard person) async {
    final confirmed = await confirmSocialAction(
      context,
      title: 'Decline this request?',
      message:
          '${person.name} is not told that you declined. They can send a new request later.',
      confirmLabel: 'Decline',
    );
    if (!confirmed) {
      return;
    }
    await _mutate(
      person,
      'Declining the request from ${person.name}…',
      () => ref.read(profileRepositoryProvider).declineConnection(person.id),
    );
  }

  Future<void> _mutate(
    PersonCard person,
    String pendingMessage,
    Future<void> Function() body,
  ) async {
    if (!ref.read(connectivityProvider).isOnline) {
      setState(() {
        _banner = "You're offline. Reconnect to change this relationship.";
        _bannerIsError = true;
      });
      return;
    }
    setState(() {
      _pending.add(person.id);
      _banner = pendingMessage;
      _bannerIsError = false;
    });
    try {
      await body();
      if (!mounted) {
        return;
      }
      ref.read(socialListProvider(_request).notifier).removePerson(person.id);
      setState(() {
        _pending.remove(person.id);
        _banner = null;
      });
    } on ApiError catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _pending.remove(person.id);
        _banner = error.message;
        _bannerIsError = true;
      });
    }
  }
}

/// Privacy hid the whole list, so the server's copy is the whole body and is
/// announced as soon as it appears.
class _HiddenList extends StatelessWidget {
  const _HiddenList({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
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
    );
  }
}
