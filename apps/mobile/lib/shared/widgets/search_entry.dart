import 'package:campusos/app/theme/app_theme.dart';
import 'package:flutter/material.dart';

class SearchEntry extends StatelessWidget {
  const SearchEntry({
    super.key,
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                const Icon(Icons.search, color: AppColors.muted),
                const SizedBox(width: 10),
                Text(label, style: const TextStyle(color: AppColors.muted)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
