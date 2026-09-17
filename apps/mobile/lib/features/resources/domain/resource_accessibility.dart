class ResourceAccessibility {
  const ResourceAccessibility._();

  static String label({
    required String title,
    required String type,
    required String course,
    required String uploader,
    required bool endorsed,
    required int version,
    required bool offline,
    bool historical = false,
    String? originalOffering,
  }) {
    final parts = <String>[
      title,
      type,
      course,
      'Uploaded by $uploader',
      if (endorsed) 'Endorsed',
      'Version $version',
      if (offline) 'Available offline' else 'Not saved offline',
      if (historical && originalOffering != null && originalOffering.isNotEmpty)
        'From $originalOffering, historical',
    ];
    return parts.join(', ');
  }
}
