import 'package:campusos/core/authentication/secure_session_storage.dart';
import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/account_state.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/person.dart';
import 'package:campusos/shared/models/session_tokens.dart';

class SessionExpiredException implements Exception {
  const SessionExpiredException();
}

class SessionSnapshot {
  const SessionSnapshot({
    required this.status,
    this.person,
    this.accountState,
    this.startupFailed = false,
  });

  final SessionStatus status;
  final Person? person;
  final AccountState? accountState;
  final bool startupFailed;

  static const unknown = SessionSnapshot(status: SessionStatus.unknown);
  static const none = SessionSnapshot(status: SessionStatus.none);
  static const expired = SessionSnapshot(status: SessionStatus.expired);
  static const failed = SessionSnapshot(
    status: SessionStatus.none,
    startupFailed: true,
  );

  bool get hasSession =>
      status == SessionStatus.valid || status == SessionStatus.offlineCached;
}

class SessionManager {
  SessionManager({
    required SecureSessionStorage storage,
    required AppDatabase database,
  })  : _storage = storage,
        _database = database;

  final SecureSessionStorage _storage;
  final AppDatabase _database;
  ApiClient? _api;
  SessionTokens? _tokens;
  Person? person;
  bool _refreshFailed = false;
  Future<bool>? _inFlightRefresh;

  void bindApi(ApiClient api) {
    _api = api;
  }

  Future<String?> accessToken() async {
    return _tokens?.accessToken ?? _storage.readAccessToken();
  }

  Future<void> saveLogin({
    required SessionTokens tokens,
    required Person signedInPerson,
  }) async {
    _tokens = tokens;
    person = signedInPerson;
    _refreshFailed = false;
    await _storage.save(
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.toIso8601String(),
      personId: signedInPerson.id,
    );
    await _database.upsertPerson(signedInPerson);
  }

  Future<SessionSnapshot> restore({required bool online}) async {
    final refreshToken = await _storage.readRefreshToken();
    final personId = await _storage.readPersonId();
    if (refreshToken == null || refreshToken.isEmpty || personId == null) {
      _tokens = null;
      person = null;
      return SessionSnapshot.none;
    }

    final access = await _storage.readAccessToken();
    final expires = await _storage.readExpiresAt();
    final sessionId = await _storage.readSessionId();
    _tokens = SessionTokens(
      sessionId: sessionId ?? '',
      accessToken: access ?? '',
      refreshToken: refreshToken,
      expiresAt: DateTime.tryParse(expires ?? '') ?? DateTime.now(),
    );
    person = await _database.personById(personId) ??
        Person(id: personId, accountState: AccountState.active);

    if (!online) {
      return SessionSnapshot(
        status: SessionStatus.offlineCached,
        person: person,
        accountState: person?.accountState,
      );
    }

    try {
      if (_tokens!.shouldRefresh) {
        final ok = await refreshOnce();
        if (!ok) {
          await clear();
          return SessionSnapshot.expired;
        }
      }
      await _hydratePerson();
      return SessionSnapshot(
        status: SessionStatus.valid,
        person: person,
        accountState: person?.accountState,
      );
    } on SessionExpiredException {
      await clear();
      return SessionSnapshot.expired;
    }
  }

  Future<bool> refreshOnce() {
    final existing = _inFlightRefresh;
    if (existing != null) {
      return existing;
    }
    final future = _refreshOnce();
    _inFlightRefresh = future;
    return future.whenComplete(() {
      if (identical(_inFlightRefresh, future)) {
        _inFlightRefresh = null;
      }
    });
  }

  Future<bool> _refreshOnce() async {
    if (_refreshFailed) {
      return false;
    }
    final api = _api;
    final refreshToken = _tokens?.refreshToken ?? await _storage.readRefreshToken();
    if (api == null || refreshToken == null || refreshToken.isEmpty) {
      _refreshFailed = true;
      return false;
    }
    try {
      final body = await api.refresh(refreshToken);
      final session = SessionTokens.fromJson(asJsonMap(body['session']));
      final nextPerson = body['person'] is Map
          ? Person.fromJson({
              ...asJsonMap(body['person']),
              'accountState': body['accountState'],
            })
          : person;
      _tokens = session;
      if (nextPerson != null) {
        person = nextPerson;
        await _database.upsertPerson(nextPerson);
      }
      await _storage.replaceAccessToken(
        accessToken: session.accessToken,
        expiresAt: session.expiresAt.toIso8601String(),
      );
      _refreshFailed = false;
      return true;
    } on ApiError catch (error) {
      _refreshFailed = true;
      if (error.isUnauthenticated) {
        throw const SessionExpiredException();
      }
      return false;
    }
  }

  Future<void> _hydratePerson() async {
    final api = _api;
    if (api == null) {
      return;
    }
    final body = await api.get('people/me');
    person = Person.fromJson(body);
    await _database.upsertPerson(person!);
  }

  Future<void> logout() async {
    try {
      await _api?.post('auth/logout');
    } catch (_) {
      // Session is cleared locally regardless of network outcome.
    }
    await clear();
  }

  Future<void> clear() async {
    _tokens = null;
    person = null;
    _refreshFailed = false;
    await _storage.clear();
  }
}
