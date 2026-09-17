import 'package:campusos/app/bootstrap/route_resolver.dart';
import 'package:campusos/shared/models/account_state.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('RouteResolver', () {
    test('no session goes to welcome', () {
      expect(
        RouteResolver.resolve(session: SessionStatus.none),
        '/welcome',
      );
    });

    test('expired session goes to auth', () {
      expect(
        RouteResolver.resolve(session: SessionStatus.expired),
        '/auth/phone',
      );
    });

    test('unknown session stays on splash', () {
      expect(
        RouteResolver.resolve(session: SessionStatus.unknown),
        '/splash',
      );
    });

    test('maps account states after a valid session', () {
      expect(
        RouteResolver.resolve(
          session: SessionStatus.valid,
          accountState: AccountState.neu,
        ),
        '/onboarding/profile',
      );
      expect(
        RouteResolver.resolve(
          session: SessionStatus.valid,
          accountState: AccountState.profileIncomplete,
        ),
        '/onboarding/profile',
      );
      expect(
        RouteResolver.resolve(
          session: SessionStatus.valid,
          accountState: AccountState.studentVerificationPending,
        ),
        '/onboarding/student-verification',
      );
      expect(
        RouteResolver.resolve(
          session: SessionStatus.valid,
          accountState: AccountState.studentVerified,
        ),
        '/onboarding/class-verification',
      );
      expect(
        RouteResolver.resolve(
          session: SessionStatus.valid,
          accountState: AccountState.active,
        ),
        '/app/home',
      );
    });

    test('offline cached session still uses account state', () {
      expect(
        RouteResolver.resolve(
          session: SessionStatus.offlineCached,
          accountState: AccountState.active,
        ),
        '/app/home',
      );
    });
  });
}
