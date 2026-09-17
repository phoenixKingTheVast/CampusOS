class AppConfig {
  const AppConfig._();

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );

  static const defaultTimezone = 'Africa/Harare';
  static const defaultCountryCode = '+263';
  static const defaultCountryIso = 'ZW';
}
