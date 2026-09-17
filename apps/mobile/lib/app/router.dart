import 'package:campusos/app/bootstrap/splash_screen.dart';
import 'package:campusos/features/authentication/data/auth_repository.dart';
import 'package:campusos/features/authentication/presentation/otp_screen.dart';
import 'package:campusos/features/authentication/presentation/phone_screen.dart';
import 'package:campusos/features/authentication/presentation/welcome_screen.dart';
import 'package:campusos/features/calendar/presentation/calendar_screen.dart';
import 'package:campusos/features/calendar/presentation/create_personal_activity_screen.dart';
import 'package:campusos/features/courses/domain/course_tab.dart';
import 'package:campusos/features/courses/presentation/announcement_detail_screen.dart';
import 'package:campusos/features/courses/presentation/course_detail_screen.dart';
import 'package:campusos/features/events/presentation/event_detail_screen.dart';
import 'package:campusos/features/explore/presentation/explore_screen.dart';
import 'package:campusos/features/home/presentation/home_screen.dart';
import 'package:campusos/features/learn/presentation/learn_screen.dart';
import 'package:campusos/features/messaging/presentation/conversation_screen.dart';
import 'package:campusos/features/messaging/presentation/messages_screen.dart';
import 'package:campusos/features/notifications/presentation/notifications_screen.dart';
import 'package:campusos/features/onboarding/presentation/class_verification_screen.dart';
import 'package:campusos/features/onboarding/presentation/profile_setup_screen.dart';
import 'package:campusos/features/onboarding/presentation/student_verification_screen.dart';
import 'package:campusos/features/onboarding/presentation/verification_pending_screen.dart';
import 'package:campusos/features/profile/presentation/edit_profile_screen.dart';
import 'package:campusos/features/profile/presentation/profile_screen.dart';
import 'package:campusos/features/profile/presentation/social_list_screen.dart';
import 'package:campusos/features/provider/presentation/availability_screen.dart';
import 'package:campusos/features/provider/presentation/provider_bookings_screen.dart';
import 'package:campusos/features/provider/presentation/provider_dashboard_screen.dart';
import 'package:campusos/features/provider/presentation/provider_profile_edit_screen.dart';
import 'package:campusos/features/provider/presentation/provider_services_screen.dart';
import 'package:campusos/features/provider/presentation/provider_verification_screen.dart';
import 'package:campusos/features/provider/presentation/service_editor_screen.dart';
import 'package:campusos/features/resources/presentation/resource_viewer_screen.dart';
import 'package:campusos/features/search/presentation/search_screen.dart';
import 'package:campusos/features/services/presentation/booking_detail_screen.dart';
import 'package:campusos/features/services/presentation/booking_form_screen.dart';
import 'package:campusos/features/services/presentation/bookings_screen.dart';
import 'package:campusos/features/services/presentation/provider_public_screen.dart';
import 'package:campusos/features/services/presentation/service_detail_screen.dart';
import 'package:campusos/features/services/presentation/services_browse_screen.dart';
import 'package:campusos/features/settings/presentation/notification_preferences_screen.dart';
import 'package:campusos/features/settings/presentation/privacy_settings_screen.dart';
import 'package:campusos/shared/widgets/startup_failure_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/welcome',
        builder: (context, state) => const WelcomeScreen(),
      ),
      GoRoute(
        path: '/auth/phone',
        builder: (context, state) => const PhoneScreen(),
      ),
      GoRoute(
        path: '/auth/otp',
        builder: (context, state) {
          final extra = state.extra;
          if (extra is OtpChallenge) {
            return OtpScreen(challenge: extra);
          }
          return const PhoneScreen();
        },
      ),
      GoRoute(
        path: '/onboarding/profile',
        builder: (context, state) => const ProfileSetupScreen(),
      ),
      GoRoute(
        path: '/onboarding/student-verification',
        builder: (context, state) => const StudentVerificationScreen(),
      ),
      GoRoute(
        path: '/onboarding/verification-pending',
        builder: (context, state) => const VerificationPendingScreen(),
      ),
      GoRoute(
        path: '/onboarding/class-verification',
        builder: (context, state) => const ClassVerificationScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          final hideTabs = _hidesTabs(state.uri.path);
          return AppTabScaffold(
            navigationShell: navigationShell,
            hideTabs: hideTabs,
          );
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/home',
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/learn',
                builder: (context, state) => const LearnScreen(),
                routes: [
                  GoRoute(
                    path: 'course/:courseOfferingId',
                    redirect: (context, state) {
                      final id = state.pathParameters['courseOfferingId']!;
                      return '/app/learn/course/$id/overview';
                    },
                  ),
                  GoRoute(
                    path: 'course/:courseOfferingId/:tab',
                    builder: (context, state) => CourseDetailScreen(
                      courseOfferingId: state.pathParameters['courseOfferingId']!,
                      tab: CourseTab.fromPath(state.pathParameters['tab']),
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/explore',
                builder: (context, state) => const ExploreHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/calendar',
                builder: (context, state) => const CalendarScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/app/messages',
                builder: (context, state) => const MessagesScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/app/search',
        builder: (context, state) => SearchScreen(
          initialType: state.uri.queryParameters['type'],
        ),
      ),
      GoRoute(
        path: '/app/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/app/settings/notifications',
        builder: (context, state) => const NotificationPreferencesScreen(),
      ),
      GoRoute(
        path: '/app/settings/privacy',
        builder: (context, state) => const PrivacySettingsScreen(),
      ),
      GoRoute(
        path: '/app/messages/:conversationId',
        builder: (context, state) => ConversationScreen(
          conversationId: state.pathParameters['conversationId']!,
        ),
      ),
      // `/app/profile/edit` and `/app/profile/blocked` are declared before the
      // `:personId` route because go_router matches in declaration order and
      // would otherwise read "edit" as a person id.
      GoRoute(
        path: '/app/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/app/profile/edit',
        builder: (context, state) => const EditProfileScreen(),
      ),
      GoRoute(
        path: '/app/profile/blocked',
        builder: (context, state) => const SocialListScreen(
          kind: SocialListKind.blocked,
        ),
      ),
      GoRoute(
        path: '/app/profile/:personId',
        builder: (context, state) => ProfileScreen(
          personId: state.pathParameters['personId'],
        ),
      ),
      GoRoute(
        path: '/app/profile/:personId/followers',
        builder: (context, state) => SocialListScreen(
          personId: state.pathParameters['personId'],
          kind: SocialListKind.followers,
        ),
      ),
      GoRoute(
        path: '/app/profile/:personId/following',
        builder: (context, state) => SocialListScreen(
          personId: state.pathParameters['personId'],
          kind: SocialListKind.following,
        ),
      ),
      GoRoute(
        path: '/app/profile/:personId/connections',
        builder: (context, state) => SocialListScreen(
          personId: state.pathParameters['personId'],
          kind: SocialListKind.connections,
        ),
      ),
      GoRoute(
        path: '/app/explore/services',
        builder: (context, state) => const ServicesBrowseScreen(),
      ),
      GoRoute(
        path: '/app/explore/service/:serviceId',
        builder: (context, state) => ServiceDetailScreen(
          serviceId: state.pathParameters['serviceId']!,
        ),
      ),
      GoRoute(
        path: '/app/explore/service/:serviceId/book',
        builder: (context, state) => BookingFormScreen(
          serviceId: state.pathParameters['serviceId']!,
        ),
      ),
      GoRoute(
        path: '/app/explore/provider/:providerId',
        builder: (context, state) => ProviderPublicScreen(
          providerId: state.pathParameters['providerId']!,
        ),
      ),
      GoRoute(
        path: '/app/services/bookings',
        builder: (context, state) => const BookingsScreen(),
      ),
      GoRoute(
        path: '/app/services/bookings/:bookingId',
        builder: (context, state) => BookingDetailScreen(
          bookingId: state.pathParameters['bookingId']!,
        ),
      ),
      // Provider mode is only a set of screens. It grants nothing: the server
      // re-checks ownership of the target service or booking on every call.
      GoRoute(
        path: '/app/services/provider',
        builder: (context, state) => const ProviderDashboardScreen(),
      ),
      GoRoute(
        path: '/app/services/provider/bookings',
        builder: (context, state) => const ProviderBookingsScreen(),
      ),
      GoRoute(
        path: '/app/services/provider/services',
        builder: (context, state) => const ProviderServicesScreen(),
      ),
      GoRoute(
        path: '/app/services/provider/services/create',
        builder: (context, state) => const ServiceEditorScreen(),
      ),
      GoRoute(
        path: '/app/services/provider/services/:serviceId/edit',
        builder: (context, state) => ServiceEditorScreen(
          serviceId: state.pathParameters['serviceId'],
        ),
      ),
      GoRoute(
        path: '/app/services/provider/availability',
        builder: (context, state) => const AvailabilityScreen(),
      ),
      GoRoute(
        path: '/app/services/provider/verification',
        builder: (context, state) => const ProviderVerificationScreen(),
      ),
      GoRoute(
        path: '/app/services/provider/profile/edit',
        builder: (context, state) => const ProviderProfileEditScreen(),
      ),
      GoRoute(
        path: '/app/learn/resource/:resourceId',
        builder: (context, state) => ResourceViewerScreen(
          resourceId: state.pathParameters['resourceId']!,
        ),
      ),
      GoRoute(
        path: '/app/learn/announcement/:announcementId',
        builder: (context, state) => AnnouncementDetailScreen(
          announcementId: state.pathParameters['announcementId']!,
        ),
      ),
      GoRoute(
        path: '/app/calendar/new',
        builder: (context, state) => const CreatePersonalActivityScreen(),
      ),
      GoRoute(
        path: '/app/class/:classId',
        builder: (context, state) => const ComingSoonScreen(title: 'Class'),
      ),
      GoRoute(
        path: '/app/calendar/activity/:activityId',
        builder: (context, state) => const ComingSoonScreen(title: 'Activity'),
      ),
      GoRoute(
        path: '/app/explore/organization/:organizationId',
        builder: (context, state) => const ComingSoonScreen(title: 'Organization'),
      ),
      GoRoute(
        path: '/app/explore/event/:eventId',
        builder: (context, state) => EventDetailScreen(
          eventId: state.pathParameters['eventId']!,
        ),
      ),
      GoRoute(
        path: '/app/learn/study-group/:studyGroupId',
        builder: (context, state) => const ComingSoonScreen(title: 'Study group'),
      ),
      GoRoute(
        path: '/course/:courseOfferingId/resource/:resourceId',
        redirect: (context, state) =>
            '/app/learn/resource/${state.pathParameters['resourceId']}',
      ),
      GoRoute(
        path: '/resource/:resourceId',
        redirect: (context, state) =>
            '/app/learn/resource/${state.pathParameters['resourceId']}',
      ),
    ],
  );
});

bool _hidesTabs(String path) {
  return path.contains('/course/') ||
      path.startsWith('/app/learn/resource/') ||
      path.startsWith('/app/learn/announcement/');
}
