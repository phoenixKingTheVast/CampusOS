import 'package:campusos/app/providers.dart';
import 'package:campusos/features/academic/data/academic_repository.dart';
import 'package:campusos/shared/models/academic_class.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final academicRepositoryProvider = Provider<AcademicRepository>(
  (ref) => AcademicRepository(api: ref.watch(appGraphProvider).api),
);

final academicClassProvider =
    FutureProvider.autoDispose.family<AcademicClassDetail, String>((ref, classId) {
  return ref.watch(academicRepositoryProvider).getClass(classId);
});
