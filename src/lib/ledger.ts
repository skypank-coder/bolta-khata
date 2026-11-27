/**
 * Append-only, hash-chained group ledger ("bahi-khata" that cannot be quietly edited).
 *
 * Every entry stores the SHA-256 of the entry before it. Changing any old amount,
 * name or date breaks the chain from that point on, and the app shows it in red.
 * Mistakes are never edited: a "reversal" entry cancels the wrong one, so the
 * whole group can still hear what happened.
 */

export type EntryType =
  | 'opening'      // opening balance carried over from the paper register
  | 'savings'      // bachat: member deposits savings
  | 'repayment'    // kist: member repays loan
  | 'loan'         // group gives a loan to a member
  | 'reversal'     // cancels an earlier entry
  | 'meeting_open'
  | 'meeting_close'
  | 'attendance'
  | 'cash_count'
  | 'member_join';  // a new member joined the group (note = her name)   // leader counted the cash box: amount = counted, note = what the khata expected

export interface EntryDraft {
  type: EntryType;
  memberId: string | null;
  amount: number;
  meetingId: string | null;
  /** For reversal: id of the entry being cancelled. */
  reverses?: string;
  /** Exactly what was heard, kept as evidence. */
  spoken?: string;
  note?: string;
}

export interface LedgerEntry extends EntryDraft {
  id: string;
  seq: number;
  ts: string; // ISO time
  prevHash: string;
  hash: string;
}

export const GENESIS = '0'.repeat(64);

/** Stable field order so the same entry always hashes the same way. */
function canonical(e: Omit<LedgerEntry, 'hash'>): string {
  return JSON.stringify([
    e.id, e.seq, e.ts, e.type, e.memberId, e.amount, e.meetingId, e.reverses ?? null,
    e.spoken ?? null, e.note ?? null, e.prevHash,
  ]);
}

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newId(prefix = 'e'): string {
  const rand = globalThis.crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now().toString(36)}${rand[0].toString(36)}${rand[1].toString(36).slice(0, 4)}`;
}

export async function appendEntries(
  ledger: LedgerEntry[],
  drafts: EntryDraft[],
  now: () => Date = () => new Date(),
): Promise<LedgerEntry[]> {
  const out = [...ledger];
  for (const d of drafts) {
    const prev = out[out.length - 1];
    const base = {
      ...d,
      id: newId(),
      seq: prev ? prev.seq + 1 : 1,
      ts: now().toISOString(),
      prevHash: prev ? prev.hash : GENESIS,
    };
    out.push({ ...base, hash: await sha256(canonical(base)) });
  }
  return out;
}

export interface ChainReport {
  ok: boolean;
  /** Index of the first entry whose stored hash no longer matches its content. */
  brokenAt: number | null;
  checked: number;
}

export async function verifyChain(ledger: LedgerEntry[]): Promise<ChainReport> {
  let prevHash = GENESIS;
  for (let i = 0; i < ledger.length; i++) {
    const { hash, ...rest } = ledger[i];
    if (rest.prevHash !== prevHash || (await sha256(canonical(rest))) !== hash) {
      return { ok: false, brokenAt: i, checked: ledger.length };
    }
    prevHash = hash;
  }
  return { ok: true, brokenAt: null, checked: ledger.length };
}

/** Ids of entries cancelled by a later reversal. */
export function reversedIds(ledger: LedgerEntry[]): Set<string> {
  return new Set(ledger.filter((e) => e.type === 'reversal' && e.reverses).map((e) => e.reverses!));
}

export interface MemberBalance {
  savings: number;
  loanOutstanding: number;
  repaidTotal: number;
  borrowedTotal: number;
}

export interface Balances {
  members: Record<string, MemberBalance>;
  /** Cash the group should physically hold (savings + repayments - loans given). */
  groupCash: number;
  totalSavings: number;
  totalOutstanding: number;
}

const empty = (): MemberBalance => ({ savings: 0, loanOutstanding: 0, repaidTotal: 0, borrowedTotal: 0 });

export function computeBalances(ledger: LedgerEntry[], upToSeq = Infinity): Balances {
  const reversed = reversedIds(ledger.filter((e) => e.seq <= upToSeq));
  const members: Record<string, MemberBalance> = {};
  let groupCash = 0;

  for (const e of ledger) {
    if (e.seq > upToSeq || reversed.has(e.id)) continue;
    const m = e.memberId ? (members[e.memberId] ??= empty()) : null;
    switch (e.type) {
      case 'opening':
        groupCash += e.amount;
        break;
      case 'savings':
        if (m) m.savings += e.amount;
        groupCash += e.amount;
        break;
      case 'repayment':
        if (m) { m.loanOutstanding -= e.amount; m.repaidTotal += e.amount; }
        groupCash += e.amount;
        break;
      case 'loan':
        if (m) { m.loanOutstanding += e.amount; m.borrowedTotal += e.amount; }
        groupCash -= e.amount;
        break;
      default:
        break;
    }
  }

  const all = Object.values(members);
  return {
    members,
    groupCash,
    totalSavings: all.reduce((s, m) => s + m.savings, 0),
    totalOutstanding: all.reduce((s, m) => s + m.loanOutstanding, 0),
  };
}

export function memberBalance(b: Balances, id: string): MemberBalance {
  return b.members[id] ?? empty();
}

export interface MeetingTotals {
  savings: number;
  repayments: number;
  loans: number;
  entries: LedgerEntry[];
  present: string[];
}

/** What happened in one meeting, ignoring reversed entries. */
export function meetingTotals(ledger: LedgerEntry[], meetingId: string): MeetingTotals {
  const reversed = reversedIds(ledger);
  const entries = ledger.filter((e) => e.meetingId === meetingId);
  const live = entries.filter((e) => !reversed.has(e.id));
  const sum = (t: EntryType) => live.filter((e) => e.type === t).reduce((s, e) => s + e.amount, 0);
  return {
    savings: sum('savings'),
    repayments: sum('repayment'),
    loans: sum('loan'),
    entries,
    present: [...new Set(live.filter((e) => e.type === 'attendance' && e.memberId).map((e) => e.memberId!))],
  };
}
