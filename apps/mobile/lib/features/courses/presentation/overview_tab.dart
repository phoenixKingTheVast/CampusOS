import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/shared/models/course_offering.dart';
import 'package:flutter/material.dart';

class OverviewTab extends StatelessWidget {
  const OverviewTab({super.key, required this.detail});

  final CourseOfferingDetail detail;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('About', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 6),
        Text(detail.description ?? 'No description yet.'),
        const SizedBox(height: 18),
        const Text('Learning outcomes', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 6),
        ...detail.learningOutcomes.map((item) => _Bullet(item)),
        const SizedBox(height: 18),
        const Text('Outline', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 6),
        ...detail.outline.map((item) => _Bullet(item)),
        const SizedBox(height: 18),
        const Text('Teaching team', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 6),
        ...detail.personnel.map(
          (person) => ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(person.name),
            subtitle: Text(person.role.replaceAll('_', ' ')),
          ),
        ),
        const SizedBox(height: 12),
        const Text('References', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 6),
        ...detail.references.map((item) => _Bullet(item)),
      ],
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('•  ', style: TextStyle(color: AppColors.deepGreen)),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
