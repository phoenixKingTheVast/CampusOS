import 'dart:io' show Platform;

class AppConfig {
  const AppConfig._();

  static const _definedApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  /// `--dart-define=API_BASE_URL` wins. An Android emulator cannot reach the
  /// host through `localhost`, so the debug default is the emulator alias.
  static String get apiBaseUrl {
    if (_definedApiBaseUrl.isNotEmpty) {
      return _definedApiBaseUrl;
    }
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000/api/v1';
    }
    return 'http://localhost:3000/api/v1';
  }

  static const defaultTimezone = 'Africa/Harare';
  static const defaultCountryCode = '+263';
  static const defaultCountryIso = 'ZW';
}
