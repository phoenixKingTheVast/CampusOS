import 'package:campusos/shared/models/account_state.dart';
import 'package:campusos/shared/models/activity.dart';
import 'package:campusos/shared/models/json_map.dart';

class HomeSnapshot {
  const HomeSnapshot({
    required this.generatedAt,
    required this.timezone,
    required this.firstTime,
    required this.upNext,
    required this.today,
    required this.attention,
    required this.campus,
    required this.discover,
    required this.unreadNotificationCount,
    this.unreadMessageCount = 0,
    this.greetingName,
    this.accountState,
    this.lastUpdated,
    this.fromCache = false,
    this.refreshFailed = false,
    this.refreshing = false,
  });

  final DateTime generatedAt;
  final String timezone;
  final String? greetingName;
  final AccountState? accountState;
  final bool firstTime;
  final List<ActivityItem> upNext;
  final List<ActivityItem> today;
  final List<AttentionItem> attention;
  final List<CampusCard> campus;
  final List<CampusCard> discover;
  final int unreadNotificationCount;
  final int unreadMessageCount;
  final DateTime? lastUpdated;
  final bool fromCache;
  final bool refreshFailed;
  final bool refreshing;

  factory HomeSnapshot.fromJson(Map<String, dynamic> json, {bool fromCache = false}) {
    return HomeSnapshot(
      generatedAt: asDateTime(json['generatedAt']) ?? DateTime.now(),
      timezone: asString(json['timezone']) ?? 'Africa/Harare',
      greetingName: asString(json['greetingName']),
      accountState: AccountState.fromApi(asString(json['accountState'])),
      firstTime: asBool(json['firstTime']),
      upNext: asJsonMapList(json['upNext']).map(ActivityItem.fromHomeJson).toList(),
      today: asJsonMapList(json['today']).map(ActivityItem.fromHomeJson).toList(),
      attention: asJsonMapList(json['attention']).map(AttentionItem.fromJson).toList(),
      campus: asJsonMapList(json['campus']).map(CampusCard.fromJson).toList(),
      discover: asJsonMapList(json['discover']).map(CampusCard.fromJson).toList(),
      unreadNotificationCount: asInt(json['unreadNotificationCount']) ?? 0,
      unreadMessageCount: asInt(json['unreadMessageCount']) ?? 0,
      lastUpdated: asDateTime(json['generatedAt']),
      fromCache: fromCache,
    );
  }

  HomeSnapshot copyWith({
    bool? fromCache,
    bool? refreshFailed,
    bool? refreshing,
  }) {
    return HomeSnapshot(
      generatedAt: generatedAt,
      timezone: timezone,
      greetingName: greetingName,
      accountState: accountState,
      firstTime: firstTime,
      upNext: upNext,
      today: today,
      attention: attention,
      campus: campus,
      discover: discover,
      unreadNotificationCount: unreadNotificationCount,
      unreadMessageCount: unreadMessageCount,
      lastUpdated: lastUpdated,
      fromCache: fromCache ?? this.fromCache,
      refreshFailed: refreshFailed ?? this.refreshFailed,
      refreshing: refreshing ?? this.refreshing,
    );
  }
}
