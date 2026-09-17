import 'package:campusos/features/authentication/domain/phone_validator.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PhoneValidator', () {
    test('normalizes local Zimbabwe numbers to E.164', () {
      expect(PhoneValidator.toE164('0771234567'), '+263771234567');
      expect(PhoneValidator.toE164('771234567'), '+263771234567');
      expect(PhoneValidator.toE164('263771234567'), '+263771234567');
    });

    test('accepts already valid E.164 numbers', () {
      expect(PhoneValidator.toE164('+263771234567'), '+263771234567');
      expect(PhoneValidator.validate('+263771234567'), isNull);
    });

    test('rejects empty and invalid numbers', () {
      expect(PhoneValidator.validate(''), 'Enter your phone number.');
      expect(PhoneValidator.validate('12'), 'Enter a valid phone number.');
      expect(PhoneValidator.toE164('abc'), isNull);
    });

    test('masks the middle of an E.164 number', () {
      expect(PhoneValidator.mask('+263771234567'), '+263 *** 4567');
    });
  });
}
