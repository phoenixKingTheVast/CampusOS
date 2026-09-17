class PhoneValidator {
  const PhoneValidator._();

  static const defaultCountryCode = '+263';

  static final _e164 = RegExp(r'^\+[1-9]\d{7,14}$');
  static final _digits = RegExp(r'[^\d+]');

  static String normalize(String input) {
    var value = input.trim().replaceAll(_digits, '');
    if (value.isEmpty) {
      return '';
    }
    if (value.startsWith('00')) {
      value = '+${value.substring(2)}';
    }
    if (!value.startsWith('+')) {
      if (value.startsWith('0')) {
        value = '$defaultCountryCode${value.substring(1)}';
      } else if (value.startsWith('263')) {
        value = '+$value';
      } else {
        value = '$defaultCountryCode$value';
      }
    }
    return value;
  }

  static String? toE164(String input) {
    final normalized = normalize(input);
    if (!_e164.hasMatch(normalized)) {
      return null;
    }
    return normalized;
  }

  static String? validate(String input) {
    if (input.trim().isEmpty) {
      return 'Enter your phone number.';
    }
    if (toE164(input) == null) {
      return 'Enter a valid phone number.';
    }
    return null;
  }

  static String mask(String e164) {
    return e164.replaceFirstMapped(
      RegExp(r'(\+\d{3})\d+(\d{4})'),
      (match) => '${match[1]} *** ${match[2]}',
    );
  }
}
