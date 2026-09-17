import 'package:campusos/core/database/app_database.dart';
import 'package:campusos/core/network/api_client.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/shared/models/json_map.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

class ResourceRepository {
  ResourceRepository({
    required ApiClient api,
    required AppDatabase database,
  })  : _api = api,
        _database = database;

  final ApiClient _api;
  final AppDatabase _database;

  Future<ResourceDetail> get(String resourceId, {required bool online}) async {
    if (!online) {
      final cached = await _database.resourceById(resourceId);
      if (cached == null) {
        throw const ApiError(
          code: 'NOT_FOUND',
          message: ApiError.resourceRemovedMessage,
        );
      }
      final offline = await _attachOffline(cached);
      return ResourceDetail(resource: offline);
    }
    try {
      final body = await _api.get('resources/$resourceId');
      final detail = ResourceDetail.fromJson(body);
      await _database.upsertResource(detail.resource);
      for (final version in detail.versions) {
        await _database.upsert('resource_versions', {
          'id': version.id,
          'resource_id': resourceId,
          'version_number': version.versionNumber,
          'file_id': version.fileId,
          'change_summary': version.changeSummary,
          'created_at': version.createdAt?.toIso8601String(),
          'current': version.current ? 1 : 0,
        });
      }
      final withOffline = await _attachOffline(detail.resource);
      return ResourceDetail(
        resource: withOffline,
        related: detail.related,
        endorsement: detail.endorsement,
        versions: detail.versions,
      );
    } on ApiError catch (error) {
      if (error.isPermissionDenied) {
        throw const ApiError(
          code: 'PERMISSION_DENIED',
          message: ApiError.resourceUnauthorizedMessage,
        );
      }
      if (error.isNotFound) {
        throw const ApiError(
          code: 'NOT_FOUND',
          message: ApiError.resourceRemovedMessage,
        );
      }
      rethrow;
    }
  }

  Future<ResourceItem> updateMetadata({
    required String resourceId,
    required bool canEditMetadata,
    String? title,
    String? description,
  }) async {
    if (!canEditMetadata) {
      throw const ApiError(
        code: 'PERMISSION_DENIED',
        message: ApiError.permissionDeniedMessage,
      );
    }
    final body = await _api.patch(
      'resources/$resourceId',
      data: {
        if (title != null) 'title': title,
        if (description != null) 'description': description,
      },
    );
    final item = ResourceItem.fromJson(body);
    await _database.upsertResource(item);
    return item;
  }

  Future<List<ResourceCategory>> categories() async {
    final body = await _api.get('resource-categories');
    final groups = asJsonMapList(body['groups']);
    final items = <ResourceCategory>[];
    for (final group in groups) {
      items.addAll(asJsonMapList(group['items']).map(ResourceCategory.fromJson));
    }
    if (items.isNotEmpty) {
      return items;
    }
    return asJsonMapList(body['items']).map(ResourceCategory.fromJson).toList();
  }

  Future<ResourceItem> uploadResource({
    required String courseOfferingId,
    required String title,
    required String resourceType,
    required String fileName,
    required String mimeType,
    required List<int> bytes,
    String? description,
    String? categoryId,
    void Function(String status)? onStatus,
  }) async {
    onStatus?.call('Uploading...');
    final session = await _api.post(
      'files/upload-sessions',
      data: {
        'fileName': fileName,
        'mimeType': mimeType,
        'sizeBytes': bytes.length,
      },
    );
    final fileId = asString(session['fileId']);
    final token = asString(session['uploadToken']);
    if (fileId == null || token == null) {
      throw const ApiError(code: 'VALIDATION_ERROR', message: 'Upload session failed.');
    }
    await _api.uploadBytes(
      path: 'files/$fileId/content',
      bytes: bytes,
      filename: fileName,
      mimeType: mimeType,
      headers: {'x-upload-token': token},
    );
    onStatus?.call('Checking file...');
    await _api.post('files/$fileId/complete');
    onStatus?.call('Creating resource...');
    final body = await _api.post(
      'course-offerings/$courseOfferingId/resources',
      data: {
        'title': title,
        'resourceType': resourceType,
        if (description != null && description.isNotEmpty) 'description': description,
        'fileId': fileId,
        if (categoryId != null) 'categoryId': categoryId,
      },
    );
    onStatus?.call('Ready');
    final item = ResourceItem.fromJson(body);
    await _database.upsertResource(item);
    return item;
  }

  Future<void> report(String resourceId, {String reason = 'OTHER', String? details}) {
    return _api.post(
      'resources/$resourceId/report',
      data: {'reason': reason, if (details != null) 'details': details},
    ).then((_) {});
  }

  Future<String> shareReference(String resourceId) async {
    final body = await _api.post('resources/$resourceId/share');
    return asString(body['reference']) ?? 'campusos://resource/$resourceId';
  }

  Future<void> removeOffline(String resourceId) {
    return _database.deleteOfflineFile(resourceId);
  }

  Future<String> saveOffline(ResourceItem resource) async {
    final fileId = resource.fileId;
    if (fileId == null) {
      throw const ApiError(
        code: 'VALIDATION_ERROR',
        message: ApiError.fileProcessingMessage,
      );
    }
    final directory = await getApplicationDocumentsDirectory();
    final fileName = resource.originalName ?? '$fileId.bin';
    final savePath = p.join(directory.path, 'offline', fileName);
    await _api.download('files/$fileId/download', savePath);
    await _database.saveOfflineFile(
      id: const Uuid().v4(),
      fileId: fileId,
      resourceId: resource.id,
      localPath: savePath,
      versionNumber: resource.versionNumber,
    );
    return savePath;
  }

  Future<ResourceItem> _attachOffline(ResourceItem item) async {
    final row = await _database.offlineFileForResource(item.id);
    if (row == null) {
      return item;
    }
    return item.copyWith(
      offline: true,
      offlineVersion: asInt(row['version_number']),
    );
  }
}
