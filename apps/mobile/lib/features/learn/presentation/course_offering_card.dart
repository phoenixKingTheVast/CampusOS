import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/shared/models/learn_snapshot.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class CourseOfferingCard extends StatelessWidget {
  const CourseOfferingCard({
    super.key,
    required this.course,
    required this.onTap,
  });

  final CourseOfferingSummary course;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final next = course.nextActivityStart;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Semantics(
        button: true,
        label: [
          course.code,
          course.title,
          course.semester,
          if (course.lecturer != null) course.lecturer!,
          if (course.unreadAnnouncements > 0)
            '${course.unreadAnnouncements} unread announcements',
        ].join(', '),
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(18),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    course.code,
                    style: const TextStyle(
                      color: AppColors.deepGreen,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    course.title,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    course.semester,
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  if (course.lecturer != null)
                    Text(course.lecturer!, style: const TextStyle(color: AppColors.muted)),
                  if (course.nextActivityTitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        next == null
                            ? course.nextActivityTitle!
                            : '${course.nextActivityTitle} · ${DateFormat.jm().format(next.toLocal())}',
                      ),
                    ),
                  if (course.unreadAnnouncements > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        '${course.unreadAnnouncements} unread announcements',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
