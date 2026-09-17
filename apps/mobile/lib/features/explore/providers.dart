import 'package:campusos/app/providers.dart';
import 'package:campusos/features/explore/data/explore_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final exploreProvider = AsyncNotifierProvider<ExploreController, ExploreSnapshot>(
  ExploreController.new,
);

class ExploreController extends AsyncNotifier<ExploreSnapshot> {
  @override
  Future<ExploreSnapshot> build() {
    final online = ref.watch(connectivityProvider).isOnline;
    return ref.read(exploreRepositoryProvider).load(online: online);
  }

  /// Keeps the previous page on screen if the refresh fails, so a pull-to-refresh
  /// on a flaky connection never empties the tab.
  Future<void> refresh() async {
    final previous = state.asData?.value;
    try {
      state = AsyncData(await ref.read(exploreRepositoryProvider).load(online: true));
    } catch (error, stack) {
      if (previous != null) {
        state = AsyncData(previous);
        return;
      }
      state = AsyncError(error, stack);
    }
  }
}
