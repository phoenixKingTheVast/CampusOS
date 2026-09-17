import 'package:campusos/shared/models/json_map.dart';

class SessionTokens {
  const SessionTokens({
    required this.sessionId,
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
  });

  final String sessionId;
  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  bool get shouldRefresh {
    return DateTime.now().isAfter(expiresAt.subtract(const Duration(minutes: 1)));
  }

  factory SessionTokens.fromJson(Map<String, dynamic> json) {
    return SessionTokens(
      sessionId: asString(json['id']) ?? '',
      accessToken: asString(json['accessToken']) ?? '',
      refreshToken: asString(json['refreshToken']) ?? '',
      expiresAt: asDateTime(json['expiresAt']) ?? DateTime.now(),
    );
  }
}
