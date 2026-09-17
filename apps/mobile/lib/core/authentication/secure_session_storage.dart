import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureSessionStorage {
  SecureSessionStorage({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  static const _access = 'campusos.access_token';
  static const _refresh = 'campusos.refresh_token';
  static const _sessionId = 'campusos.session_id';
  static const _expiresAt = 'campusos.access_expires_at';
  static const _personId = 'campusos.person_id';

  final FlutterSecureStorage _storage;

  Future<void> save({
    required String sessionId,
    required String accessToken,
    required String refreshToken,
    required String expiresAt,
    required String personId,
  }) async {
    await Future.wait([
      _storage.write(key: _sessionId, value: sessionId),
      _storage.write(key: _access, value: accessToken),
      _storage.write(key: _refresh, value: refreshToken),
      _storage.write(key: _expiresAt, value: expiresAt),
      _storage.write(key: _personId, value: personId),
    ]);
  }

  Future<String?> readAccessToken() => _storage.read(key: _access);
  Future<String?> readRefreshToken() => _storage.read(key: _refresh);
  Future<String?> readSessionId() => _storage.read(key: _sessionId);
  Future<String?> readExpiresAt() => _storage.read(key: _expiresAt);
  Future<String?> readPersonId() => _storage.read(key: _personId);

  Future<void> replaceAccessToken({
    required String accessToken,
    required String expiresAt,
  }) async {
    await Future.wait([
      _storage.write(key: _access, value: accessToken),
      _storage.write(key: _expiresAt, value: expiresAt),
    ]);
  }

  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: _access),
      _storage.delete(key: _refresh),
      _storage.delete(key: _sessionId),
      _storage.delete(key: _expiresAt),
      _storage.delete(key: _personId),
    ]);
  }
}
