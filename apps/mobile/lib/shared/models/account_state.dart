enum AccountState {
  neu,
  profileIncomplete,
  studentVerificationPending,
  studentVerified,
  classVerificationPending,
  active,
  suspended;

  static AccountState? fromApi(String? value) {
    switch (value) {
      case 'NEW':
        return AccountState.neu;
      case 'PROFILE_INCOMPLETE':
        return AccountState.profileIncomplete;
      case 'STUDENT_VERIFICATION_PENDING':
        return AccountState.studentVerificationPending;
      case 'STUDENT_VERIFIED':
        return AccountState.studentVerified;
      case 'CLASS_VERIFICATION_PENDING':
        return AccountState.classVerificationPending;
      case 'ACTIVE':
        return AccountState.active;
      case 'SUSPENDED':
        return AccountState.suspended;
      default:
        return null;
    }
  }

  String get apiValue {
    switch (this) {
      case AccountState.neu:
        return 'NEW';
      case AccountState.profileIncomplete:
        return 'PROFILE_INCOMPLETE';
      case AccountState.studentVerificationPending:
        return 'STUDENT_VERIFICATION_PENDING';
      case AccountState.studentVerified:
        return 'STUDENT_VERIFIED';
      case AccountState.classVerificationPending:
        return 'CLASS_VERIFICATION_PENDING';
      case AccountState.active:
        return 'ACTIVE';
      case AccountState.suspended:
        return 'SUSPENDED';
    }
  }
}

enum SessionStatus { unknown, none, valid, expired, offlineCached }
