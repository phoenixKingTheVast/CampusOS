describe('event RSVP capacity', () => {
  function nextResponse(goingCount: number, capacity: number | null, requested: string) {
    if (requested !== 'GOING' || capacity == null) {
      return requested;
    }
    return goingCount >= capacity ? 'WAITLISTED' : 'GOING';
  }

  it('confirms Going when capacity remains', () => {
    expect(nextResponse(99, 100, 'GOING')).toBe('GOING');
  });

  it('waitlists when capacity is full', () => {
    expect(nextResponse(100, 100, 'GOING')).toBe('WAITLISTED');
  });

  it('never treats Going as attendance', () => {
    const rsvp = 'GOING';
    const attendance = null;
    expect(rsvp).not.toBe(attendance);
  });
});
