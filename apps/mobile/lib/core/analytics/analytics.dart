import 'package:campusos/core/logging/app_logger.dart';

class Analytics {
  const Analytics({this.logger = const AppLogger()});

  final AppLogger logger;

  void track(String event, [Map<String, Object?> context = const {}]) {
    logger.info(event, _safe(context));
  }

  Map<String, Object?> _safe(Map<String, Object?> context) {
    const blocked = {
      'otp',
      'accessToken',
      'refreshToken',
      'registrationNumber',
      'studentId',
      'body',
      'message',
    };
    return {
      for (final entry in context.entries)
        if (!blocked.contains(entry.key)) entry.key: entry.value,
    };
  }
}
