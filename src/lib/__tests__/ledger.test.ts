import { describe, expect, it } from 'vitest';
import { appendEntries, computeBalances, meetingTotals, memberBalance, verifyChain, type LedgerEntry } from '../ledger';

async function sample(): Promise<LedgerEntry[]> {
  return appendEntries([], [
    { type: 'savings', memberId: 'meena', amount: 3000, meetingId: 'h' },
    { type: 'loan', memberId: 'meena', amount: 2000, meetingId: 'h' },
    { type: 'savings', memberId: 'meena', amount: 100, meetingId: 'm1' },
    { type: 'repayment', memberId: 'meena', amount: 500, meetingId: 'm1' },
  ]);
}

describe('hash-chained ledger', () => {
  it('links every entry to the one before it', async () => {
    const l = await sample();
    expect(l[0].prevHash).toBe('0'.repeat(64));
    expect(l[1].prevHash).toBe(l[0].hash);
    expect((await verifyChain(l)).ok).toBe(true);
  });

  it('detects a quiet edit of an old amount', async () => {
    const l = await sample();
    const tampered = l.map((e, i) => (i === 2 ? { ...e, amount: 10 } : e));
    const r = await verifyChain(tampered);
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(2);
  });

  it('detects a deleted entry', async () => {
    const l = await sample();
    const r = await verifyChain([l[0], l[2], l[3]]);
    expect(r.brokenAt).toBe(1);
  });
});

describe('balances', () => {
  it('computes savings, loan outstanding and group cash', async () => {
    const b = computeBalances(await sample());
    expect(memberBalance(b, 'meena')).toMatchObject({ savings: 3100, loanOutstanding: 1500 });
    expect(b.groupCash).toBe(3000 - 2000 + 100 + 500);
  });

  it('ignores reversed entries but keeps them in history', async () => {
    let l = await sample();
    l = await appendEntries(l, [{ type: 'reversal', memberId: 'meena', amount: 500, meetingId: 'm1', reverses: l[3].id }]);
    const b = computeBalances(l);
    expect(memberBalance(b, 'meena').loanOutstanding).toBe(2000);
    expect(l).toHaveLength(5);
    expect(meetingTotals(l, 'm1')).toMatchObject({ savings: 100, repayments: 0 });
  });
});
