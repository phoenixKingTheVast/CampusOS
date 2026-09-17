import 'package:campusos/shared/models/account_state.dart';
import 'package:campusos/shared/models/json_map.dart';

class Person {
  const Person({
    required this.id,
    this.phoneNumber,
    this.displayName,
    this.username,
    this.bio,
    this.givenName,
    this.middleName,
    this.familyName,
    this.accountState,
  });

  final String id;
  final String? phoneNumber;
  final String? displayName;
  final String? username;
  final String? bio;
  final String? givenName;
  final String? middleName;
  final String? familyName;
  final AccountState? accountState;

  String get greetingName => givenName ?? displayName ?? '';

  String get initials {
    final source = displayName ?? username ?? '';
    final parts = source.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) {
      return 'C';
    }
    if (parts.length == 1) {
      return parts.first.substring(0, 1).toUpperCase();
    }
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  factory Person.fromJson(Map<String, dynamic> json) {
    return Person(
      id: asString(json['id']) ?? '',
      phoneNumber: asString(json['phoneNumber']),
      displayName: asString(json['displayName']) ?? asString(json['name']),
      username: asString(json['username']),
      bio: asString(json['bio']),
      givenName: asString(json['givenName']),
      middleName: asString(json['middleName']),
      familyName: asString(json['familyName']),
      accountState: AccountState.fromApi(asString(json['accountState'])),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'phone_number': phoneNumber,
      'given_name': givenName,
      'middle_name': middleName,
      'family_name': familyName,
      'display_name': displayName,
      'username': username,
      'bio': bio,
      'account_state': accountState?.apiValue,
      'updated_at': DateTime.now().toIso8601String(),
    };
  }

  factory Person.fromRow(Map<String, Object?> row) {
    return Person(
      id: asString(row['id']) ?? '',
      phoneNumber: asString(row['phone_number']),
      displayName: asString(row['display_name']),
      username: asString(row['username']),
      bio: asString(row['bio']),
      givenName: asString(row['given_name']),
      middleName: asString(row['middle_name']),
      familyName: asString(row['family_name']),
      accountState: AccountState.fromApi(asString(row['account_state'])),
    );
  }
}
