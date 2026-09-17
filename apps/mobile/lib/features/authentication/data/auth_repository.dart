import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/person.dart';
import 'package:campusos/shared/models/session_tokens.dart';

class AuthSession {
  const AuthSession({
    required this.tokens,
    required this.person,
    this.accountState,
  });

  final SessionTokens tokens;
  final Person person;
  final String? accountState;
}

class OtpChallenge {
  const OtpChallenge({
    required this.challengeId,
    required this.expiresAt,
    required this.resendAvailableAt,
    required this.phoneE164,
  });

  final String challengeId;
  final DateTime expiresAt;
  final DateTime resendAvailableAt;
  final String phoneE164;
}

class AuthRepository {
  AuthRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<OtpChallenge> requestOtp(String phoneE164) async {
    final body = await _api.post(
      'auth/otp/request',
      data: {'phoneNumber': phoneE164},
      skipAuth: true,
    );
    return OtpChallenge(
      challengeId: asString(body['challengeId']) ?? '',
      expiresAt: asDateTime(body['expiresAt']) ?? DateTime.now().add(const Duration(minutes: 5)),
      resendAvailableAt:
          asDateTime(body['resendAvailableAt']) ?? DateTime.now().add(const Duration(seconds: 30)),
      phoneE164: phoneE164,
    );
  }

  Future<AuthSession> verifyOtp({
    required String challengeId,
    required String otp,
  }) async {
    if (otp.length != 6) {
      throw const ApiError(code: 'VALIDATION_ERROR', message: 'Enter the 6-digit code.');
    }
    final body = await _api.post(
      'auth/otp/verify',
      data: {'challengeId': challengeId, 'otp': otp},
      skipAuth: true,
    );
    final session = SessionTokens.fromJson(asJsonMap(body['session']));
    final personJson = asJsonMap(body['person']);
    personJson['accountState'] = body['accountState'];
    return AuthSession(
      tokens: session,
      person: Person.fromJson(personJson),
      accountState: asString(body['accountState']),
    );
  }
}
