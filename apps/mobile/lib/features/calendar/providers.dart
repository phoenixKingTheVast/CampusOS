import 'package:campusos/app/providers.dart';
import 'package:campusos/features/calendar/data/calendar_repository.dart';
import 'package:campusos/shared/models/calendar_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final calendarRepositoryProvider = Provider<CalendarRepository>(
  (ref) => CalendarRepository(
    api: ref.watch(appGraphProvider).api,
    database: ref.watch(appGraphProvider).database,
  ),
);

final eventRepositoryProvider = Provider<EventRepository>(
  (ref) => EventRepository(api: ref.watch(appGraphProvider).api),
);

final calendarMonthProvider = FutureProvider.autoDispose<List<CalendarActivity>>((ref) async {
  final now = DateTime.now();
  final start = DateTime(now.year, now.month - 1, 1);
  final end = DateTime(now.year, now.month + 2, 1);
  final online = ref.watch(connectivityProvider).isOnline;
  return ref.watch(calendarRepositoryProvider).range(start: start, end: end, online: online);
});

final eventProvider = FutureProvider.autoDispose.family<CampusEventDetail, String>((ref, id) {
  return ref.watch(eventRepositoryProvider).get(id);
});
