import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/features/courses/domain/course_tab.dart';
import 'package:flutter/material.dart';

class CourseTabBar extends StatelessWidget {
  const CourseTabBar({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final CourseTab selected;
  final ValueChanged<CourseTab> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: CourseTab.values.length,
        separatorBuilder: (_, __) => const SizedBox(width: 18),
        itemBuilder: (context, index) {
          final tab = CourseTab.values[index];
          final isSelected = tab == selected;
          return Semantics(
            button: true,
            selected: isSelected,
            label: tab.label,
            child: InkWell(
              onTap: () => onSelected(tab),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    tab.label,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? AppColors.navy : AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    height: 2,
                    width: 28,
                    color: isSelected ? AppColors.deepGreen : Colors.transparent,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
