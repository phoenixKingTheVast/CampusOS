import 'package:campusos/app/providers.dart';
import 'package:campusos/shared/models/announcement.dart';
import 'package:campusos/shared/models/assessment.dart';
import 'package:campusos/shared/models/course_offering.dart';
import 'package:campusos/shared/models/course_people.dart';
import 'package:campusos/shared/models/discussion.dart';
import 'package:campusos/shared/models/laboratory.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:campusos/shared/models/study_group.dart';
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

final courseAssessmentsProvider =
    FutureProvider.autoDispose.family<AssessmentList, String>((ref, courseOfferingId) {
  return ref.watch(courseRepositoryProvider).assessments(courseOfferingId);
});

final assessmentProvider = FutureProvider.autoDispose.family<Assessment, String>((ref, id) {
  return ref.watch(courseRepositoryProvider).getAssessment(id);
});

final courseLaboratoriesProvider =
    FutureProvider.autoDispose.family<LaboratoryList, String>((ref, courseOfferingId) {
  return ref.watch(courseRepositoryProvider).laboratories(courseOfferingId);
});

final laboratoryProvider = FutureProvider.autoDispose.family<Laboratory, String>((ref, id) {
  return ref.watch(courseRepositoryProvider).getLaboratory(id);
});

final courseDiscussionsProvider =
    FutureProvider.autoDispose.family<DiscussionList, String>((ref, courseOfferingId) {
  return ref.watch(courseRepositoryProvider).discussions(courseOfferingId);
});

final discussionProvider = FutureProvider.autoDispose.family<Discussion, String>((ref, id) {
  return ref.watch(courseRepositoryProvider).getDiscussion(id);
});

final courseStudyGroupsProvider =
    FutureProvider.autoDispose.family<StudyGroupList, String>((ref, courseOfferingId) {
  return ref.watch(courseRepositoryProvider).studyGroups(courseOfferingId);
});

final studyGroupProvider = FutureProvider.autoDispose.family<StudyGroup, String>((ref, id) {
  return ref.watch(courseRepositoryProvider).getStudyGroup(id);
});

final coursePeopleProvider =
    FutureProvider.autoDispose.family<CoursePeople, String>((ref, courseOfferingId) {
  return ref.watch(courseRepositoryProvider).people(courseOfferingId);
});
