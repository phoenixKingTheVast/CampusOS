import 'package:campusos/shared/models/home_snapshot.dart';
import 'package:campusos/shared/models/activity.dart';

class HomePresentation {
  const HomePresentation._();

  static String greeting(DateTime localTime, String? name) {
    final hour = localTime.hour;
    final salutation = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';
    final trimmed = name?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return salutation;
    }
    return '$salutation, $trimmed';
  }

  static bool showCaughtUp(HomeSnapshot snapshot) {
    return snapshot.upNext.isEmpty &&
        snapshot.today.isEmpty &&
        snapshot.attention.isEmpty;
  }

  static bool showCampusAndDiscover(HomeSnapshot snapshot) => true;

  static String? offlineBanner({
    required bool offline,
    DateTime? lastUpdated,
  }) {
    if (!offline) {
      return null;
    }
    return "You're offline. Showing recently synced information.";
  }

  static String? lastUpdatedLabel(DateTime? lastUpdated, {DateTime? now}) {
    if (lastUpdated == null) {
      return null;
    }
    final delta = (now ?? DateTime.now()).difference(lastUpdated);
    if (delta.inMinutes < 1) {
      return 'Last updated just now';
    }
    if (delta.inMinutes < 60) {
      return 'Last updated ${delta.inMinutes} min ago';
    }
    if (delta.inHours < 24) {
      return 'Last updated ${delta.inHours} hr ago';
    }
    return 'Last updated yesterday';
  }

  static String? refreshFailureLabel(HomeSnapshot snapshot, {DateTime? now}) {
    if (!snapshot.refreshFailed) {
      return null;
    }
    final updated = lastUpdatedLabel(snapshot.lastUpdated, now: now);
    if (updated == null) {
      return "Couldn't refresh";
    }
    return "Couldn't refresh. Showing information from ${updated.replaceFirst('Last updated ', '')}.";
  }

  static bool showVerifyStudentCta(HomeSnapshot snapshot) => snapshot.firstTime;

  static String attentionLabel(AttentionItem item) {
    final priority = switch (item.priority) {
      'CRITICAL' => 'critical priority',
      'HIGH' => 'high priority',
      'LOW' => 'low priority',
      _ => 'normal priority',
    };
    final subtitle = item.subtitle;
    if (subtitle == null || subtitle.isEmpty) {
      return '${item.title}, $priority';
    }
    return '${item.title}, $subtitle, $priority';
  }

  static String todayTimeLabel(ActivityItem item) {
    final start = item.startTime?.toLocal();
    if (start == null) {
      return item.relative ?? '';
    }
    final hour = start.hour.toString().padLeft(2, '0');
    final minute = start.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  static String upNextWhen(ActivityItem item, {DateTime? now}) {
    final start = item.startTime?.toLocal();
    final end = item.endTime?.toLocal();
    if (start == null) {
      return '';
    }
    final clock = now ?? DateTime.now();
    final sameDay =
        start.year == clock.year && start.month == clock.month && start.day == clock.day;
    final startLabel =
        '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}';
    final endLabel = end == null
        ? ''
        : '–${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
    final day = sameDay ? 'Today' : _weekday(start);
    return '$day · $startLabel$endLabel';
  }

  static String _weekday(DateTime start) {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return names[start.weekday - 1];
  }

  static bool keepCachedActivity(ActivityItem item, Set<String> authorizedOfferingIds) {
    if (item.status == 'CANCELLED' || item.status == 'COMPLETED') {
      return false;
    }
    final offeringId = item.courseOfferingId;
    if (offeringId == null || offeringId.isEmpty) {
      return true;
    }
    return authorizedOfferingIds.contains(offeringId);
  }

  static bool keepCachedRoute(String? route, Set<String> authorizedOfferingIds) {
    final offeringId = ActivityItem.courseOfferingIdFromRoute(route);
    if (offeringId == null || offeringId.isEmpty) {
      return true;
    }
    return authorizedOfferingIds.contains(offeringId);
  }
}
