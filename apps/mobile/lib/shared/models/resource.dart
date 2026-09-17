import 'package:campusos/core/permissions/permission_set.dart';
import 'package:campusos/shared/models/json_map.dart';

class ResourceCategory {
  const ResourceCategory({
    this.id,
    required this.key,
    required this.label,
    required this.groupKey,
    required this.groupLabel,
  });

  final String? id;
  final String key;
  final String label;
  final String groupKey;
  final String groupLabel;

  factory ResourceCategory.fromJson(Map<String, dynamic> json) {
    return ResourceCategory(
      id: asString(json['id']),
      key: asString(json['key']) ?? '',
      label: asString(json['label']) ?? '',
      groupKey: asString(json['groupKey']) ?? 'other',
      groupLabel: asString(json['groupLabel']) ?? 'Other',
    );
  }
}

class ResourceVersion {
  const ResourceVersion({
    required this.id,
    required this.versionNumber,
    this.changeSummary,
    this.createdAt,
    this.current = false,
    this.fileId,
  });

  final String id;
  final int versionNumber;
  final String? changeSummary;
  final DateTime? createdAt;
  final bool current;
  final String? fileId;

  factory ResourceVersion.fromJson(Map<String, dynamic> json) {
    return ResourceVersion(
      id: asString(json['id']) ?? '',
      versionNumber: asInt(json['versionNumber']) ?? 1,
      changeSummary: asString(json['changeSummary']),
      createdAt: asDateTime(json['createdAt']),
      current: asBool(json['current']),
      fileId: asString(json['fileId']),
    );
  }
}

class ResourceItem {
  const ResourceItem({
    required this.id,
    required this.title,
    required this.resourceType,
    required this.courseId,
    required this.courseOfferingId,
    required this.status,
    this.description,
    this.courseCode,
    this.courseTitle,
    this.offeringLabel,
    this.historical = false,
    this.visibility,
    this.uploadedBy,
    this.authoredBy,
    this.category,
    this.currentVersionId,
    this.versionNumber = 1,
    this.fileId,
    this.mimeType,
    this.sizeBytes,
    this.originalName,
    this.academicYear,
    this.semesterLabel,
    this.solutionAvailable = false,
    this.endorsed = false,
    this.endorserName,
    this.publishedAt,
    this.createdAt,
    this.canEditMetadata = false,
    this.editableUntil,
    this.offline = false,
    this.offlineVersion,
  });

  final String id;
  final String title;
  final String? description;
  final String resourceType;
  final String courseId;
  final String courseOfferingId;
  final String? courseCode;
  final String? courseTitle;
  final String? offeringLabel;
  final bool historical;
  final String? visibility;
  final String status;
  final String? uploadedBy;
  final String? authoredBy;
  final ResourceCategory? category;
  final String? currentVersionId;
  final int versionNumber;
  final String? fileId;
  final String? mimeType;
  final int? sizeBytes;
  final String? originalName;
  final int? academicYear;
  final String? semesterLabel;
  final bool solutionAvailable;
  final bool endorsed;
  final String? endorserName;
  final DateTime? publishedAt;
  final DateTime? createdAt;
  final bool canEditMetadata;
  final DateTime? editableUntil;
  final bool offline;
  final int? offlineVersion;

  bool get isProcessing => status == 'PROCESSING';
  bool get isRemoved => status == 'REMOVED';
  bool get hasNewerOfflineVersion =>
      offline && offlineVersion != null && versionNumber > offlineVersion!;

  factory ResourceItem.fromJson(Map<String, dynamic> json) {
    return ResourceItem(
      id: asString(json['id']) ?? '',
      title: asString(json['title']) ?? '',
      description: asString(json['description']),
      resourceType: asString(json['resourceType']) ?? '',
      courseId: asString(json['courseId']) ?? '',
      courseOfferingId: asString(json['courseOfferingId']) ?? '',
      courseCode: asString(json['courseCode']),
      courseTitle: asString(json['courseTitle']),
      offeringLabel: asString(json['offeringLabel']) ?? asString(json['semesterLabel']),
      historical: asBool(json['historical']),
      visibility: asString(json['visibility']),
      status: asString(json['status']) ?? 'PUBLISHED',
      uploadedBy: asString(json['uploadedBy']),
      authoredBy: asString(json['authoredBy']),
      category: json['category'] is Map
          ? ResourceCategory.fromJson(asJsonMap(json['category']))
          : null,
      currentVersionId: asString(json['currentVersionId']),
      versionNumber: asInt(json['versionNumber']) ?? 1,
      fileId: asString(json['fileId']),
      mimeType: asString(json['mimeType']),
      sizeBytes: asInt(json['sizeBytes']),
      originalName: asString(json['originalName']),
      academicYear: asInt(json['academicYear']),
      semesterLabel: asString(json['semesterLabel']),
      solutionAvailable: asBool(json['solutionAvailable']),
      endorsed: asBool(json['endorsed']),
      endorserName: asString(json['endorserName']),
      publishedAt: asDateTime(json['publishedAt']),
      createdAt: asDateTime(json['createdAt']),
      canEditMetadata: asBool(json['canEditMetadata']),
      editableUntil: asDateTime(json['editableUntil']),
    );
  }

  ResourceItem copyWith({
    bool? offline,
    int? offlineVersion,
    bool? canEditMetadata,
    bool? historical,
    String? title,
    String? description,
  }) {
    return ResourceItem(
      id: id,
      title: title ?? this.title,
      description: description ?? this.description,
      resourceType: resourceType,
      courseId: courseId,
      courseOfferingId: courseOfferingId,
      courseCode: courseCode,
      courseTitle: courseTitle,
      offeringLabel: offeringLabel,
      historical: historical ?? this.historical,
      visibility: visibility,
      status: status,
      uploadedBy: uploadedBy,
      authoredBy: authoredBy,
      category: category,
      currentVersionId: currentVersionId,
      versionNumber: versionNumber,
      fileId: fileId,
      mimeType: mimeType,
      sizeBytes: sizeBytes,
      originalName: originalName,
      academicYear: academicYear,
      semesterLabel: semesterLabel,
      solutionAvailable: solutionAvailable,
      endorsed: endorsed,
      endorserName: endorserName,
      publishedAt: publishedAt,
      createdAt: createdAt,
      canEditMetadata: canEditMetadata ?? this.canEditMetadata,
      editableUntil: editableUntil,
      offline: offline ?? this.offline,
      offlineVersion: offlineVersion ?? this.offlineVersion,
    );
  }

  Map<String, Object?> toRow() {
    return {
      'id': id,
      'course_id': courseId,
      'course_offering_id': courseOfferingId,
      'title': title,
      'description': description,
      'resource_type': resourceType,
      'category_key': category?.key,
      'category_label': category?.label,
      'group_key': category?.groupKey,
      'group_label': category?.groupLabel,
      'visibility': visibility,
      'status': status,
      'uploaded_by': uploadedBy,
      'authored_by': authoredBy,
      'current_version_id': currentVersionId,
      'version_number': versionNumber,
      'file_id': fileId,
      'mime_type': mimeType,
      'size_bytes': sizeBytes,
      'academic_year': academicYear,
      'semester_label': semesterLabel ?? offeringLabel,
      'course_code': courseCode,
      'course_title': courseTitle,
      'offering_label': offeringLabel,
      'historical': historical ? 1 : 0,
      'endorsed': endorsed ? 1 : 0,
      'endorser_name': endorserName,
      'can_edit_metadata': canEditMetadata ? 1 : 0,
      'editable_until': editableUntil?.toIso8601String(),
      'published_at': publishedAt?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
      'solution_available': solutionAvailable ? 1 : 0,
    };
  }

  factory ResourceItem.fromRow(Map<String, Object?> row) {
    final groupKey = asString(row['group_key']);
    return ResourceItem(
      id: asString(row['id']) ?? '',
      title: asString(row['title']) ?? '',
      description: asString(row['description']),
      resourceType: asString(row['resource_type']) ?? '',
      courseId: asString(row['course_id']) ?? '',
      courseOfferingId: asString(row['course_offering_id']) ?? '',
      courseCode: asString(row['course_code']),
      courseTitle: asString(row['course_title']),
      offeringLabel: asString(row['offering_label']),
      historical: asBool(row['historical']),
      visibility: asString(row['visibility']),
      status: asString(row['status']) ?? 'PUBLISHED',
      uploadedBy: asString(row['uploaded_by']),
      authoredBy: asString(row['authored_by']),
      category: groupKey == null
          ? null
          : ResourceCategory(
              key: asString(row['category_key']) ?? '',
              label: asString(row['category_label']) ?? '',
              groupKey: groupKey,
              groupLabel: asString(row['group_label']) ?? 'Other',
            ),
      currentVersionId: asString(row['current_version_id']),
      versionNumber: asInt(row['version_number']) ?? 1,
      fileId: asString(row['file_id']),
      mimeType: asString(row['mime_type']),
      sizeBytes: asInt(row['size_bytes']),
      academicYear: asInt(row['academic_year']),
      semesterLabel: asString(row['semester_label']),
      endorsed: asBool(row['endorsed']),
      endorserName: asString(row['endorser_name']),
      publishedAt: asDateTime(row['published_at']),
      createdAt: asDateTime(row['created_at']),
      canEditMetadata: asBool(row['can_edit_metadata']),
      editableUntil: asDateTime(row['editable_until']),
      solutionAvailable: asBool(row['solution_available']),
    );
  }
}

class ResourceDetail {
  const ResourceDetail({
    required this.resource,
    this.related = const [],
    this.endorsement,
    this.versions = const [],
  });

  final ResourceItem resource;
  final List<RelatedResource> related;
  final ResourceEndorsement? endorsement;
  final List<ResourceVersion> versions;

  factory ResourceDetail.fromJson(Map<String, dynamic> json) {
    return ResourceDetail(
      resource: ResourceItem.fromJson(json),
      related: asJsonMapList(json['related']).map(RelatedResource.fromJson).toList(),
      endorsement: json['endorsement'] is Map
          ? ResourceEndorsement.fromJson(asJsonMap(json['endorsement']))
          : null,
      versions: asJsonMapList(json['versions']).map(ResourceVersion.fromJson).toList(),
    );
  }
}

class RelatedResource {
  const RelatedResource({
    required this.id,
    required this.type,
    required this.title,
    this.offering,
  });

  final String id;
  final String type;
  final String title;
  final String? offering;

  factory RelatedResource.fromJson(Map<String, dynamic> json) {
    return RelatedResource(
      id: asString(json['id']) ?? '',
      type: asString(json['type']) ?? '',
      title: asString(json['title']) ?? '',
      offering: asString(json['offering']),
    );
  }
}

class ResourceEndorsement {
  const ResourceEndorsement({
    this.endorserName,
    this.comment,
    this.createdAt,
  });

  final String? endorserName;
  final String? comment;
  final DateTime? createdAt;

  factory ResourceEndorsement.fromJson(Map<String, dynamic> json) {
    return ResourceEndorsement(
      endorserName: asString(json['endorserName']),
      comment: asString(json['comment']),
      createdAt: asDateTime(json['createdAt']),
    );
  }
}

class ResourceList {
  const ResourceList({
    required this.currentOfferingId,
    required this.items,
    required this.permissions,
  });

  final String currentOfferingId;
  final List<ResourceItem> items;
  final PermissionSet permissions;

  factory ResourceList.fromJson(Map<String, dynamic> json) {
    return ResourceList(
      currentOfferingId: asString(json['currentOfferingId']) ?? '',
      items: asJsonMapList(json['items']).map(ResourceItem.fromJson).toList(),
      permissions: PermissionSet.fromJson(json['permissions']),
    );
  }
}
