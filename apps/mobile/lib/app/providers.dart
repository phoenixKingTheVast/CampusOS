import 'package:campusos/core/authentication/secure_session_storage.dart';
import 'package:campusos/core/authentication/session_manager.dart';
import 'package:campusos/core/connectivity/connectivity_monitor.dart';
import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/logging/app_logger.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/synchronization/sync_engine.dart';
import 'package:campusos/features/authentication/data/auth_repository.dart';
import 'package:campusos/features/courses/data/course_repository.dart';
import 'package:campusos/features/home/data/home_repository.dart';
import 'package:campusos/features/learn/data/learn_repository.dart';
import 'package:campusos/features/notifications/data/notifications_repository.dart';
import 'package:campusos/features/onboarding/data/onboarding_repository.dart';
import 'package:campusos/features/profile/data/profile_repository.dart';
import 'package:campusos/features/resources/data/resource_repository.dart';
import 'package:campusos/features/search/data/search_repository.dart';
import 'package:campusos/shared/models/account_state.dart';
import 'package:campusos/shared/models/home_snapshot.dart';
import 'package:campusos/shared/models/person.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final appGraphProvider = Provider<AppGraph>((ref) => AppGraph());

class AppGraph {
  AppGraph() {
    logger = const AppLogger();
    storage = SecureSessionStorage();
    database = AppDatabase();
    connectivity = ConnectivityMonitor();
    session = SessionManager(storage: storage, database: database);
    api = ApiClient(sessionManager: session);
    session.bindApi(api);
    sync = SyncEngine(api: api, database: database, session: session, logger: logger);
    authRepository = AuthRepository(api: api);
    onboardingRepository = OnboardingRepository(api: api, database: database, sync: sync);
    homeRepository = HomeRepository(api: api, database: database, sync: sync);
    searchRepository = SearchRepository(api: api, database: database);
    learnRepository = LearnRepository(api: api, database: database, sync: sync);
    courseRepository = CourseRepository(api: api, database: database, sync: sync);
    resourceRepository = ResourceRepository(api: api, database: database);
    notificationsRepository = NotificationsRepository(api: api, database: database);
    profileRepository = ProfileRepository(api: api, database: database, session: session);
  }

  late final AppLogger logger;
  late final SecureSessionStorage storage;
  late final AppDatabase database;
  late final ConnectivityMonitor connectivity;
  late final SessionManager session;
  late final ApiClient api;
  late final SyncEngine sync;
  late final AuthRepository authRepository;
  late final OnboardingRepository onboardingRepository;
  late final HomeRepository homeRepository;
  late final SearchRepository searchRepository;
  late final LearnRepository learnRepository;
  late final CourseRepository courseRepository;
  late final ResourceRepository resourceRepository;
  late final NotificationsRepository notificationsRepository;
  late final ProfileRepository profileRepository;
}

final sessionManagerProvider = Provider<SessionManager>(
  (ref) => ref.watch(appGraphProvider).session,
);
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => ref.watch(appGraphProvider).authRepository,
);
final onboardingRepositoryProvider = Provider<OnboardingRepository>(
  (ref) => ref.watch(appGraphProvider).onboardingRepository,
);
final homeRepositoryProvider = Provider<HomeRepository>(
  (ref) => ref.watch(appGraphProvider).homeRepository,
);
final searchRepositoryProvider = Provider<SearchRepository>(
  (ref) => ref.watch(appGraphProvider).searchRepository,
);
final learnRepositoryProvider = Provider<LearnRepository>(
  (ref) => ref.watch(appGraphProvider).learnRepository,
);
final courseRepositoryProvider = Provider<CourseRepository>(
  (ref) => ref.watch(appGraphProvider).courseRepository,
);
final resourceRepositoryProvider = Provider<ResourceRepository>(
  (ref) => ref.watch(appGraphProvider).resourceRepository,
);
final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => ref.watch(appGraphProvider).notificationsRepository,
);
final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ref.watch(appGraphProvider).profileRepository,
);

class SessionNotifier extends Notifier<SessionSnapshot> {
  @override
  SessionSnapshot build() => SessionSnapshot.unknown;

  void replace(SessionSnapshot snapshot) => state = snapshot;

  void setAuthenticated(Person person) {
    state = SessionSnapshot(
      status: SessionStatus.valid,
      person: person,
      accountState: person.accountState,
    );
  }

  void clear() => state = SessionSnapshot.none;

  void markFailed() => state = SessionSnapshot.failed;
}

final sessionProvider = NotifierProvider<SessionNotifier, SessionSnapshot>(SessionNotifier.new);

class ConnectivityNotifier extends Notifier<ConnectivityStatus> {
  @override
  ConnectivityStatus build() {
    final monitor = ref.watch(appGraphProvider).connectivity;
    final sub = monitor.onlineChanges.listen((online) {
      state = ConnectivityStatus(isOnline: online);
    });
    ref.onDispose(sub.cancel);
    return const ConnectivityStatus(isOnline: true);
  }
}

final connectivityProvider =
    NotifierProvider<ConnectivityNotifier, ConnectivityStatus>(ConnectivityNotifier.new);

final homeProvider = AsyncNotifierProvider<HomeController, HomeSnapshot>(HomeController.new);

class HomeController extends AsyncNotifier<HomeSnapshot> {
  @override
  Future<HomeSnapshot> build() {
    final online = ref.watch(connectivityProvider).isOnline;
    return ref.read(homeRepositoryProvider).load(online: online);
  }

  Future<void> refresh() async {
    final previous = state.asData?.value;
    if (previous != null) {
      state = AsyncData(previous.copyWith(refreshing: true, refreshFailed: false));
    }
    try {
      final next = await ref.read(homeRepositoryProvider).load(online: true);
      state = AsyncData(next);
    } catch (error, stack) {
      if (previous != null) {
        state = AsyncData(previous.copyWith(refreshing: false, refreshFailed: true));
        return;
      }
      state = AsyncError(error, stack);
    }
  }
}
