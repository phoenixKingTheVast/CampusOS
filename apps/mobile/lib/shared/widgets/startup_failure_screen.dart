import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class StartupFailureScreen extends StatelessWidget {
  const StartupFailureScreen({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.cream,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(),
              const Text(
                "CampusOS couldn't start",
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Check your connection and try again.',
                style: TextStyle(fontSize: 16, color: AppColors.muted),
              ),
              const Spacer(),
              CampusButton(label: 'Retry', onPressed: onRetry, semanticLabel: 'Retry starting CampusOS'),
            ],
          ),
        ),
      ),
    );
  }
}

class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({
    super.key,
    required this.title,
    this.courseOfferingId,
  });

  final String title;
  final String? courseOfferingId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: const Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Coming in the next CampusOS release.',
          style: TextStyle(fontSize: 16, color: AppColors.muted),
        ),
      ),
    );
  }
}

class AppTabScaffold extends StatelessWidget {
  const AppTabScaffold({
    super.key,
    required this.navigationShell,
    required this.hideTabs,
  });

  final StatefulNavigationShell navigationShell;
  final bool hideTabs;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: hideTabs
          ? null
          : NavigationBar(
              selectedIndex: navigationShell.currentIndex,
              onDestinationSelected: (index) {
                navigationShell.goBranch(
                  index,
                  initialLocation: index == navigationShell.currentIndex,
                );
              },
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.menu_book_outlined),
                  selectedIcon: Icon(Icons.menu_book),
                  label: 'Learn',
                ),
                NavigationDestination(
                  icon: Icon(Icons.explore_outlined),
                  selectedIcon: Icon(Icons.explore),
                  label: 'Explore',
                ),
                NavigationDestination(
                  icon: Icon(Icons.calendar_today_outlined),
                  selectedIcon: Icon(Icons.calendar_today),
                  label: 'Calendar',
                ),
                NavigationDestination(
                  icon: Icon(Icons.chat_bubble_outline),
                  selectedIcon: Icon(Icons.chat_bubble),
                  label: 'Messages',
                ),
              ],
            ),
    );
  }
}
