import 'package:campusos/shared/models/account_state.dart';

class RouteResolver {
  const RouteResolver._();

  static String resolve({
    required SessionStatus session,
    AccountState? accountState,
    bool startupFailed = false,
  }) {
    if (startupFailed) {
      return '/splash';
    }
    switch (session) {
      case SessionStatus.unknown:
        return '/splash';
      case SessionStatus.none:
        return '/welcome';
      case SessionStatus.expired:
        return '/auth/phone';
      case SessionStatus.valid:
      case SessionStatus.offlineCached:
        return forAccountState(accountState);
    }
  }

  static String forAccountState(AccountState? state) {
    switch (state) {
      case AccountState.neu:
      case AccountState.profileIncomplete:
        return '/onboarding/profile';
      case AccountState.studentVerificationPending:
        return '/onboarding/student-verification';
      case AccountState.studentVerified:
        return '/onboarding/class-verification';
      case AccountState.classVerificationPending:
      case AccountState.active:
      case AccountState.suspended:
      case null:
        return '/app/home';
    }
  }
}
