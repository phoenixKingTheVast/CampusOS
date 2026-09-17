import 'package:campusos/app/theme/app_theme.dart';
import 'package:flutter/material.dart';

class CampusButton extends StatelessWidget {
  const CampusButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.expand = true,
    this.secondary = false,
    this.semanticLabel,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final bool expand;
  final bool secondary;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
          )
        : Text(label);
    final button = Semantics(
      button: true,
      enabled: onPressed != null && !busy,
      label: semanticLabel ?? label,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: secondary ? AppColors.navy : AppColors.deepGreen,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.line,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
        child: child,
      ),
    );
    if (!expand) {
      return button;
    }
    return SizedBox(width: double.infinity, child: button);
  }
}

class CampusTextButton extends StatelessWidget {
  const CampusTextButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.semanticLabel,
  });

  final String label;
  final VoidCallback? onPressed;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: semanticLabel ?? label,
      child: TextButton(
        onPressed: onPressed,
        child: Text(
          label,
          style: const TextStyle(
            color: AppColors.deepGreen,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
