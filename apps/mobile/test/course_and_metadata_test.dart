import 'package:campusos/features/courses/domain/course_tab.dart';
import 'package:campusos/features/resources/domain/metadata_edit_window.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('course tabs are identified by path, not colour', () {
    expect(CourseTab.fromPath('resources'), CourseTab.resources);
    expect(CourseTab.fromPath('announcements').label, 'Announcements');
    expect(CourseTab.fromPath('unknown'), CourseTab.overview);
  });

  test('metadata edits are allowed only when the server says so', () {
    expect(MetadataEditWindow.canEdit(canEditMetadata: true), isTrue);
    expect(MetadataEditWindow.canEdit(canEditMetadata: false), isFalse);
    expect(
      MetadataEditWindow.remaining(
        DateTime.parse('2026-09-15T23:12:00Z'),
        DateTime.parse('2026-09-15T23:13:00Z'),
      ),
      Duration.zero,
    );
  });
}
