import { extractNewName, parseIntent, romanName, type EntryIntent, type Intent, type MoneyType } from './intent';
import { hasDevanagari } from './translit';
import {
  computeBalances, memberBalance, meetingTotals, newId, reversedIds,
  type EntryDraft, type LedgerEntry,
} from './ledger';
import { matchMember, type MatchResult } from './phonetic';
import { tokenize } from './numbers';
import type { Member } from './store';

/**
 * The meeting as a conversation. A pure state machine:
 *   (state, what was heard, ledger) -> (new state, what to say, what to write)
 * No timers, no audio, no storage in here, so every path is unit-tested.
 */

export type Phase = 'idle' | 'attendance' | 'entries' | 'closed';

export interface Draft {
  type: MoneyType;
  memberId: string;
  amount: number;
}

type Continuation =
  | { purpose: 'attendance' }
  | { purpose: 'entry'; entry: EntryIntent }
  | { purpose: 'query' };

export type Pending =
  | { kind: 'confirm'; drafts: Draft[]; loanAfter?: Draft; doubleCheck: boolean; stage: 1 | 2; spoken: string }
  | { kind: 'approveLoan'; draft: Draft; spoken: string }
  | { kind: 'needMember'; entry: EntryIntent }
  | { kind: 'needAmount'; memberId: string; type: MoneyType }
  | { kind: 'needType'; memberId: string; amount: number }
  | { kind: 'pickMember'; options: [string, string]; then: Continuation }
  | { kind: 'confirmClose' }
  | { kind: 'confirmNewMember'; member: Member; spoken: string }
  | { kind: 'needNewName' };

export interface MeetingState {
  phase: Phase;
  meetingId: string | null;
  lastSpeaker: string | null;
  pending: Pending | null;
  misses: number;
  lastReply: Reply | null;
}

/** What the app should say, as a phrase key + values. Rendered per language in phrases.ts. */
export type Reply =
  | { key: 'started' }
  | { key: 'notStarted' }
  | { key: 'present'; member: string }
  | { key: 'alreadyPresent'; member: string }
  | { key: 'attendanceDone'; presentCount: number; absent: string[] }
  | { key: 'readback'; drafts: Draft[]; after: Record<string, number>; warn?: 'large' | 'overpay'; stage: 1 | 2; loanAfter?: Draft }
  | { key: 'saved'; drafts: Draft[] }
  | { key: 'rejected' }
  | { key: 'loanAsk'; draft: Draft; cash: number }
  | { key: 'loanNoCash'; draft: Draft; cash: number }
  | { key: 'loanSaved'; draft: Draft }
  | { key: 'loanWaiting' }
  | { key: 'noLoanToRepay'; member: string }
  | { key: 'needMember' }
  | { key: 'pick'; options: [string, string] }
  | { key: 'needAmount'; member: string; type: MoneyType }
  | { key: 'needType'; member: string; amount: number }
  | { key: 'askEntry'; member: string }
  | { key: 'selfBalance'; member: string; savings: number; loan: number }
  | { key: 'groupBalance'; cash: number; savings: number; outstanding: number }
  | { key: 'undone'; entry: { type: MoneyType; memberId: string; amount: number } }
  | { key: 'nothingToUndo' }
  | { key: 'summary'; presentCount: number; savings: number; repayments: number; loans: number; cash: number; notPaid: string[] }
  | { key: 'closed' }
  | { key: 'stillOpen' }
  | { key: 'confirmWaiting' }
  | { key: 'notHeard'; repeated: boolean }
  | { key: 'notUnderstood' }
  | { key: 'help' }
  | { key: 'alreadyClosed' }
  | { key: 'cashCount'; counted: number; expected: number }
  | { key: 'addMemberAsk'; name: string }
  | { key: 'memberAdded'; name: string; count: number }
  | { key: 'memberExists'; member: string }
  | { key: 'needNewName' }
  | { key: 'noMembers' };

export interface StepResult {
  state: MeetingState;
  reply: Reply;
  drafts: EntryDraft[];
  /** A member the group just added by voice. */
  newMember?: Member;
}

export interface Heard {
  text: string;
  /** Other things the recogniser thought it heard, best first. */
  alternatives?: string[];
  confidence?: number;
}

export interface Ctx {
  members: Member[];
  ledger: LedgerEntry[];
}

/** Single amounts above this are read back twice. */
export const LARGE_AMOUNT = 10000;
const LOW_CONFIDENCE = 0.45;

export const initialState: MeetingState = {
  phase: 'idle', meetingId: null, lastSpeaker: null, pending: null, misses: 0, lastReply: null,
};

/** Rebuild a state for a meeting that was open when the app was closed. */
export function resumeState(ledger: LedgerEntry[]): MeetingState {
  const lastOpen = [...ledger].reverse().find((e) => e.type === 'meeting_open' || e.type === 'meeting_close');
  if (!lastOpen || lastOpen.type === 'meeting_close') return initialState;
  const hasMoney = ledger.some((e) => e.meetingId === lastOpen.meetingId && ['savings', 'repayment', 'loan'].includes(e.type));
  return { ...initialState, phase: hasMoney ? 'entries' : 'attendance', meetingId: lastOpen.meetingId };
}

function presentIds(ledger: LedgerEntry[], meetingId: string | null): Set<string> {
  if (!meetingId) return new Set();
  return new Set(meetingTotals(ledger, meetingId).present);
}

function reply(state: MeetingState, r: Reply, drafts: EntryDraft[] = []): StepResult {
  return { state: { ...state, lastReply: r }, reply: r, drafts };
}

function resolveMember(m: MatchResult, selfRef: boolean, state: MeetingState): { id?: string; ambiguous?: [string, string] } {
  if (m.best) return { id: m.best.memberId };
  if (m.ambiguous) return { ambiguous: [m.ambiguous[0].memberId, m.ambiguous[1].memberId] };
  if (selfRef && state.lastSpeaker) return { id: state.lastSpeaker };
  return {};
}

function attendanceDraft(meetingId: string, memberId: string, spoken: string): EntryDraft {
  return { type: 'attendance', memberId, amount: 0, meetingId, spoken };
}

function markPresent(state: MeetingState, ctx: Ctx, memberId: string, spoken: string): StepResult {
  const present = presentIds(ctx.ledger, state.meetingId);
  const next = { ...state, lastSpeaker: memberId, pending: null, misses: 0 };
  if (present.has(memberId)) return reply(next, { key: 'alreadyPresent', member: memberId });
  return reply(next, { key: 'present', member: memberId }, [attendanceDraft(state.meetingId!, memberId, spoken)]);
}

/** Turn an entry into drafts, or into the one question we still need answered. */
function handleEntry(state: MeetingState, ctx: Ctx, entry: EntryIntent, spoken: string): StepResult {
  const who = resolveMember(entry.member, entry.selfRef, state);
  if (who.ambiguous) {
    return reply({ ...state, pending: { kind: 'pickMember', options: who.ambiguous, then: { purpose: 'entry', entry } } },
      { key: 'pick', options: who.ambiguous });
  }
  if (!who.id) return reply({ ...state, pending: { kind: 'needMember', entry } }, { key: 'needMember' });
  const memberId = who.id;
  const base = { ...state, lastSpeaker: memberId, misses: 0 };

  if (!entry.items.length) {
    if (entry.unassigned.length === 1) {
      return reply({ ...base, pending: { kind: 'needType', memberId, amount: entry.unassigned[0] } },
        { key: 'needType', member: memberId, amount: entry.unassigned[0] });
    }
    if (entry.missingAmount.length) {
      const type = entry.missingAmount[0];
      return reply({ ...base, pending: { kind: 'needAmount', memberId, type } }, { key: 'needAmount', member: memberId, type });
    }
    return reply({ ...base, pending: null }, { key: 'askEntry', member: memberId });
  }

  const balances = computeBalances(ctx.ledger);
  const bal = memberBalance(balances, memberId);
  const drafts: Draft[] = entry.items.filter((i) => i.type !== 'loan').map((i) => ({ type: i.type, memberId, amount: i.amount }));
  const loanItem = entry.items.find((i) => i.type === 'loan');
  const loan: Draft | undefined = loanItem && { type: 'loan', memberId, amount: loanItem.amount };

  const repay = drafts.filter((d) => d.type === 'repayment').reduce((s, d) => s + d.amount, 0);
  if (repay > 0 && bal.loanOutstanding <= 0) {
    return reply({ ...base, pending: null }, { key: 'noLoanToRepay', member: memberId });
  }

  if (!drafts.length && loan) return askLoan(base, ctx, loan, spoken);

  // Paying more than the loan left: the loan is closed and the extra goes into her savings,
  // which is what the group does on paper. A loan can never go below zero.
  const overpay = repay > bal.loanOutstanding;
  let final = drafts;
  if (overpay) {
    const extra = repay - bal.loanOutstanding;
    const savings = drafts.filter((d) => d.type === 'savings').reduce((s, d) => s + d.amount, 0) + extra;
    final = [{ type: 'repayment', memberId, amount: bal.loanOutstanding }, { type: 'savings', memberId, amount: savings }];
  }
  const large = final.some((d) => d.amount > LARGE_AMOUNT);
  const after = { [memberId]: Math.max(0, bal.loanOutstanding - repay) };
  return reply(
    { ...base, pending: { kind: 'confirm', drafts: final, loanAfter: loan, doubleCheck: large, stage: 1, spoken } },
    { key: 'readback', drafts: final, after, warn: overpay ? 'overpay' : large ? 'large' : undefined, stage: 1, loanAfter: loan },
  );
}

function askLoan(state: MeetingState, ctx: Ctx, draft: Draft, spoken: string): StepResult {
  const cash = computeBalances(ctx.ledger).groupCash;
  if (draft.amount > cash) return reply({ ...state, pending: null }, { key: 'loanNoCash', draft, cash });
  return reply({ ...state, pending: { kind: 'approveLoan', draft, spoken } }, { key: 'loanAsk', draft, cash });
}

function moneyDraft(d: Draft, meetingId: string, spoken: string): EntryDraft {
  return { type: d.type, memberId: d.memberId, amount: d.amount, meetingId, spoken };
}

/** Commit confirmed drafts, marking the member present if she was not called in attendance. */
function commit(state: MeetingState, ctx: Ctx, drafts: Draft[], spoken: string): EntryDraft[] {
  const present = presentIds(ctx.ledger, state.meetingId);
  const out: EntryDraft[] = [];
  for (const id of new Set(drafts.map((d) => d.memberId))) {
    if (!present.has(id)) out.push(attendanceDraft(state.meetingId!, id, spoken));
  }
  return [...out, ...drafts.map((d) => moneyDraft(d, state.meetingId!, spoken))];
}

function lastLiveMoneyEntry(ctx: Ctx, meetingId: string | null): LedgerEntry | undefined {
  const reversed = reversedIds(ctx.ledger);
  return [...ctx.ledger].reverse().find(
    (e) => e.meetingId === meetingId && ['savings', 'repayment', 'loan'].includes(e.type) && !reversed.has(e.id),
  );
}

function summary(state: MeetingState, ctx: Ctx): Reply {
  const t = meetingTotals(ctx.ledger, state.meetingId!);
  const paid = new Set(t.entries.filter((e) => e.type === 'savings' || e.type === 'repayment').map((e) => e.memberId));
  return {
    key: 'summary',
    presentCount: t.present.length,
    savings: t.savings,
    repayments: t.repayments,
    loans: t.loans,
    cash: computeBalances(ctx.ledger).groupCash,
    notPaid: t.present.filter((id) => !paid.has(id)),
  };
}

function balanceQuery(state: MeetingState, ctx: Ctx, m: MatchResult, selfRef: boolean): StepResult {
  const who = resolveMember(m, selfRef, state);
  if (who.ambiguous) {
    return reply({ ...state, pending: { kind: 'pickMember', options: who.ambiguous, then: { purpose: 'query' } } },
      { key: 'pick', options: who.ambiguous });
  }
  if (!who.id) return reply({ ...state, pending: { kind: 'needMember', entry: emptyEntry() } }, { key: 'needMember' });
  const b = memberBalance(computeBalances(ctx.ledger), who.id);
  return reply({ ...state, lastSpeaker: who.id, misses: 0 },
    { key: 'selfBalance', member: who.id, savings: b.savings, loan: b.loanOutstanding });
}

function emptyEntry(): EntryIntent {
  return { kind: 'entry', member: { best: null, ambiguous: null }, selfRef: false, items: [], unassigned: [], missingAmount: [] };
}

/** Pick the best of the recogniser's guesses: the first one we can make sense of. */
function bestIntent(heard: Heard, members: Member[]): Intent {
  const options = [heard.text, ...(heard.alternatives ?? [])].filter((t) => t && t.trim());
  let fallback: Intent = { kind: 'unknown' };
  for (const [i, text] of options.entries()) {
    const intent = parseIntent(text, members);
    if (i === 0) fallback = intent;
    if (intent.kind !== 'unknown') return intent;
  }
  return fallback;
}

export function step(state: MeetingState, heard: Heard, ctx: Ctx): StepResult {
  const text = heard.text?.trim() ?? '';
  if (!text || (heard.confidence !== undefined && heard.confidence > 0 && heard.confidence < LOW_CONFIDENCE)) {
    const misses = state.misses + 1;
    return reply({ ...state, misses }, { key: 'notHeard', repeated: misses >= 2 });
  }

  const intent = bestIntent(heard, ctx.members);
  const s: MeetingState = { ...state, misses: 0 };

  // Things that work at any time.
  if (intent.kind === 'help') return reply(s, { key: 'help' });
  if (intent.kind === 'repeat' && state.lastReply) return { state: s, reply: state.lastReply, drafts: [] };
  if (intent.kind === 'queryGroup') {
    const b = computeBalances(ctx.ledger);
    return reply(s, { key: 'groupBalance', cash: b.groupCash, savings: b.totalSavings, outstanding: b.totalOutstanding });
  }
  if (intent.kind === 'querySelf') {
    if (!s.pending) return balanceQuery(s, ctx, intent.member, intent.selfRef);
    // A question in the middle of a confirmation is answered, and the confirmation still waits.
    const who = resolveMember(intent.member, intent.selfRef, s);
    if (who.id) {
      const b = memberBalance(computeBalances(ctx.ledger), who.id);
      return reply(s, { key: 'selfBalance', member: who.id, savings: b.savings, loan: b.loanOutstanding });
    }
  }

  // Adding a member works at any time, even before the first meeting.
  if (s.pending?.kind === 'confirmNewMember') {
    const p = s.pending;
    if (intent.kind === 'confirm' || intent.kind === 'approve') {
      const count = ctx.members.length + 1;
      return {
        ...reply({ ...s, pending: null }, { key: 'memberAdded', name: p.member.nameLocal ?? p.member.name, count }, [{
          type: 'member_join', memberId: p.member.id, amount: 0, meetingId: s.meetingId, spoken: p.spoken, note: p.member.name,
        }]),
        newMember: p.member,
      };
    }
    if (intent.kind === 'reject') return reply({ ...s, pending: null }, { key: 'rejected' });
    if (intent.kind !== 'addMember') return reply(s, { key: 'confirmWaiting' });
  }
  if (s.pending?.kind === 'needNewName' || intent.kind === 'addMember') {
    const name = intent.kind === 'addMember' ? intent.name : extractNewName(text);
    if (!name) return reply({ ...s, pending: { kind: 'needNewName' } }, { key: 'needNewName' });
    const same = ctx.members.find((m) => [m.name, m.nameLocal].some((n) => n && n.toLowerCase() === name.toLowerCase()));
    if (same) return reply({ ...s, pending: null }, { key: 'memberExists', member: same.id });
    const local = hasDevanagari(name) ? name : undefined;
    const member: Member = { id: newId('m'), name: romanName(name), nameLocal: local, role: ctx.members.length ? 'member' : 'leader' };
    return reply({ ...s, pending: { kind: 'confirmNewMember', member, spoken: text } }, { key: 'addMemberAsk', name });
  }

  if (s.phase === 'idle' || s.phase === 'closed') {
    if (intent.kind === 'start' && ctx.members.length === 0) return reply(s, { key: 'noMembers' });
    if (intent.kind === 'start') {
      const meetingId = newId('mtg');
      return reply({ ...initialState, phase: 'attendance', meetingId },
        { key: 'started' }, [{ type: 'meeting_open', memberId: null, amount: 0, meetingId, spoken: text }]);
    }
    return reply(s, { key: s.phase === 'closed' ? 'alreadyClosed' : 'notStarted' });
  }

  if (intent.kind === 'start') return reply(s, { key: 'stillOpen' });

  // Counting the cash box: compare with what the khata says, and lock the count into the chain.
  if (intent.kind === 'cashCount') {
    const expected = computeBalances(ctx.ledger).groupCash;
    return reply(s, { key: 'cashCount', counted: intent.amount, expected }, [{
      type: 'cash_count', memberId: null, amount: intent.amount, meetingId: s.meetingId, spoken: text, note: String(expected),
    }]);
  }

  // Answer the question we are waiting on first.
  const p = s.pending;
  if (p) {
    switch (p.kind) {
      case 'confirm': {
        if (intent.kind === 'confirm' || intent.kind === 'approve') {
          if (p.doubleCheck && p.stage === 1) {
            const b = memberBalance(computeBalances(ctx.ledger), p.drafts[0].memberId);
            const repay = p.drafts.filter((d) => d.type === 'repayment').reduce((t, d) => t + d.amount, 0);
            return reply({ ...s, pending: { ...p, stage: 2 } }, {
              key: 'readback', drafts: p.drafts, after: { [p.drafts[0].memberId]: Math.max(0, b.loanOutstanding - repay) },
              warn: 'large', stage: 2, loanAfter: p.loanAfter,
            });
          }
          const drafts = commit(s, ctx, p.drafts, p.spoken);
          if (p.loanAfter) {
            const next = askLoan({ ...s, pending: null }, ctx, p.loanAfter, p.spoken);
            return { ...next, drafts: [...drafts, ...next.drafts] };
          }
          return reply({ ...s, pending: null }, { key: 'saved', drafts: p.drafts }, drafts);
        }
        if (intent.kind === 'reject') {
          if (intent.correction) return handleEntry({ ...s, pending: null }, ctx, intent.correction, text);
          return reply({ ...s, pending: null }, { key: 'rejected' });
        }
        if (intent.kind === 'entry') return handleEntry({ ...s, pending: null }, ctx, intent, text);
        return reply(s, { key: 'confirmWaiting' });
      }
      case 'approveLoan': {
        if (intent.kind === 'approve') {
          const cash = computeBalances(ctx.ledger).groupCash;
          if (p.draft.amount > cash) return reply({ ...s, pending: null }, { key: 'loanNoCash', draft: p.draft, cash });
          return reply({ ...s, pending: null }, { key: 'loanSaved', draft: p.draft }, commit(s, ctx, [p.draft], p.spoken));
        }
        if (intent.kind === 'reject') return reply({ ...s, pending: null }, { key: 'rejected' });
        // Someone moved on to a new entry: an unapproved loan simply lapses (no money moved).
        if (!['entry', 'name', 'end', 'undo', 'attendanceDone'].includes(intent.kind)) return reply(s, { key: 'loanWaiting' });
        break;
      }
      case 'pickMember': {
        // Only compare against the two names we asked about ("Kumari" or "Yadav").
        const options = ctx.members.filter((m) => p.options.includes(m.id));
        const pick = matchMember(tokenize(text), options);
        const chosen = pick.best?.memberId;
        if (!chosen) {
          if (intent.kind === 'reject') return reply({ ...s, pending: null }, { key: 'rejected' });
          return reply(s, { key: 'pick', options: p.options });
        }
        const resolved: MatchResult = { best: { memberId: chosen, score: 1, exact: true, start: 0, end: 0 }, ambiguous: null };
        const cleared = { ...s, pending: null, lastSpeaker: chosen };
        if (p.then.purpose === 'attendance') return markPresent(cleared, ctx, chosen, text);
        if (p.then.purpose === 'query') return balanceQuery(cleared, ctx, resolved, false);
        return handleEntry(cleared, ctx, { ...p.then.entry, member: resolved }, text);
      }
      case 'needMember': {
        if (intent.kind === 'name' || intent.kind === 'entry' || intent.kind === 'querySelf') {
          const member = intent.member;
          if (!member.best && !member.ambiguous) return reply(s, { key: 'needMember' });
          const isQuery = p.entry.items.length === 0 && p.entry.unassigned.length === 0 && p.entry.missingAmount.length === 0;
          if (isQuery && intent.kind !== 'entry') return balanceQuery({ ...s, pending: null }, ctx, member, false);
          const merged: EntryIntent = intent.kind === 'entry' && intent.items.length ? intent : { ...p.entry, member };
          return handleEntry({ ...s, pending: null }, ctx, merged, text);
        }
        if (intent.kind === 'reject') return reply({ ...s, pending: null }, { key: 'rejected' });
        return reply(s, { key: 'needMember' });
      }
      case 'needAmount': {
        const amount = intent.kind === 'amountOnly' ? intent.amount
          : intent.kind === 'entry' ? (intent.items[0]?.amount ?? intent.unassigned[0]) : undefined;
        if (amount) {
          return handleEntry({ ...s, pending: null }, ctx, {
            ...emptyEntry(), member: { best: { memberId: p.memberId, score: 1, exact: true, start: 0, end: 0 }, ambiguous: null },
            items: [{ type: p.type, amount }],
          }, text);
        }
        if (intent.kind === 'reject') return reply({ ...s, pending: null }, { key: 'rejected' });
        return reply(s, { key: 'needAmount', member: p.memberId, type: p.type });
      }
      case 'needType': {
        const type = intent.kind === 'entry' ? (intent.items[0]?.type ?? intent.missingAmount[0]) : undefined;
        if (type) {
          return handleEntry({ ...s, pending: null }, ctx, {
            ...emptyEntry(), member: { best: { memberId: p.memberId, score: 1, exact: true, start: 0, end: 0 }, ambiguous: null },
            items: [{ type, amount: p.amount }],
          }, text);
        }
        if (intent.kind === 'reject') return reply({ ...s, pending: null }, { key: 'rejected' });
        return reply(s, { key: 'needType', member: p.memberId, amount: p.amount });
      }
      case 'confirmClose': {
        if (intent.kind === 'confirm' || intent.kind === 'approve') {
          return reply({ ...s, phase: 'closed', pending: null }, { key: 'closed' },
            [{ type: 'meeting_close', memberId: null, amount: 0, meetingId: s.meetingId, spoken: text }]);
        }
        if (intent.kind === 'reject') return reply({ ...s, pending: null }, { key: 'stillOpen' });
        break; // anything else: carry on with the meeting
      }
    }
  }

  const free = { ...s, pending: null };
  switch (intent.kind) {
    case 'attendanceDone': {
      const present = presentIds(ctx.ledger, s.meetingId);
      return reply({ ...free, phase: 'entries' }, {
        key: 'attendanceDone', presentCount: present.size,
        absent: ctx.members.filter((m) => !present.has(m.id)).map((m) => m.id),
      });
    }
    case 'name': {
      const who = resolveMember(intent.member, false, s);
      if (who.ambiguous) {
        return reply({ ...free, pending: { kind: 'pickMember', options: who.ambiguous, then: { purpose: 'attendance' } } },
          { key: 'pick', options: who.ambiguous });
      }
      if (!who.id) return reply(free, { key: 'notUnderstood' });
      const present = presentIds(ctx.ledger, s.meetingId);
      if (s.phase === 'attendance' || !present.has(who.id)) return markPresent(free, ctx, who.id, text);
      return reply({ ...free, lastSpeaker: who.id }, { key: 'askEntry', member: who.id });
    }
    case 'entry': {
      const next = handleEntry({ ...free, phase: 'entries' }, ctx, intent, text);
      return next;
    }
    case 'reject':
      if (intent.correction) return handleEntry({ ...free, phase: 'entries' }, ctx, intent.correction, text);
      return reply(free, { key: 'rejected' });
    case 'undo': {
      const last = lastLiveMoneyEntry(ctx, s.meetingId);
      if (!last || !last.memberId) return reply(free, { key: 'nothingToUndo' });
      return reply(free, { key: 'undone', entry: { type: last.type as MoneyType, memberId: last.memberId, amount: last.amount } }, [{
        type: 'reversal', memberId: last.memberId, amount: last.amount, meetingId: s.meetingId, reverses: last.id, spoken: text,
      }]);
    }
    case 'end':
      return reply({ ...free, pending: { kind: 'confirmClose' } }, summary(s, ctx));
    case 'querySelf':
      return balanceQuery(free, ctx, intent.member, intent.selfRef);
    case 'amountOnly':
      if (s.lastSpeaker) {
        return reply({ ...free, pending: { kind: 'needType', memberId: s.lastSpeaker, amount: intent.amount } },
          { key: 'needType', member: s.lastSpeaker, amount: intent.amount });
      }
      return reply({ ...free, pending: { kind: 'needMember', entry: { ...emptyEntry(), unassigned: [intent.amount] } } }, { key: 'needMember' });
    default:
      return reply(free, { key: 'notUnderstood' });
  }
}
