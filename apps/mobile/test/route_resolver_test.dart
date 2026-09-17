import 'package:campusos/app/bootstrap/route_resolver.dart';
import 'package:campusos/shared/models/account_state.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('unauthenticated startup goes to welcome after splash', () {
    expect(RouteResolver.resolve(session: SessionStatus.none), '/welcome');
    expect(RouteResolver.resolve(session: SessionStatus.expired), '/auth/phone');
  });

  test('resource deep links stay outside onboarding once the account is active', () {
    expect(
      RouteResolver.resolve(session: SessionStatus.valid, accountState: AccountState.active),
      '/app/home',
    );
  });
}
