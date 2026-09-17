import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(),
              const Text(
                'CampusOS',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.deepGreen,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Everything you need for university life.',
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w700,
                  height: 1.15,
                  letterSpacing: -0.8,
                  color: AppColors.navy,
                ),
              ),
              const Spacer(),
              CampusButton(
                label: 'Continue with phone',
                semanticLabel: 'Continue with phone',
                onPressed: () => context.push('/auth/phone'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
