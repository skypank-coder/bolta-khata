import { describe, expect, it } from 'vitest';
import { appendEntries, computeBalances, verifyChain, type LedgerEntry } from '../ledger';
import { initialState, step, type MeetingState } from '../meeting';
import { parseAmount } from '../numbers';
import { buildDemoData, DEMO_GROUP } from '../store';

/** Small seeded RNG so a failing run can be replayed exactly. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNITS = ['', 'ek', 'do', 'teen', 'chaar', 'paanch', 'chhah', 'saat', 'aath', 'nau', 'das', 'gyarah', 'barah', 'terah',
  'chaudah', 'pandrah', 'solah', 'satrah', 'atharah', 'unnis', 'bees', 'ikkis', 'baais', 'teis', 'chaubis', 'pachchis',
  'chhabbis', 'sattais', 'atthais', 'unatis', 'tees', 'iktis', 'battis', 'taintis', 'chautis', 'paintis', 'chhattis',
  'saintis', 'adtis', 'untalis', 'chalis', 'iktalis', 'bayalis', 'taintalis', 'chauvalis', 'paintalis', 'chhiyalis',
  'saintalis', 'adtalis', 'unchas', 'pachas', 'ikyavan', 'bavan', 'tirpan', 'chauvan', 'pachpan', 'chhappan', 'sattavan',
  'atthavan', 'unsath', 'saath', 'iksath', 'basath', 'tirsath', 'chausath', 'painsath', 'chhiyasath', 'sadsath', 'adsath',
  'unhattar', 'sattar', 'ikhattar', 'bahattar', 'tihattar', 'chauhattar', 'pachhattar', 'chhihattar', 'satattar',
  'athattar', 'unasi', 'assi', 'ikyasi', 'bayasi', 'tirasi', 'chaurasi', 'pachasi', 'chhiyasi', 'sattasi', 'athasi',
  'navasi', 'nabbe', 'ikyanve', 'banve', 'tiranve', 'chauranve', 'pachanve', 'chhiyanve', 'sattanve', 'attanve', 'ninyanve'];

/** How a person would say n in Hindi. Units below 10 are only spoken at the start. */
function hindiWords(n: number): string {
  const parts: string[] = [];
  const lakh = Math.floor(n / 100000);
  const hazaar = Math.floor((n % 100000) / 1000);
  const sau = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (lakh) parts.push(UNITS[lakh], 'lakh');
  if (hazaar) parts.push(UNITS[hazaar], 'hazaar');
  if (sau) parts.push(UNITS[sau], 'sau');
  if (rest) parts.push(UNITS[rest]);
  return parts.join(' ');
}

describe('stress: every spoken amount from 10 to 99,999 round-trips', () => {
  it('Hindi words, in a sentence with rupaye', () => {
    const failures: string[] = [];
    for (let n = 10; n < 100000; n++) {
      // "do hazaar paanch" (2005) is not how money is said, and reads as "give 2000"; skip such forms.
      if (n >= 100 && n % 100 > 0 && n % 100 < 10) continue;
      const text = `Meena ${hindiWords(n)} rupaye bachat`;
      const got = parseAmount(text);
      if (got !== n) failures.push(`${text} -> ${got}`);
      if (failures.length > 10) break;
    }
    expect(failures).toEqual([]);
  });

  it('digits with Indian commas, ₹ and rs', () => {
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const n = Math.floor(r() * 9_99_999) + 1;
      const indian = n.toLocaleString('en-IN');
      expect(parseAmount(`₹${indian}`)).toBe(n);
      expect(parseAmount(`${indian} rs`)).toBe(n);
      expect(parseAmount(`kist ${n}`)).toBe(n);
    }
  });

  it.each([
    ['डेढ़ सौ', 150], ['ढाई हज़ार', 2500], ['साढ़े तीन हज़ार', 3500], ['पौने दो हज़ार', 1750], ['सवा सौ', 125],
    ['सवा दो हज़ार', 2250], ['साढ़े पाँच सौ', 550], ['पच्चीस हज़ार', 25000], ['पचहत्तर', 75], ['सोलह सौ', 1600],
    ['उन्नीस सौ', 1900], ['पैंतीस सौ रुपये', 3500], ['बारह सौ पचास', 1250], ['एक लाख', 100000], ['सात सौ', 700],
    ['चालीस', 40], ['नब्बे', 90], ['अस्सी रुपये', 80], ['छह सौ', 600], ['तीन हज़ार दो सौ', 3200],
  ])('Devanagari: %s = %i', (text, value) => {
    expect(parseAmount(text as string)).toBe(value);
  });
});

/** A random speaker at a real meeting: Hinglish, Devanagari, mistakes, noise, silence. */
function utterance(r: () => number): string {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const m = pick(DEMO_GROUP.members);
  const first = m.name.split(' ')[0];
  const local = (m.nameLocal ?? m.name).split(' ')[0];
  const amt = pick([50, 100, 200, 250, 500, 1000, 1500, 2000, 2500, 5000, 12000, 30000]);
  const words = hindiWords(amt);
  return pick([
    `${first} ${amt} bachat`, `main ${first}, ${words} rupaye bachat`, `${local} की किस्त ${amt}`,
    `${first} ki kist ${words}`, `${first} ko ${amt} loan`, `${local} को ${amt} लोन`, `${first} ${amt}`,
    `${first} ki bachat`, `${first}`, `${local} हाज़िर`, 'sahi hai', 'हाँ सही है', 'galat hai', 'nahi', 'manzoor',
    'मंज़ूर', 'pichli entry hatao', 'mera kitna jama hai', 'group ke paas kitna paisa hai', 'haazri poori',
    'uh hmm', 'xyz qwerty', '', '500', 'bachat', 'kist', 'Sunita 100 bachat', 'Yadav', 'phir se bolo', 'madad',
    'meeting band karo', 'sahi', 'meeting shuru karo', `galat, ${first} ${amt} bachat`, `${first} ${amt} bachat ${amt} kist`,
  ]);
}

describe('stress: 300 random meetings keep the money safe', () => {
  it('never breaks the chain, never lends cash it does not have, never saves without a yes', async () => {
    const base = await buildDemoData();
    const problems: string[] = [];
    const MONEY = new Set(['savings', 'repayment', 'loan']);
    const COMMIT_REPLIES = new Set(['saved', 'loanSaved', 'loanAsk', 'loanNoCash']);

    for (let seed = 1; seed <= 300 && problems.length < 5; seed++) {
      const r = rng(seed);
      let ledger: LedgerEntry[] = base.ledger;
      let state: MeetingState = initialState;
      const log: string[] = [];
      const steps = ['meeting shuru karo', ...Array.from({ length: 45 }, () => utterance(r))];

      for (const text of steps) {
        let res;
        try {
          res = step(state, { text }, { members: base.group.members, ledger });
        } catch (e) {
          problems.push(`seed ${seed}: crash on "${text}": ${(e as Error).message}\n${log.join('\n')}`);
          break;
        }
        log.push(`${text} -> ${res.reply.key}`);
        const money = res.drafts.filter((d) => MONEY.has(d.type));
        if (money.length && !COMMIT_REPLIES.has(res.reply.key)) {
          problems.push(`seed ${seed}: money written on "${text}" with reply ${res.reply.key}\n${log.join('\n')}`);
        }
        if (money.length && !['confirm', 'approve'].includes(classifyYes(text))) {
          problems.push(`seed ${seed}: money written without a yes: "${text}"\n${log.join('\n')}`);
        }
        state = res.state;
        ledger = await appendEntries(ledger, res.drafts);
        const b = computeBalances(ledger);
        if (b.groupCash < 0) problems.push(`seed ${seed}: group cash negative after "${text}"\n${log.join('\n')}`);
        const neg = Object.entries(b.members).find(([, mb]) => mb.loanOutstanding < 0);
        if (neg) problems.push(`seed ${seed}: ${neg[0]} loan below zero after "${text}"\n${log.join('\n')}`);
        if (problems.length) break;
      }
      if (!(await verifyChain(ledger)).ok) problems.push(`seed ${seed}: chain broken`);
    }
    expect(problems.slice(0, 2)).toEqual([]);
  }, 120_000);
});

/** Rough check that the words that committed money were a yes. */
function classifyYes(text: string): string {
  return /sahi|haan|हाँ|सही|manzoor|मंज़ूर|^yes|^ok/i.test(text) ? (/manzoor|मंज़ूर/i.test(text) ? 'approve' : 'confirm') : 'other';
}
