import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class VerificationPendingScreen extends StatelessWidget {
  const VerificationPendingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Student verification',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Status',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.muted),
              ),
              const SizedBox(height: 6),
              const Text('Pending review', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),
              const Text(
                'Your information has been submitted for verification. You can continue using CampusOS while verification is being processed.',
                style: TextStyle(fontSize: 16, height: 1.4),
              ),
              const Spacer(),
              CampusButton(
                label: 'Continue',
                semanticLabel: 'Continue to CampusOS',
                onPressed: () => context.go('/app/home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
