import 'package:campusos/app/bootstrap/app_bootstrap.dart';
import 'package:campusos/app/bootstrap/route_resolver.dart';
import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/shared/widgets/startup_failure_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  var _failed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  Future<void> _start() async {
    setState(() => _failed = false);
    final snapshot = await AppBootstrap.start(ref.read(appGraphProvider));
    if (!mounted) {
      return;
    }
    ref.read(sessionProvider.notifier).replace(snapshot);
    if (snapshot.startupFailed) {
      setState(() => _failed = true);
      return;
    }
    context.go(
      RouteResolver.resolve(
        session: snapshot.status,
        accountState: snapshot.accountState,
        startupFailed: snapshot.startupFailed,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return StartupFailureScreen(onRetry: _start);
    }
    return const Scaffold(
      backgroundColor: AppColors.cream,
      body: Center(
        child: Text(
          'CampusOS',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: AppColors.deepGreen,
          ),
        ),
      ),
    );
  }
}
