import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/synchronization/sync_engine.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/person.dart';
import 'package:campusos/shared/models/programme.dart';

class OnboardingRepository {
  OnboardingRepository({
    required ApiClient api,
    required AppDatabase database,
    required SyncEngine sync,
  })  : _api = api,
        _database = database,
        _sync = sync;

  final ApiClient _api;
  final AppDatabase _database;
  final SyncEngine _sync;

  Future<bool> usernameAvailable(String username) async {
    final body = await _api.get(
      'users/username/availability',
      query: {'username': username},
    );
    return asBool(body['available']);
  }

  Future<Person> saveProfile({
    required String displayName,
    required String username,
    String? bio,
  }) async {
    final body = await _api.post(
      'people/me/profile',
      data: {
        'displayName': displayName,
        'username': username,
        if (bio != null && bio.trim().isNotEmpty) 'bio': bio.trim(),
      },
    );
    final person = Person.fromJson(body);
    await _database.upsertPerson(person);
    return person;
  }

  Future<List<Programme>> programmes() async {
    final body = await _api.get('academic/programmes');
    return asJsonMapList(body['items']).map(Programme.fromJson).toList();
  }

  Future<StudentVerification> submitVerification({
    required String registrationNumber,
    required String programmeId,
    required String facultyId,
    String? evidenceFileId,
  }) async {
    final body = await _api.post(
      'verifications/student',
      data: {
        'registrationNumber': registrationNumber,
        'programmeId': programmeId,
        'facultyId': facultyId,
        if (evidenceFileId != null) 'evidenceFileId': evidenceFileId,
      },
    );
    return StudentVerification.fromJson(body);
  }

  Future<StudentVerification> myVerification() async {
    final body = await _api.get('verifications/student/me');
    return StudentVerification.fromJson(body);
  }

  Future<List<AcademicClass>> searchClasses(String query) async {
    try {
      final body = await _api.get('classes', query: {'search': query});
      final items = asJsonMapList(body['items']).map(AcademicClass.fromJson).toList();
      for (final item in items) {
        await _database.upsertClass(item);
      }
      return items;
    } catch (_) {
      return _database.searchClasses(query);
    }
  }

  Future<void> requestMembership(String classId) async {
    try {
      await _api.post('classes/$classId/membership-requests');
    } catch (error) {
      await _sync.enqueue('POST', 'classes/$classId/membership-requests');
      rethrow;
    }
  }
}
