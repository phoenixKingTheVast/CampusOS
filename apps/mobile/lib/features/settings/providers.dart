import 'package:campusos/app/providers.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final privacySettingsProvider =
    AsyncNotifierProvider<PrivacySettingsController, PrivacySettings>(
  PrivacySettingsController.new,
);

class PrivacySettingsController extends AsyncNotifier<PrivacySettings> {
  @override
  Future<PrivacySettings> build() => ref.read(privacyRepositoryProvider).load();

  /// The screen never guesses the outcome: the state only moves once the server
  /// has accepted the change and returned the settings it is now enforcing.
  Future<void> update(Map<String, Object?> changes) async {
    final previous = state.asData?.value;
    try {
      state = AsyncData(await ref.read(privacyRepositoryProvider).update(changes));
    } catch (_) {
      if (previous != null) {
        state = AsyncData(previous);
      }
      rethrow;
    }
  }
}
