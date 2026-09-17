import 'package:campusos/app/providers.dart';
import 'package:campusos/shared/models/announcement.dart';
import 'package:campusos/shared/models/course_offering.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final courseOfferingProvider =
    FutureProvider.autoDispose.family<CourseOfferingDetail, String>((ref, courseOfferingId) {
  final online = ref.watch(connectivityProvider).isOnline;
  return ref.watch(courseRepositoryProvider).getOffering(courseOfferingId, online: online);
});

final courseAnnouncementsProvider =
    FutureProvider.autoDispose.family<AnnouncementList, String>((ref, courseOfferingId) {
  final online = ref.watch(connectivityProvider).isOnline;
  return ref.watch(courseRepositoryProvider).announcements(courseOfferingId, online: online);
});

final courseResourcesProvider =
    FutureProvider.autoDispose.family<ResourceList, String>((ref, courseOfferingId) {
  final online = ref.watch(connectivityProvider).isOnline;
  return ref.watch(courseRepositoryProvider).resources(courseOfferingId, online: online);
});
