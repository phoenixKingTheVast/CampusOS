import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/person.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The signed-in person's id. `ProfileScreen` resolves a null `personId` with
/// it because `GET people/:personId` is the only endpoint that returns a
/// `PersonProfile`, and it needs a real id.
final viewerIdProvider = Provider<String?>((ref) {
  final person =
      ref.watch(sessionProvider).person ?? ref.watch(sessionManagerProvider).person;
  final id = person?.id;
  return id == null || id.isEmpty ? null : id;
});

final personProfileProvider = AsyncNotifierProvider.autoDispose
    .family<PersonProfileController, PersonProfile, String>(
  PersonProfileController.new,
);

class PersonProfileController
    extends AutoDisposeFamilyAsyncNotifier<PersonProfile, String> {
  @override
  Future<PersonProfile> build(String arg) {
    return ref.read(profileRepositoryProvider).profile(arg);
  }

  /// Re-reads the profile so the relationship on screen is always the one the
  /// server just committed, never an optimistic guess. A failed refresh keeps
  /// the profile already loaded; the caller reports the error itself.
  Future<void> refresh() async {
    final previous = state.asData?.value;
    try {
      state = AsyncData(await ref.read(profileRepositoryProvider).profile(arg));
    } catch (error, stack) {
      if (previous != null) {
        state = AsyncData(previous);
        return;
      }
      state = AsyncError(error, stack);
    }
  }
}

/// The viewer's own record. `people/me` carries the name parts the edit form
/// needs, which `people/:personId` does not return.
final myProfileProvider =
    AsyncNotifierProvider.autoDispose<MyProfileController, Person>(
  MyProfileController.new,
);

class MyProfileController extends AutoDisposeAsyncNotifier<Person> {
  @override
  Future<Person> build() async {
    final cached = ref.read(sessionProvider).person;
    if (!ref.watch(connectivityProvider).isOnline) {
      if (cached == null) {
        throw const ApiError(
          code: 'OFFLINE',
          message: "You're offline. Reconnect to edit your profile.",
        );
      }
      return cached;
    }
    return ref.read(profileRepositoryProvider).me();
  }
}

/// The five person lists the social graph exposes. `blocked` and
/// `connectionRequests` are always the viewer's own, so they ignore the
/// `personId` on the request.
enum SocialListKind {
  followers,
  following,
  connections,
  blocked,
  connectionRequests;

  static SocialListKind? fromName(String? value) {
    switch (value?.toUpperCase()) {
      case 'FOLLOWERS':
        return SocialListKind.followers;
      case 'FOLLOWING':
        return SocialListKind.following;
      case 'CONNECTIONS':
        return SocialListKind.connections;
      case 'BLOCKED':
        return SocialListKind.blocked;
      case 'CONNECTION_REQUESTS':
        return SocialListKind.connectionRequests;
      default:
        return null;
    }
  }

  String get title {
    switch (this) {
      case SocialListKind.followers:
        return 'Followers';
      case SocialListKind.following:
        return 'Following';
      case SocialListKind.connections:
        return 'Connections';
      case SocialListKind.blocked:
        return 'Blocked accounts';
      case SocialListKind.connectionRequests:
        return 'Connection requests';
    }
  }

  /// Only used if a hidden page arrives without the server's own copy.
  String get hiddenMessage {
    switch (this) {
      case SocialListKind.followers:
        return "Followers aren't visible.";
      case SocialListKind.following:
        return "Following isn't visible.";
      case SocialListKind.connections:
        return "Connections aren't visible.";
      case SocialListKind.blocked:
      case SocialListKind.connectionRequests:
        return "This list isn't visible.";
    }
  }

  String get emptyTitle {
    switch (this) {
      case SocialListKind.followers:
        return 'No followers yet';
      case SocialListKind.following:
        return 'Not following anyone yet';
      case SocialListKind.connections:
        return 'No connections yet';
      case SocialListKind.blocked:
        return 'No blocked accounts';
      case SocialListKind.connectionRequests:
        return 'No connection requests';
    }
  }

  String get emptySubtitle {
    switch (this) {
      case SocialListKind.followers:
        return 'People who follow this profile appear here.';
      case SocialListKind.following:
        return 'People this profile follows appear here.';
      case SocialListKind.connections:
        return 'Accepted connections appear here.';
      case SocialListKind.blocked:
        return "People you block appear here. Blocking doesn't change your class, course or organization memberships.";
      case SocialListKind.connectionRequests:
        return 'Requests waiting for your answer appear here.';
    }
  }
}

class SocialListRequest {
  const SocialListRequest({required this.personId, required this.kind});

  final String personId;
  final SocialListKind kind;

  @override
  bool operator ==(Object other) {
    return other is SocialListRequest &&
        other.personId == personId &&
        other.kind == kind;
  }

  @override
  int get hashCode => Object.hash(personId, kind);
}

final socialListProvider = AsyncNotifierProvider.autoDispose
    .family<SocialListController, SocialPage, SocialListRequest>(
  SocialListController.new,
);

class SocialListController
    extends AutoDisposeFamilyAsyncNotifier<SocialPage, SocialListRequest> {
  bool _loadingMore = false;

  @override
  Future<SocialPage> build(SocialListRequest arg) => _fetch(arg, null);

  Future<void> refresh() async {
    final previous = state.asData?.value;
    try {
      state = AsyncData(await _fetch(arg, null));
    } catch (error, stack) {
      if (previous != null) {
        state = AsyncData(previous);
        return;
      }
      state = AsyncError(error, stack);
    }
  }

  /// Appends the next page. Returns the message to show when the page fails,
  /// so a failure never discards the rows already on screen.
  Future<String?> loadMore() async {
    final current = state.asData?.value;
    final cursor = current?.nextCursor;
    if (_loadingMore || current == null || cursor == null) {
      return null;
    }
    _loadingMore = true;
    try {
      state = AsyncData(current.merge(await _fetch(arg, cursor)));
      return null;
    } on ApiError catch (error) {
      return error.message;
    } finally {
      _loadingMore = false;
    }
  }

  /// Drops a row the server has confirmed no longer belongs in this list, such
  /// as an unblocked person or an answered connection request.
  void removePerson(String personId) {
    final current = state.asData?.value;
    if (current == null) {
      return;
    }
    state = AsyncData(
      SocialPage(
        items: current.items.where((item) => item.id != personId).toList(),
        nextCursor: current.nextCursor,
        visible: current.visible,
        message: current.message,
      ),
    );
  }

  Future<SocialPage> _fetch(SocialListRequest request, String? cursor) {
    final repository = ref.read(profileRepositoryProvider);
    switch (request.kind) {
      case SocialListKind.followers:
        return repository.followers(request.personId, cursor: cursor);
      case SocialListKind.following:
        return repository.following(request.personId, cursor: cursor);
      case SocialListKind.connections:
        return repository.connections(request.personId, cursor: cursor);
      case SocialListKind.blocked:
        return repository.blockedPeople(cursor: cursor);
      case SocialListKind.connectionRequests:
        return repository.connectionRequests(cursor: cursor);
    }
  }
}
