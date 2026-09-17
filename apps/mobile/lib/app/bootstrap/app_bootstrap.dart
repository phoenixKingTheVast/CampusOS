import 'package:campusos/app/providers.dart';
import 'package:campusos/core/authentication/session_manager.dart';

class AppBootstrap {
  const AppBootstrap._();

  static Future<SessionSnapshot> start(AppGraph graph) async {
    try {
      await graph.database.open();
      final online = await graph.connectivity.isOnline();
      final session = await graph.session.restore(online: online);
      if (session.hasSession && online) {
        try {
          await graph.sync.startupSync();
        } catch (error, stack) {
          graph.logger.error('startup sync failed', error, stack);
        }
      }
      return session;
    } catch (error, stack) {
      graph.logger.error('startup failed', error, stack);
      return SessionSnapshot.failed;
    }
  }
}
