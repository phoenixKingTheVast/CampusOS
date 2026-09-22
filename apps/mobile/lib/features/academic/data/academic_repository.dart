import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/shared/models/academic_class.dart';

class AcademicRepository {
  AcademicRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<AcademicClassDetail> getClass(String classId) async {
    return AcademicClassDetail.fromJson(await _api.get('classes/$classId'));
  }

  Future<void> requestMembership(String classId) async {
    await _api.post('classes/$classId/membership-requests');
  }
}
