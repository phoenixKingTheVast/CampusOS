import 'package:campusos/features/resources/domain/metadata_edit_window.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('MetadataEditWindow', () {
    test('uses the server canEditMetadata flag even if the local window is open', () {
      expect(
        MetadataEditWindow.canEdit(canEditMetadata: false),
        isFalse,
      );
    });

    test('allows metadata edits only when the server says canEditMetadata', () {
      expect(
        MetadataEditWindow.canEdit(canEditMetadata: true),
        isTrue,
      );
    });

    test('remaining time is display-only and not an authorization check', () {
      final createdAt = DateTime.utc(2026, 9, 15, 22, 27);
      final editableUntil = createdAt.add(const Duration(minutes: 45));
      final stillOpen = DateTime.utc(2026, 9, 15, 23);
      expect(
        MetadataEditWindow.remaining(editableUntil, stillOpen),
        const Duration(minutes: 12),
      );
      expect(MetadataEditWindow.canEdit(canEditMetadata: false), isFalse);
    });
  });
}
