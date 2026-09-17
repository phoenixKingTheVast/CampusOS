import 'package:campusos/features/resources/domain/resource_accessibility.dart';
import 'package:campusos/features/resources/domain/resource_catalog.dart';
import 'package:campusos/shared/models/resource.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('VoiceOver label includes provenance, endorsement, version and offline state', () {
    expect(
      ResourceAccessibility.label(
        title: 'EENG401 Tutorial 3',
        type: 'tutorial PDF',
        course: 'EENG401',
        uploader: 'Tawanda M',
        endorsed: true,
        version: 2,
        offline: true,
      ),
      'EENG401 Tutorial 3, tutorial PDF, EENG401, Uploaded by Tawanda M, Endorsed, Version 2, Available offline',
    );
  });

  test('catalog groups current official, student and historical offerings separately', () {
    const official = ResourceItem(
      id: 'res-1',
      title: 'Lecture 05',
      resourceType: 'LECTURE_NOTES',
      courseId: 'course_eeng401',
      courseOfferingId: 'coe-2026-s2-eeng401',
      status: 'PUBLISHED',
      category: ResourceCategory(
        key: 'LECTURE_NOTES',
        label: 'Lecture Notes',
        groupKey: 'OFFICIAL',
        groupLabel: 'Official Course Resources',
      ),
    );
    const historical = ResourceItem(
      id: 'res-2',
      title: '2025 Final Exam',
      resourceType: 'PAST_EXAM',
      courseId: 'course_eeng401',
      courseOfferingId: 'coe-2025-s2-eeng401',
      status: 'PUBLISHED',
      historical: true,
      offeringLabel: '2025 Semester 2',
    );
    final catalog = ResourceCatalog.fromItems(const [official, historical]);
    expect(catalog.sections.first.label, 'Official Course Resources');
    expect(catalog.sections.last.historical, isTrue);
    expect(catalog.sections.last.label, '2025 Semester 2');
  });
}
