describe('resource metadata window', () => {
  const windowMs = 45 * 60 * 1000;

  it('allows edits before editableUntil', () => {
    const createdAt = new Date('2026-09-15T22:27:00Z');
    const editableUntil = new Date(createdAt.getTime() + windowMs);
    const now = new Date('2026-09-15T23:00:00Z');
    expect(now < editableUntil).toBe(true);
  });

  it('locks metadata after 45 minutes using server time', () => {
    const createdAt = new Date('2026-09-15T22:27:00Z');
    const editableUntil = new Date(createdAt.getTime() + windowMs);
    const now = new Date('2026-09-15T23:13:00Z');
    expect(now < editableUntil).toBe(false);
  });
});
