import { describe, expect, it } from 'vitest';
import { nextHint, milestoneOf } from '../coach';
import { appendEntries, type LedgerEntry } from '../ledger';
import { initialState, step, type MeetingState } from '../meeting';
import { DEMO_SCRIPT } from '../phrases';
import { buildDemoData, type Lang } from '../store';

const STUCK = new Set(['notUnderstood', 'confirmWaiting', 'loanWaiting', 'notStarted', 'notHeard']);

/**
 * The coach must never suggest words the app will not understand.
 * Walk real meetings; at every state, try every suggested phrase.
 */
describe('coach hints always work', () => {
  for (const lang of ['hi', 'mr', 'en'] as Lang[]) {
    it(`${lang}: every suggested phrase is understood in the state it is suggested`, async () => {
      const data = await buildDemoData(lang);
      const members = [...data.group.members];
      let ledger: LedgerEntry[] = data.ledger;
      let state: MeetingState = initialState;
      const extra: Record<Lang, string[]> = {
        hi: ['फ़रीदा 500', 'कमला की किस्त', '300 बचत', 'नया सदस्य जोड़ो'],
        mr: ['फरीदा 500', 'कमला हप्ता', '300 बचत', 'नवीन सदस्य'],
        en: ['Farida 500', 'Kamla repayment', '300 savings', 'add member'],
      };
      const lines = [...DEMO_SCRIPT[lang].slice(0, 7), ...extra[lang], ...DEMO_SCRIPT[lang].slice(7)];
      const failures: string[] = [];
      const seen = new Set<string>();
      for (const line of [...lines, '']) {
        const hint = nextHint(state, members, lang);
        expect(hint.lead.length).toBeGreaterThan(5);
        for (const phrase of hint.say) {
          const r = step(state, { text: phrase }, { members, ledger });
          if (STUCK.has(r.reply.key)) failures.push(`${state.phase}/${state.pending?.kind ?? '-'}: "${phrase}" -> ${r.reply.key}`);
        }
        if (!line) break;
        // Side questions have now had their hints checked; leave them so the demo script can carry on.
        if (state.pending && ['needType', 'needAmount', 'needMember', 'needNewName'].includes(state.pending.kind)) {
          state = { ...state, pending: null };
        }
        const r = step(state, { text: line }, { members, ledger });
        if (r.newMember) members.push(r.newMember);
        state = r.state;
        ledger = await appendEntries(ledger, r.drafts);
        seen.add(state.pending?.kind ?? state.phase);
      }
      expect(failures).toEqual([]);
      // The walk really visited the tricky states.
      for (const k of ['attendance', 'confirm', 'approveLoan', 'confirmClose', 'needType', 'needAmount', 'needMember', 'needNewName', 'pickMember']) {
        expect(seen, k).toContain(k);
      }
    });
  }

  it('a group with no members is told to add one', () => {
    expect(nextHint(initialState, [], 'hi').say[0]).toContain('नया सदस्य');
  });

  it('turns replies into learning milestones', () => {
    expect(milestoneOf({ key: 'started' })).toBe('started');
    expect(milestoneOf({ key: 'saved', drafts: [] })).toBe('saved');
    expect(milestoneOf({ key: 'help' })).toBeNull();
  });
});
