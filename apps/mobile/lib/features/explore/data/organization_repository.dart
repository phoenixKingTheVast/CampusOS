import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/shared/models/organization_detail.dart';

class OrganizationRepository {
  OrganizationRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<OrganizationDetail> get(String organizationId) async {
    return OrganizationDetail.fromJson(await _api.get('organizations/$organizationId'));
  }

  Future<OrganizationDetail> join(String organizationId) async {
    await _api.post('organizations/$organizationId/join');
    return get(organizationId);
  }

  Future<OrganizationDetail> leave(String organizationId) async {
    await _api.post('organizations/$organizationId/leave');
    return get(organizationId);
  }

  Future<OrganizationDetail> follow(String organizationId) async {
    await _api.post('organizations/$organizationId/follow');
    return get(organizationId);
  }

  Future<OrganizationDetail> unfollow(String organizationId) async {
    await _api.delete('organizations/$organizationId/follow');
    return get(organizationId);
  }
}
