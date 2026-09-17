import 'package:campusos/core/authentication/session_manager.dart';
import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/person.dart';
import 'package:campusos/shared/models/social.dart';

class ProfileRepository {
  ProfileRepository({
    required ApiClient api,
    required AppDatabase database,
    required SessionManager session,
  })  : _api = api,
        _database = database,
        _session = session;

  final ApiClient _api;
  final AppDatabase _database;
  final SessionManager _session;

  Future<Person> me() async {
    return _adopt(await _api.get('people/me'));
  }

  /// A profile as the viewer is allowed to see it. The viewer's own id is a
  /// valid argument and returns `isSelf: true`; `people/me` is a different
  /// shape and cannot be substituted here.
  Future<PersonProfile> profile(String personId) async {
    return PersonProfile.fromJson(await _api.get('people/$personId'));
  }

  /// Every field the edit form owns is sent on every save: the server clears a
  /// field sent blank and leaves out an absent one alone, so omitting a field
  /// here would make it impossible to clear.
  Future<Person> updateProfile({
    required String displayName,
    required String bio,
    required String givenName,
    required String middleName,
    required String familyName,
  }) async {
    return _adopt(
      await _api.patch(
        'people/me/profile',
        data: {
          'displayName': displayName,
          'bio': bio,
          'givenName': givenName,
          'middleName': middleName,
          'familyName': familyName,
        },
      ),
    );
  }

  Future<Person> updateUsername(String username) async {
    return _adopt(
      await _api.patch('people/me/username', data: {'username': username}),
    );
  }

  Future<bool> usernameAvailable(String username) async {
    final body = await _api.get(
      'users/username/availability',
      query: {'username': username},
    );
    return asBool(body['available']);
  }

  Future<bool> follow(String personId) async {
    final body = await _api.post('people/$personId/follow');
    return asBool(body['following']);
  }

  Future<bool> unfollow(String personId) async {
    final body = await _api.delete('people/$personId/follow');
    return asBool(body['following']);
  }

  Future<SocialPage> followers(String personId, {String? cursor}) {
    return _page('people/$personId/followers', cursor);
  }

  Future<SocialPage> following(String personId, {String? cursor}) {
    return _page('people/$personId/following', cursor);
  }

  Future<SocialPage> connections(String personId, {String? cursor}) {
    return _page('people/$personId/connections', cursor);
  }

  Future<SocialPage> connectionRequests({String? cursor}) {
    return _page('people/me/connection-requests', cursor);
  }

  Future<SocialPage> blockedPeople({String? cursor}) {
    return _page('people/blocked', cursor);
  }

  Future<String> requestConnection(String personId) {
    return _connection(_api.post('people/$personId/connect'));
  }

  Future<String> acceptConnection(String personId) {
    return _connection(_api.post('people/$personId/connect/accept'));
  }

  Future<String> declineConnection(String personId) {
    return _connection(_api.post('people/$personId/connect/decline'));
  }

  /// Cancels a request the viewer sent or removes an accepted connection; the
  /// server decides which from the current state.
  Future<String> withdrawConnection(String personId) {
    return _connection(_api.delete('people/$personId/connect'));
  }

  Future<bool> block(String personId) async {
    final body = await _api.post('people/$personId/block');
    return asBool(body['blocked']);
  }

  Future<bool> unblock(String personId) async {
    final body = await _api.delete('people/$personId/block');
    return asBool(body['blocked']);
  }

  /// Returns the server's acknowledgement so the screen can show it verbatim.
  Future<String> report(
    String personId, {
    required String reason,
    String? details,
  }) async {
    final trimmed = details?.trim();
    final body = await _api.post(
      'people/$personId/report',
      data: {
        'reason': reason,
        if (trimmed != null && trimmed.isNotEmpty) 'details': trimmed,
      },
    );
    return asString(body['message']) ??
        'Thanks. A moderator will review this report.';
  }

  /// Returns the conversation id to navigate to.
  Future<String> startDirectConversation(String personId) async {
    final body = await _api.post(
      'conversations/direct',
      data: {'personId': personId},
    );
    final id = asString(body['id']);
    if (id == null) {
      throw const ApiError(
        code: 'HTTP_ERROR',
        message: ApiError.genericMessage,
      );
    }
    return id;
  }

  Future<void> logout() => _session.logout();

  Future<Person> _adopt(Map<String, dynamic> body) async {
    final person = Person.fromJson(body);
    await _database.upsertPerson(person);
    _session.person = person;
    return person;
  }

  Future<SocialPage> _page(String path, String? cursor) async {
    return SocialPage.fromJson(
      await _api.get(path, query: cursor == null ? null : {'cursor': cursor}),
    );
  }

  Future<String> _connection(Future<Map<String, dynamic>> request) async {
    final body = await request;
    return asString(body['connection']) ?? 'NONE';
  }
}
