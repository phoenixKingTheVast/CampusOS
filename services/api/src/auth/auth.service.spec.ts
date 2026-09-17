import { AuthService } from './auth.service';

describe('AuthService phone normalization', () => {
  const service = Object.create(AuthService.prototype) as AuthService;

  it('normalizes Zimbabwe national numbers to E.164', () => {
    expect(service.normalizePhone('0771234567')).toBe('+263771234567');
  });

  it('accepts E.164 input', () => {
    expect(service.normalizePhone('+263771234567')).toBe('+263771234567');
  });

  it('rejects invalid numbers', () => {
    expect(() => service.normalizePhone('12')).toThrow();
  });
});
