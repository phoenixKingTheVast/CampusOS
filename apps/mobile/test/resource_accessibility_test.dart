import 'package:campusos/features/resources/domain/resource_accessibility.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ResourceAccessibility', () {
    test('builds a VoiceOver label with provenance and offline state', () {
      expect(
        ResourceAccessibility.label(
          title: 'Nyquist notes',
          type: 'Lecture notes',
          course: 'EENG401',
          uploader: 'Jane Smith',
          endorsed: true,
          version: 2,
          offline: true,
        ),
        'Nyquist notes, Lecture notes, EENG401, Uploaded by Jane Smith, Endorsed, Version 2, Available offline',
      );
    });

    test('labels historical items with the original offering', () {
      expect(
        ResourceAccessibility.label(
          title: 'Past paper',
          type: 'Exam',
          course: 'EENG401',
          uploader: 'Dr John Moyo',
          endorsed: false,
          version: 1,
          offline: false,
          historical: true,
          originalOffering: '2025 Semester 2',
        ),
        'Past paper, Exam, EENG401, Uploaded by Dr John Moyo, Version 1, Not saved offline, From 2025 Semester 2, historical',
      );
    });
  });
}
