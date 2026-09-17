import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/features/calendar/providers.dart';
import 'package:campusos/shared/models/calendar_models.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _visibleMonth = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime _selectedDay = DateTime.now();
  int _mode = 0;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(calendarMonthProvider);
    final online = ref.watch(connectivityProvider).isOnline;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Calendar'),
        actions: [
          Semantics(
            button: true,
            label: 'Create personal reminder',
            child: IconButton(
              onPressed: () => context.push('/app/calendar/create'),
              icon: const Icon(Icons.add),
            ),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => EmptyState(
          title: "Couldn't load calendar",
          message: '$error',
        ),
        data: (items) {
          final dayItems = items.where((item) => _sameDay(item.startTime, _selectedDay)).toList();
          return Column(
            children: [
              if (!online)
                const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('Calendar offline. Showing activities last synchronized on this device.'),
                ),
              SegmentedButton<int>(
                segments: const [
                  ButtonSegment(value: 0, label: Text('Month'), icon: Icon(Icons.calendar_view_month)),
                  ButtonSegment(value: 1, label: Text('Upcoming'), icon: Icon(Icons.view_agenda)),
                ],
                selected: {_mode},
                onSelectionChanged: (value) => setState(() => _mode = value.first),
              ),
              if (_mode == 0) ...[
                _MonthHeader(
                  month: _visibleMonth,
                  onPrev: () => setState(() => _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month - 1)),
                  onNext: () => setState(() => _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month + 1)),
                ),
                _MonthGrid(
                  month: _visibleMonth,
                  selected: _selectedDay,
                  activities: items,
                  onSelect: (day) => setState(() => _selectedDay = day),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(DateFormat.yMMMMEEEEd().format(_selectedDay)),
                  ),
                ),
                Expanded(child: _DayList(items: dayItems)),
              ] else
                Expanded(child: _UpcomingList(items: items)),
            ],
          );
        },
      ),
    );
  }

  bool _sameDay(DateTime left, DateTime right) {
    final local = left.toLocal();
    return local.year == right.year && local.month == right.month && local.day == right.day;
  }
}

class _MonthHeader extends StatelessWidget {
  const _MonthHeader({required this.month, required this.onPrev, required this.onNext});

  final DateTime month;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(onPressed: onPrev, icon: const Icon(Icons.chevron_left), tooltip: 'Previous month'),
        Expanded(
          child: Text(
            DateFormat.yMMMM().format(month),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        IconButton(onPressed: onNext, icon: const Icon(Icons.chevron_right), tooltip: 'Next month'),
      ],
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.selected,
    required this.activities,
    required this.onSelect,
  });

  final DateTime month;
  final DateTime selected;
  final List<CalendarActivity> activities;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month, 1);
    final startOffset = (first.weekday + 6) % 7;
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        children: [
          const Row(
            children: [
              _Dow('Mo'), _Dow('Tu'), _Dow('We'), _Dow('Th'), _Dow('Fr'), _Dow('Sa'), _Dow('Su'),
            ],
          ),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 42,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, childAspectRatio: 0.9),
            itemBuilder: (context, index) {
              final dayNum = index - startOffset + 1;
              if (dayNum < 1 || dayNum > daysInMonth) {
                return const SizedBox.shrink();
              }
              final date = DateTime(month.year, month.month, dayNum);
              final dots = activities
                  .where((item) =>
                      item.startTime.toLocal().year == date.year &&
                      item.startTime.toLocal().month == date.month &&
                      item.startTime.toLocal().day == date.day)
                  .take(4)
                  .toList();
              final selectedDay = selected.year == date.year && selected.month == date.month && selected.day == date.day;
              return Semantics(
                button: true,
                selected: selectedDay,
                label: '${DateFormat.yMMMMEEEEd().format(date)}. ${dots.length} activities.',
                child: InkWell(
                  onTap: () => onSelect(date),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: selectedDay ? AppColors.deepGreen : Colors.transparent,
                        foregroundColor: selectedDay ? Colors.white : AppColors.navy,
                        child: Text('$dayNum', style: const TextStyle(fontSize: 13)),
                      ),
                      Wrap(
                        spacing: 2,
                        children: [
                          for (final item in dots.take(3))
                            Container(
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                color: _color(item.category),
                                shape: BoxShape.circle,
                              ),
                            ),
                          if (dots.length > 3)
                            const Text('+N', style: TextStyle(fontSize: 8, color: AppColors.muted)),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Color _color(String category) {
    switch (category) {
      case 'ACADEMIC':
        return const Color(0xFF2B6CB0);
      case 'ASSESSMENT':
        return AppColors.danger;
      case 'ORGANIZATION':
        return AppColors.deepGreen;
      case 'SPORT':
        return const Color(0xFFDD6B20);
      case 'SERVICE':
        return const Color(0xFF319795);
      case 'PERSONAL':
        return AppColors.muted;
      default:
        return const Color(0xFF6B46C1);
    }
  }
}

class _Dow extends StatelessWidget {
  const _Dow(this.label);
  final String label;
  @override
  Widget build(BuildContext context) {
    return Expanded(child: Text(label, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, fontSize: 12)));
  }
}

class _DayList extends StatelessWidget {
  const _DayList({required this.items});
  final List<CalendarActivity> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const EmptyState(title: 'Nothing scheduled', message: 'Personal reminders can be added from Calendar.');
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) => _ActivityTile(item: items[index]),
    );
  }
}

class _UpcomingList extends StatelessWidget {
  const _UpcomingList({required this.items});
  final List<CalendarActivity> items;

  @override
  Widget build(BuildContext context) {
    final upcoming = items.where((item) => item.endTime.isAfter(DateTime.now())).toList();
    if (upcoming.isEmpty) {
      return const EmptyState(title: 'No upcoming activities', message: 'Course, organization and personal items appear here.');
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: upcoming.length,
      itemBuilder: (context, index) => _ActivityTile(item: upcoming[index]),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.item});
  final CalendarActivity item;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: item.accessibilityLabel,
      child: ListTile(
        title: Text(item.cancelled ? '${item.title} (Cancelled)' : item.title),
        subtitle: Text(
          [
            DateFormat.jm().format(item.startTime.toLocal()),
            item.location,
            item.categoryLabel,
            if (item.cancelled) 'Cancelled',
          ].whereType<String>().join(' · '),
        ),
        onTap: () {
          final route = item.route;
          if (route != null && route.isNotEmpty) {
            context.push(route);
          }
        },
      ),
    );
  }
}
