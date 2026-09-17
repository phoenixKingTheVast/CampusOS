class MetadataEditWindow {
  const MetadataEditWindow._();

  /// Authorization comes from the server `canEditMetadata` flag.
  /// Local clocks are never used as the only protection.
  static bool canEdit({required bool canEditMetadata}) => canEditMetadata;

  static Duration remaining(DateTime editableUntil, DateTime now) {
    final delta = editableUntil.difference(now);
    return delta.isNegative ? Duration.zero : delta;
  }
}
