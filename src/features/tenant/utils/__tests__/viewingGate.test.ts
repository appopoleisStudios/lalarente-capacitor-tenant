import { viewingGate, isViewingUpcoming } from '../viewingGate';

const now = new Date(2026, 10, 15, 12, 0); // 15 Nov 2026 12:00 local

it('allows requesting and applying when there is no open viewing', () => {
  expect(viewingGate(null, now)).toMatchObject({ canRequestViewing: true, canApply: true });
});

it('blocks a second request while one is pending (CT7-030)', () => {
  const g = viewingGate(
    { status: 'pending', requested_date: '2026-11-16', confirmed_date: null },
    now
  );
  expect(g.canRequestViewing).toBe(false);
  expect(g.requestLabel).toBe('Viewing Requested');
});

it('blocks applying until an approved viewing has happened (CT7-032)', () => {
  const v = {
    status: 'approved',
    requested_date: '2026-11-16',
    confirmed_date: '2026-11-16T08:00:00Z',
  };
  expect(viewingGate(v, now)).toMatchObject({
    canRequestViewing: false,
    canApply: false,
    requestLabel: 'Viewing Booked',
  });
  expect(viewingGate(v, new Date('2026-11-16T09:00:00Z')).canApply).toBe(true);
});

it('treats an unconfirmed requested date as upcoming until that day ends', () => {
  expect(
    isViewingUpcoming(
      { status: 'pending', requested_date: '2026-11-15', confirmed_date: null },
      now
    )
  ).toBe(true);
  expect(
    isViewingUpcoming(
      { status: 'pending', requested_date: '2026-11-14', confirmed_date: null },
      now
    )
  ).toBe(false);
});

it('re-enables everything once the viewing is declined, cancelled or completed', () => {
  for (const status of ['declined', 'cancelled', 'completed']) {
    expect(
      viewingGate({ status, requested_date: '2026-11-20', confirmed_date: null }, now)
    ).toMatchObject({
      canRequestViewing: true,
      canApply: true,
    });
  }
});
