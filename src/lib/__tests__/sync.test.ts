import { describe, expect, it } from 'vitest';
import { appendEntries } from '../ledger';
import { mergeLedgers } from '../sync';

describe('phone and server copies of the khata', async () => {
  const base = await appendEntries([], [
    { type: 'opening', memberId: null, amount: 1000, meetingId: 'h' },
    { type: 'savings', memberId: 'a', amount: 100, meetingId: 'h' },
  ]);
  const phone = await appendEntries(base, [{ type: 'savings', memberId: 'b', amount: 50, meetingId: 'm' }]);
  const other = await appendEntries(base, [{ type: 'savings', memberId: 'c', amount: 70, meetingId: 'm' }]);

  it('sends what the server is missing', () => {
    const m = mergeLedgers(phone, base);
    expect(m.ledger).toBe(phone);
    expect(m.toPush).toEqual(phone.slice(2));
    expect(m.conflict).toBe(false);
  });

  it('takes newer entries written on another phone', () => {
    expect(mergeLedgers(base, phone)).toEqual({ ledger: phone, toPush: [], conflict: false });
  });

  it('keeps the server copy when two phones wrote different entries', () => {
    expect(mergeLedgers(phone, other)).toEqual({ ledger: other, toPush: [], conflict: true });
  });

  it('handles an empty side', () => {
    expect(mergeLedgers([], base).ledger).toBe(base);
    expect(mergeLedgers(base, []).toPush).toEqual(base);
  });
});
