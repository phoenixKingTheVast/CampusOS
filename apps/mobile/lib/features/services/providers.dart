import 'package:campusos/app/providers.dart';
import 'package:campusos/features/services/data/bookings_repository.dart';
import 'package:campusos/features/services/data/services_repository.dart';
import 'package:campusos/shared/models/booking.dart';
import 'package:campusos/shared/models/campus_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final serviceCategoriesProvider = FutureProvider.autoDispose<List<ServiceCategory>>((ref) {
  final online = ref.watch(connectivityProvider).isOnline;
  return ref.watch(servicesRepositoryProvider).categories(online: online);
});

final serviceDetailProvider =
    FutureProvider.autoDispose.family<ServiceDetail, String>((ref, serviceId) {
  final online = ref.watch(connectivityProvider).isOnline;
  return ref.watch(servicesRepositoryProvider).service(serviceId, online: online);
});

final bookingFormProvider =
    FutureProvider.autoDispose.family<BookingForm, String>((ref, serviceId) {
  return ref.watch(servicesRepositoryProvider).bookingForm(serviceId);
});

final serviceAvailabilityProvider =
    FutureProvider.autoDispose.family<List<AvailabilityDay>, String>((ref, serviceId) {
  return ref.watch(servicesRepositoryProvider).availability(serviceId);
});

final serviceProviderProfileProvider =
    FutureProvider.autoDispose.family<ServiceProviderDetail, String>((ref, providerId) {
  return ref.watch(servicesRepositoryProvider).providerProfile(providerId);
});

final bookingDetailProvider =
    FutureProvider.autoDispose.family<Booking, String>((ref, bookingId) {
  final online = ref.watch(connectivityProvider).isOnline;
  return ref.watch(bookingsRepositoryProvider).booking(bookingId, online: online);
});

/// The catalogue keeps its filter, search text and loaded pages while the
/// signed-in session lasts, so returning to it does not lose the user's place.
class ServiceCatalogState {
  const ServiceCatalogState({
    required this.items,
    required this.nextCursor,
    required this.categoryKey,
    required this.query,
    this.fromCache = false,
    this.refreshing = false,
    this.refreshFailed = false,
    this.loadingMore = false,
    this.loadMoreFailed = false,
  });

  final List<ServiceSummary> items;
  final String? nextCursor;
  final String? categoryKey;
  final String query;
  final bool fromCache;
  final bool refreshing;
  final bool refreshFailed;
  final bool loadingMore;
  final bool loadMoreFailed;

  bool get hasMore => nextCursor != null;
}

class ServiceCatalogController extends AsyncNotifier<ServiceCatalogState> {
  String? _categoryKey;
  String _query = '';

  @override
  Future<ServiceCatalogState> build() {
    final online = ref.watch(connectivityProvider).isOnline;
    return _firstPage(online: online);
  }

  Future<void> selectCategory(String? categoryKey) {
    final next = categoryKey == null || categoryKey.isEmpty || categoryKey == 'ALL'
        ? null
        : categoryKey;
    if (next == _categoryKey && state.hasValue) {
      return Future<void>.value();
    }
    _categoryKey = next;
    return _reload();
  }

  Future<void> search(String query) {
    final needle = query.trim();
    if (needle == _query && state.hasValue) {
      return Future<void>.value();
    }
    _query = needle;
    return _reload();
  }

  Future<void> refresh() => _reload();

  Future<void> loadMore() async {
    final current = state.asData?.value;
    final cursor = current?.nextCursor;
    if (current == null || cursor == null || current.loadingMore) {
      return;
    }
    state = AsyncData(_copy(current, loadingMore: true));
    try {
      final ServicePage page = await ref.read(servicesRepositoryProvider).services(
            online: ref.read(connectivityProvider).isOnline,
            categoryKey: current.categoryKey,
            query: current.query,
            cursor: cursor,
          );
      state = AsyncData(
        ServiceCatalogState(
          items: [...current.items, ...page.items],
          nextCursor: page.nextCursor,
          categoryKey: current.categoryKey,
          query: current.query,
          fromCache: page.fromCache,
        ),
      );
    } catch (_) {
      state = AsyncData(_copy(current, loadMoreFailed: true));
    }
  }

  Future<ServiceCatalogState> _firstPage({required bool online}) async {
    final page = await ref.read(servicesRepositoryProvider).services(
          online: online,
          categoryKey: _categoryKey,
          query: _query,
        );
    return ServiceCatalogState(
      items: page.items,
      nextCursor: page.nextCursor,
      categoryKey: _categoryKey,
      query: _query,
      fromCache: page.fromCache,
    );
  }

  Future<void> _reload() async {
    final previous = state.asData?.value;
    if (previous != null) {
      state = AsyncData(_copy(previous, refreshing: true));
    }
    try {
      state = AsyncData(await _firstPage(online: ref.read(connectivityProvider).isOnline));
    } catch (error, stack) {
      if (previous == null) {
        state = AsyncError(error, stack);
        return;
      }
      state = AsyncData(_copy(previous, refreshFailed: true));
    }
  }

  ServiceCatalogState _copy(
    ServiceCatalogState source, {
    bool refreshing = false,
    bool refreshFailed = false,
    bool loadingMore = false,
    bool loadMoreFailed = false,
  }) {
    return ServiceCatalogState(
      items: source.items,
      nextCursor: source.nextCursor,
      categoryKey: source.categoryKey,
      query: source.query,
      fromCache: source.fromCache,
      refreshing: refreshing,
      refreshFailed: refreshFailed,
      loadingMore: loadingMore,
      loadMoreFailed: loadMoreFailed,
    );
  }
}

final serviceCatalogProvider =
    AsyncNotifierProvider<ServiceCatalogController, ServiceCatalogState>(
  ServiceCatalogController.new,
);

class MyBookingsState {
  const MyBookingsState({
    required this.items,
    required this.nextCursor,
    required this.filterIndex,
    this.fromCache = false,
    this.refreshing = false,
    this.refreshFailed = false,
    this.loadingMore = false,
    this.loadMoreFailed = false,
  });

  final List<Booking> items;
  final String? nextCursor;
  final int filterIndex;
  final bool fromCache;
  final bool refreshing;
  final bool refreshFailed;
  final bool loadingMore;
  final bool loadMoreFailed;

  BookingFilter get filter => BookingFilter.customer[filterIndex];

  bool get hasMore => nextCursor != null;
}

class MyBookingsController extends AsyncNotifier<MyBookingsState> {
  int _filterIndex = 0;

  @override
  Future<MyBookingsState> build() {
    final online = ref.watch(connectivityProvider).isOnline;
    return _firstPage(online: online);
  }

  Future<void> selectFilter(int index) {
    if (index < 0 || index >= BookingFilter.customer.length) {
      return Future<void>.value();
    }
    if (index == _filterIndex && state.hasValue) {
      return Future<void>.value();
    }
    _filterIndex = index;
    return _reload();
  }

  Future<void> refresh() => _reload();

  Future<void> loadMore() async {
    final current = state.asData?.value;
    final cursor = current?.nextCursor;
    if (current == null || cursor == null || current.loadingMore) {
      return;
    }
    state = AsyncData(_copy(current, loadingMore: true));
    try {
      final BookingPage page = await ref.read(bookingsRepositoryProvider).list(
            online: ref.read(connectivityProvider).isOnline,
            status: current.filter.status,
            cursor: cursor,
          );
      state = AsyncData(
        MyBookingsState(
          items: [...current.items, ...page.items],
          nextCursor: page.nextCursor,
          filterIndex: current.filterIndex,
          fromCache: page.fromCache,
        ),
      );
    } catch (_) {
      state = AsyncData(_copy(current, loadMoreFailed: true));
    }
  }

  Future<MyBookingsState> _firstPage({required bool online}) async {
    final page = await ref.read(bookingsRepositoryProvider).list(
          online: online,
          status: BookingFilter.customer[_filterIndex].status,
        );
    return MyBookingsState(
      items: page.items,
      nextCursor: page.nextCursor,
      filterIndex: _filterIndex,
      fromCache: page.fromCache,
    );
  }

  Future<void> _reload() async {
    final previous = state.asData?.value;
    if (previous != null) {
      state = AsyncData(_copy(previous, refreshing: true));
    }
    try {
      state = AsyncData(await _firstPage(online: ref.read(connectivityProvider).isOnline));
    } catch (error, stack) {
      if (previous == null) {
        state = AsyncError(error, stack);
        return;
      }
      state = AsyncData(_copy(previous, refreshFailed: true));
    }
  }

  MyBookingsState _copy(
    MyBookingsState source, {
    bool refreshing = false,
    bool refreshFailed = false,
    bool loadingMore = false,
    bool loadMoreFailed = false,
  }) {
    return MyBookingsState(
      items: source.items,
      nextCursor: source.nextCursor,
      filterIndex: source.filterIndex,
      fromCache: source.fromCache,
      refreshing: refreshing,
      refreshFailed: refreshFailed,
      loadingMore: loadingMore,
      loadMoreFailed: loadMoreFailed,
    );
  }
}

final myBookingsProvider = AsyncNotifierProvider<MyBookingsController, MyBookingsState>(
  MyBookingsController.new,
);
