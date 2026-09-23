import 'package:campusos/app/providers.dart';
import 'package:campusos/features/provider/data/provider_repository.dart';
import 'package:campusos/shared/models/booking.dart';
import 'package:campusos/shared/models/campus_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final providerRepositoryProvider = Provider<ProviderRepository>(
  (ref) => ProviderRepository(
    api: ref.watch(appGraphProvider).api,
    database: ref.watch(appGraphProvider).database,
  ),
);

final providerWorkspaceProvider =
    AsyncNotifierProvider<ProviderWorkspaceController, ProviderWorkspace>(
  ProviderWorkspaceController.new,
);

class ProviderWorkspaceController extends AsyncNotifier<ProviderWorkspace> {
  @override
  Future<ProviderWorkspace> build() {
    final online = ref.watch(connectivityProvider).isOnline;
    return ref.read(providerRepositoryProvider).workspace(online: online);
  }

  Future<void> refresh() async {
    state = AsyncData(
      await ref.read(providerRepositoryProvider).workspace(online: true),
    );
  }

  Future<void> createProfile({
    required String providerName,
    String? tagline,
    String? about,
  }) async {
    await ref.read(providerRepositoryProvider).createProfile(
          providerName: providerName,
          tagline: tagline,
          about: about,
        );
    await refresh();
  }
}

final providerServicesProvider =
    AsyncNotifierProvider<ProviderServicesController, List<ProviderServiceListItem>>(
  ProviderServicesController.new,
);

class ProviderServicesController
    extends AsyncNotifier<List<ProviderServiceListItem>> {
  @override
  Future<List<ProviderServiceListItem>> build() {
    final online = ref.watch(connectivityProvider).isOnline;
    return ref.read(providerRepositoryProvider).myServices(online: online);
  }

  Future<void> refresh() async {
    state = AsyncData(
      await ref.read(providerRepositoryProvider).myServices(online: true),
    );
  }
}

/// The booking queue plus the filter it was loaded with, so the chips and the
/// rows can never disagree about what is on screen.
class ProviderBookingQueueView {
  const ProviderBookingQueueView({
    required this.filterIndex,
    required this.items,
    required this.fromCache,
  });

  final int filterIndex;
  final List<Booking> items;
  final bool fromCache;

  BookingFilter get filter => BookingFilter.provider[filterIndex];
}

final providerBookingQueueProvider = AsyncNotifierProvider<
    ProviderBookingQueueController, ProviderBookingQueueView>(
  ProviderBookingQueueController.new,
);

class ProviderBookingQueueController
    extends AsyncNotifier<ProviderBookingQueueView> {
  int _filterIndex = 0;

  @override
  Future<ProviderBookingQueueView> build() {
    final online = ref.watch(connectivityProvider).isOnline;
    return _load(_filterIndex, online: online);
  }

  Future<void> setFilter(int index) async {
    if (index == _filterIndex) {
      return;
    }
    _filterIndex = index;
    state = const AsyncLoading<ProviderBookingQueueView>();
    state = await AsyncValue.guard(
      () => _load(index, online: ref.read(connectivityProvider).isOnline),
    );
  }

  Future<void> refresh() async {
    state = AsyncData(await _load(_filterIndex, online: true));
  }

  Future<ProviderBookingQueueView> _load(int index, {required bool online}) async {
    final filter = BookingFilter.provider[index];
    final page = await ref.read(providerRepositoryProvider).bookings(
          status: filter.status,
          online: online,
        );
    return ProviderBookingQueueView(
      filterIndex: index,
      items: page.items,
      fromCache: page.fromCache,
    );
  }
}

final providerServiceProvider =
    FutureProvider.autoDispose.family<ProviderServiceDetail, String>((ref, serviceId) {
  return ref.watch(providerRepositoryProvider).service(serviceId);
});

final providerServiceCategoriesProvider =
    FutureProvider<List<ServiceCategory>>((ref) {
  final online = ref.watch(connectivityProvider).isOnline;
  return ref.watch(providerRepositoryProvider).categories(online: online);
});
