import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  static const navy = Color(0xFF0B1F3A);
  static const deepGreen = Color(0xFF0F4C3A);
  static const forest = Color(0xFF1B6B4F);
  static const moss = Color(0xFF2F7D5B);
  static const cream = Color(0xFFF6F3EC);
  static const ivory = Color(0xFFFFFCF7);
  static const muted = Color(0xFF5C6B7A);
  static const line = Color(0xFFD9E0D6);
  static const danger = Color(0xFF9B2C2C);
  static const attention = Color(0xFF8A5A12);
}

class AppTheme {
  const AppTheme._();

  static ThemeData get light {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.deepGreen,
      onPrimary: Colors.white,
      secondary: AppColors.navy,
      onSecondary: Colors.white,
      error: AppColors.danger,
      onError: Colors.white,
      surface: AppColors.ivory,
      onSurface: AppColors.navy,
      tertiary: AppColors.forest,
      onTertiary: Colors.white,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.cream,
      canvasColor: AppColors.cream,
      splashFactory: NoSplash.splashFactory,
      visualDensity: VisualDensity.standard,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.cream,
        foregroundColor: AppColors.navy,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: AppColors.navy,
          letterSpacing: -0.3,
        ),
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 34,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.8,
          color: AppColors.navy,
          height: 1.15,
        ),
        headlineMedium: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.4,
          color: AppColors.navy,
        ),
        titleLarge: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.4,
          color: AppColors.navy,
        ),
        titleMedium: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.3,
          color: AppColors.navy,
        ),
        bodyLarge: TextStyle(
          fontSize: 17,
          height: 1.35,
          color: AppColors.navy,
        ),
        bodyMedium: TextStyle(
          fontSize: 15,
          height: 1.4,
          color: AppColors.navy,
        ),
        bodySmall: TextStyle(
          fontSize: 13,
          height: 1.35,
          color: AppColors.muted,
        ),
        labelLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.ivory,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.deepGreen, width: 1.6),
        ),
      ),
      dividerColor: AppColors.line,
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.deepGreen,
        foregroundColor: Colors.white,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.ivory,
        selectedItemColor: AppColors.deepGreen,
        unselectedItemColor: AppColors.muted,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
      ),
    );
  }
}
