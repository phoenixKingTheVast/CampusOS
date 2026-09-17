import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/shared/models/social.dart';

/// Privacy is never cached: an audience the viewer sees must be the audience the
/// server is enforcing right now.
class PrivacyRepository {
  PrivacyRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<PrivacySettings> load() async {
    return PrivacySettings.fromJson(await _api.get('privacy-settings'));
  }

  /// [changes] carries one field at a time; the server re-validates every value
  /// against its own allow-list and answers with the full settings object.
  Future<PrivacySettings> update(Map<String, Object?> changes) async {
    return PrivacySettings.fromJson(await _api.patch('privacy-settings', data: changes));
  }
}
