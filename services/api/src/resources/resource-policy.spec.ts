import {
  announcementShouldPush,
  isHistoricalResource,
  metadataWindowOpen,
} from './resource-policy';

describe('resource policy', () => {
  it('keeps historical resources attached to their original offering', () => {
    expect(isHistoricalResource('coe-2025-s2-eeng401', 'coe-2026-s2-eeng401')).toBe(true);
    expect(isHistoricalResource('coe-2026-s2-eeng401', 'coe-2026-s2-eeng401')).toBe(false);
  });

  it('uses server editableUntil rather than device clocks as the only rule', () => {
    const editableUntil = new Date('2026-09-15T23:12:00Z');
    expect(metadataWindowOpen(editableUntil, new Date('2026-09-15T23:00:00Z'))).toBe(true);
    expect(metadataWindowOpen(editableUntil, new Date('2026-09-15T23:13:00Z'))).toBe(false);
  });

  it('sends push-worthy in-app notifications for important and urgent announcements', () => {
    expect(announcementShouldPush('NORMAL')).toBe(false);
    expect(announcementShouldPush('IMPORTANT')).toBe(true);
    expect(announcementShouldPush('URGENT')).toBe(true);
  });
});
