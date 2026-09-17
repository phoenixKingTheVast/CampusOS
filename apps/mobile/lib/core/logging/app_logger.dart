import 'dart:developer' as developer;

class AppLogger {
  const AppLogger();

  void info(String message, [Object? data]) {
    developer.log(message, name: 'CampusOS', error: data);
  }

  void error(String message, [Object? error, StackTrace? stackTrace]) {
    developer.log(
      message,
      name: 'CampusOS',
      error: error,
      stackTrace: stackTrace,
      level: 1000,
    );
  }
}
