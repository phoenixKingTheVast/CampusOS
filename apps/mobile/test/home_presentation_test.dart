import 'package:campusos/features/home/domain/home_presentation.dart';
import 'package:campusos/shared/models/account_state.dart';
import 'package:campusos/shared/models/activity.dart';
import 'package:campusos/shared/models/home_snapshot.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final empty = HomeSnapshot(
    generatedAt: DateTime.parse('2026-09-15T18:00:00Z'),
    timezone: 'Africa/Harare',
    firstTime: true,
    upNext: const [],
    today: const [],
    attention: const [],
    campus: const [],
    discover: const [],
    unreadNotificationCount: 0,
    lastUpdated: DateTime.parse('2026-09-15T17:55:00Z'),
  );

  test('greeting uses local time and the Person given name', () {
    expect(
      HomePresentation.greeting(DateTime(2026, 9, 15, 20), 'Matthew'),
      'Good evening, Matthew',
    );
  });

  test('empty academic calendar still shows caught-up copy', () {
    expect(HomePresentation.showCaughtUp(empty), isTrue);
    expect(HomePresentation.showCampusAndDiscover(empty), isTrue);
    expect(HomePresentation.showVerifyStudentCta(empty), isTrue);
  });

  test('attention labels never rely on colour alone', () {
    const item = AttentionItem(
      id: 'a1',
      title: 'Assignment due tomorrow',
      subtitle: 'EEE401 · Power Electronics',
      priority: 'HIGH',
    );
    expect(
      HomePresentation.attentionLabel(item),
      'Assignment due tomorrow, EEE401 · Power Electronics, high priority',
    );
  });

  test('stale refresh is described relative to last sync', () {
    expect(
      HomePresentation.refreshFailureLabel(
        empty.copyWith(refreshFailed: true),
        now: DateTime.parse('2026-09-15T18:00:00Z'),
      ),
      "Couldn't refresh. Showing information from 5 min ago.",
    );
  });

  test('today rows expose a clock time', () {
    final item = ActivityItem(
      id: 'act',
      title: 'EEE401 Lecture',
      startTime: DateTime.parse('2026-09-15T07:00:00Z'),
    );
    expect(HomePresentation.todayTimeLabel(item), matches(RegExp(r'^\d{2}:\d{2}$')));
  });

  test('Up Next uses Today for the current local day', () {
    final item = ActivityItem(
      id: 'act',
      title: 'Control Systems',
      startTime: DateTime(2026, 9, 15, 10),
      endTime: DateTime(2026, 9, 15, 11),
    );
    expect(
      HomePresentation.upNextWhen(item, now: DateTime(2026, 9, 15, 9, 25)),
      'Today · 10:00–11:00',
    );
  });

  test('cached academic objects drop when membership has ended', () {
    const lecture = ActivityItem(
      id: 'act',
      title: 'EEE401 Lecture',
      status: 'SCHEDULED',
      courseOfferingId: 'ended-offering',
      route: '/app/learn/course/ended-offering',
    );
    expect(
      HomePresentation.keepCachedActivity(lecture, {'current-offering'}),
      isFalse,
    );
    expect(
      HomePresentation.keepCachedActivity(
        const ActivityItem(id: 'public', title: 'Chess Club', status: 'SCHEDULED'),
        {'current-offering'},
      ),
      isTrue,
    );
  });

  test('account state is preserved on the snapshot', () {
    expect(empty.accountState, isNull);
    expect(AccountState.active.apiValue, 'ACTIVE');
  });
}
