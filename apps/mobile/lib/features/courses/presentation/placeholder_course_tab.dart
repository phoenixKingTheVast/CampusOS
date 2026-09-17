import 'package:campusos/app/theme/app_theme.dart';
import 'package:flutter/material.dart';

class PlaceholderCourseTab extends StatelessWidget {
  const PlaceholderCourseTab({
    super.key,
    required this.courseOfferingId,
    required this.title,
  });

  final String courseOfferingId;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          const Text(
            'Coming in the next CampusOS release.',
            style: TextStyle(color: AppColors.muted, fontSize: 16),
          ),
          const SizedBox(height: 12),
          Text(
            'This space stays attached to course offering $courseOfferingId.',
            style: const TextStyle(color: AppColors.muted, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
