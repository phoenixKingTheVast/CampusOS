import 'package:campusos/app/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// A state label. State is always carried by the text itself: the tint is
/// supporting decoration only, so the pill still reads correctly in greyscale
/// and to VoiceOver.
class StatusPill extends StatelessWidget {
  const StatusPill({
    super.key,
    required this.label,
    this.tone = StatusTone.neutral,
    this.icon,
  });

  final String label;
  final StatusTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final palette = _palette(tone);
    return Semantics(
      label: label,
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: palette.background,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: palette.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 13, color: palette.foreground),
                const SizedBox(width: 5),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: palette.foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum StatusTone { neutral, positive, pending, warning, critical }

class _Palette {
  const _Palette(this.background, this.border, this.foreground);

  final Color background;
  final Color border;
  final Color foreground;
}

_Palette _palette(StatusTone tone) {
  switch (tone) {
    case StatusTone.positive:
      return const _Palette(Color(0xFFE6F0E9), Color(0xFFBBD5C4), AppColors.deepGreen);
    case StatusTone.pending:
      return const _Palette(Color(0xFFF3EEE2), Color(0xFFDFD3BC), AppColors.attention);
    case StatusTone.warning:
      return const _Palette(Color(0xFFF7EBDC), Color(0xFFE4CBAA), AppColors.attention);
    case StatusTone.critical:
      return const _Palette(Color(0xFFF6E4E4), Color(0xFFE0BEBE), AppColors.danger);
    case StatusTone.neutral:
      return const _Palette(Color(0xFFEDEFEA), AppColors.line, AppColors.muted);
  }
}

/// Maps a booking status to a tone. Two bookings with the same status always
/// read the same way, wherever they appear.
StatusTone bookingStatusTone(String status) {
  switch (status.toUpperCase()) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return StatusTone.positive;
    case 'REQUESTED':
    case 'IN_PROGRESS':
      return StatusTone.pending;
    case 'RESCHEDULED':
      return StatusTone.warning;
    case 'DECLINED':
    case 'CANCELLED':
      return StatusTone.critical;
    default:
      return StatusTone.neutral;
  }
}

StatusTone serviceStatusTone(String status) {
  switch (status.toUpperCase()) {
    case 'AVAILABLE':
      return StatusTone.positive;
    case 'PUBLISHED':
      return StatusTone.pending;
    case 'UNAVAILABLE':
      return StatusTone.warning;
    case 'DISCONTINUED':
      return StatusTone.critical;
    default:
      return StatusTone.neutral;
  }
}

/// An unread marker that does not rely on colour: a filled dot plus a text
/// label that assistive technology reads.
class UnreadDot extends StatelessWidget {
  const UnreadDot({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) {
      return const SizedBox.shrink();
    }
    return Semantics(
      label: count == 1 ? '1 unread' : '$count unread',
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minWidth: 22),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.deepGreen,
            borderRadius: BorderRadius.circular(11),
          ),
          child: Text(
            count > 99 ? '99+' : '$count',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

/// A filter chip row. Selection is conveyed by the chip's selected semantics
/// and a check mark, not by fill colour alone.
class FilterChipRow extends StatelessWidget {
  const FilterChipRow({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onSelected,
    this.semanticsPrefix = 'Filter',
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final String semanticsPrefix;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          for (var index = 0; index < labels.length; index += 1)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Semantics(
                button: true,
                selected: index == selectedIndex,
                label: '$semanticsPrefix: ${labels[index]}',
                child: ExcludeSemantics(
                  child: ChoiceChip(
                    label: Text(labels[index]),
                    selected: index == selectedIndex,
                    showCheckmark: true,
                    onSelected: (_) => onSelected(index),
                    backgroundColor: AppColors.ivory,
                    selectedColor: const Color(0xFFE6F0E9),
                    side: const BorderSide(color: AppColors.line),
                    labelStyle: TextStyle(
                      fontSize: 13,
                      fontWeight: index == selectedIndex ? FontWeight.w700 : FontWeight.w500,
                      color: AppColors.navy,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Star rating shown as glyphs plus an explicit spoken label.
class RatingStars extends StatelessWidget {
  const RatingStars({super.key, required this.rating, this.count});

  final double? rating;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final value = rating;
    if (value == null || (count ?? 0) == 0) {
      return const Text('No reviews yet', style: TextStyle(fontSize: 13, color: AppColors.muted));
    }
    final label = count == null
        ? '${value.toStringAsFixed(1)} out of 5'
        : '${value.toStringAsFixed(1)} out of 5 from $count ${count == 1 ? 'review' : 'reviews'}';
    return Semantics(
      label: label,
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var index = 1; index <= 5; index += 1)
              Icon(
                index <= value.round() ? Icons.star_rounded : Icons.star_outline_rounded,
                size: 15,
                color: AppColors.attention,
              ),
            const SizedBox(width: 6),
            Text(
              count == null ? value.toStringAsFixed(1) : '${value.toStringAsFixed(1)} ($count)',
              style: const TextStyle(fontSize: 13, color: AppColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

/// A banner for a mutation that needs connectivity. Nothing here claims the
/// action succeeded; it states exactly what is happening.
class PendingActionBanner extends StatelessWidget {
  const PendingActionBanner({super.key, required this.message, this.isError = false});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final palette = _palette(isError ? StatusTone.critical : StatusTone.pending);
    return Semantics(
      liveRegion: true,
      label: message,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: palette.background,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: palette.border),
        ),
        child: Row(
          children: [
            Icon(
              isError ? Icons.error_outline_rounded : Icons.sync_rounded,
              size: 16,
              color: palette.foreground,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: TextStyle(fontSize: 13, color: palette.foreground),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Human date/time formatting used by every state label the client builds
/// itself. Server-provided labels are preferred where they exist.
String formatDayAndTime(DateTime value) {
  final local = value.toLocal();
  return '${local.day} ${_months[local.month - 1]} at ${_two(local.hour)}:${_two(local.minute)}';
}

String formatShortDate(DateTime value) {
  final local = value.toLocal();
  return '${local.day} ${_months[local.month - 1].substring(0, 3)}';
}

String formatTimeOfDay(DateTime value) {
  final local = value.toLocal();
  return '${_two(local.hour)}:${_two(local.minute)}';
}

String formatRelative(DateTime value) {
  final difference = DateTime.now().difference(value.toLocal());
  if (difference.inMinutes < 1) {
    return 'Just now';
  }
  if (difference.inMinutes < 60) {
    return '${difference.inMinutes} min ago';
  }
  if (difference.inHours < 24) {
    return '${difference.inHours} h ago';
  }
  if (difference.inDays < 7) {
    return '${difference.inDays} d ago';
  }
  return formatShortDate(value);
}

String _two(int value) => value.toString().padLeft(2, '0');

const _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
