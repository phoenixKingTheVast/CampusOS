class PermissionSet {
  PermissionSet(Iterable<String> values) : _values = {...values};

  final Set<String> _values;

  static const view = 'VIEW';
  static const createAnnouncement = 'CREATE_ANNOUNCEMENT';
  static const editAnnouncement = 'EDIT_ANNOUNCEMENT';
  static const publishAnnouncement = 'PUBLISH_ANNOUNCEMENT';
  static const archiveAnnouncement = 'ARCHIVE_ANNOUNCEMENT';
  static const createResource = 'CREATE_RESOURCE';
  static const editResource = 'EDIT_RESOURCE';
  static const endorseResource = 'ENDORSE_RESOURCE';
  static const viewResource = 'VIEW_RESOURCE';

  bool allows(String permission) => _values.contains(permission);

  bool get canCreateAnnouncement => allows(createAnnouncement);
  bool get canEditAnnouncement => allows(editAnnouncement);
  bool get canArchiveAnnouncement => allows(archiveAnnouncement);
  bool get canCreateResource => allows(createResource);
  bool get canEditResource => allows(editResource);
  bool get canEndorseResource => allows(endorseResource);

  List<String> get values => _values.toList(growable: false);

  factory PermissionSet.fromJson(dynamic json) {
    if (json is List) {
      return PermissionSet(json.map((item) => '$item'));
    }
    return PermissionSet(const []);
  }

  static PermissionSet none() => PermissionSet(const []);
}
