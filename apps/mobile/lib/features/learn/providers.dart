import 'package:campusos/app/providers.dart';
import 'package:campusos/shared/models/learn_snapshot.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final learnProvider = AsyncNotifierProvider<LearnController, LearnSnapshot>(LearnController.new);

class LearnController extends AsyncNotifier<LearnSnapshot> {
  @override
  Future<LearnSnapshot> build() {
    final online = ref.watch(connectivityProvider).isOnline;
    return ref.read(learnRepositoryProvider).load(online: online);
  }

  Future<void> refresh() async {
    final previous = state.asData?.value;
    try {
      final next = await ref.read(learnRepositoryProvider).load(online: true);
      state = AsyncData(next);
    } catch (error, stack) {
      if (previous != null) {
        state = AsyncData(previous);
        return;
      }
      state = AsyncError(error, stack);
    }
  }
}
