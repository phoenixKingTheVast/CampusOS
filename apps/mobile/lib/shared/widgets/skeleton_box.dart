import 'package:campusos/app/theme/app_theme.dart';
import 'package:flutter/material.dart';

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.height = 16,
    this.width,
    this.radius = 10,
  });

  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading',
      child: Container(
        height: height,
        width: width,
        decoration: BoxDecoration(
          color: AppColors.line.withValues(alpha: 0.65),
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}

class HomeSkeleton extends StatelessWidget {
  const HomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonBox(width: 180, height: 22),
          SizedBox(height: 12),
          SkeletonBox(height: 48, width: double.infinity, radius: 16),
          SizedBox(height: 18),
          SkeletonBox(width: 70, height: 14),
          SizedBox(height: 10),
          SkeletonBox(height: 120, width: double.infinity, radius: 18),
          SizedBox(height: 18),
          SkeletonBox(width: 60, height: 14),
          SizedBox(height: 10),
          SkeletonBox(height: 56, width: double.infinity, radius: 16),
          SizedBox(height: 8),
          SkeletonBox(height: 56, width: double.infinity, radius: 16),
          SizedBox(height: 18),
          SkeletonBox(width: 140, height: 14),
          SizedBox(height: 10),
          SkeletonBox(height: 72, width: double.infinity, radius: 16),
        ],
      ),
    );
  }
}
