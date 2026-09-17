import {
  authorAttribution,
  canAuthenticate,
  canCancelDeletion,
  canTransitionAccount,
  canTransitionExport,
  deletionGraceEndsAt,
  exportDownloadable,
  isDiscoverable,
} from './account-lifecycle';

describe('account lifecycle', () => {
  it('treats deactivation and deletion as distinct states', () => {
    expect(canTransitionAccount('ACTIVE', 'DEACTIVATED')).toBe(true);
    expect(canTransitionAccount('DEACTIVATED', 'ACTIVE')).toBe(true);
    expect(canTransitionAccount('ACTIVE', 'DELETED')).toBe(false);
    expect(canTransitionAccount('DELETION_REQUESTED', 'DELETION_PROCESSING')).toBe(true);
    expect(canTransitionAccount('DELETED', 'ACTIVE')).toBe(false);
  });

  it('allows cancelling deletion inside the grace period only', () => {
    const requestedAt = new Date('2026-09-01T10:00:00Z');
    expect(deletionGraceEndsAt(requestedAt).toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(
      canCancelDeletion({ state: 'DELETION_REQUESTED', requestedAt, now: new Date('2026-09-20T10:00:00Z') }),
    ).toBe(true);
    expect(
      canCancelDeletion({ state: 'DELETION_REQUESTED', requestedAt, now: new Date('2026-10-05T10:00:00Z') }),
    ).toBe(false);
    expect(
      canCancelDeletion({ state: 'DELETION_PROCESSING', requestedAt, now: new Date('2026-09-20T10:00:00Z') }),
    ).toBe(false);
  });

  it('blocks authentication and discovery for a deactivated account', () => {
    expect(canAuthenticate('DEACTIVATED')).toBe(false);
    expect(canAuthenticate('SUSPENDED')).toBe(false);
    expect(canAuthenticate('DELETION_REQUESTED')).toBe(true);
    expect(isDiscoverable('DEACTIVATED')).toBe(false);
    expect(isDiscoverable('ACTIVE')).toBe(true);
  });

  it('preserves conversation continuity by attributing deleted authors', () => {
    expect(authorAttribution({ state: 'DELETED', displayName: 'Matthew Dziirutsva' })).toBe('Deleted account');
    expect(authorAttribution({ state: 'ACTIVE', displayName: 'Matthew Dziirutsva' })).toBe('Matthew Dziirutsva');
  });

  it('expires data export downloads', () => {
    expect(canTransitionExport('REQUESTED', 'PROCESSING')).toBe(true);
    expect(canTransitionExport('REQUESTED', 'READY')).toBe(false);
    expect(canTransitionExport('EXPIRED', 'READY')).toBe(false);

    const readyAt = new Date('2026-09-16T10:00:00Z');
    expect(exportDownloadable({ state: 'READY', readyAt, now: new Date('2026-09-17T10:00:00Z') })).toBe(true);
    expect(exportDownloadable({ state: 'READY', readyAt, now: new Date('2026-09-19T10:00:00Z') })).toBe(false);
    expect(exportDownloadable({ state: 'PROCESSING', readyAt, now: new Date('2026-09-16T11:00:00Z') })).toBe(false);
  });
});
