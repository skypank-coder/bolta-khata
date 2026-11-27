import { findAmounts, tokenize, type NumberSpan } from './numbers';
import { matchMember, type MatchResult, type NamedMember } from './phonetic';
import { fold } from './translit';

/**
 * Turns one spoken sentence (Hindi, Marathi, English or a mix, in Devanagari or Roman)
 * into what the speaker wants. Rule-based on purpose: it runs offline, in milliseconds,
 * and never invents an amount.
 */

export type MoneyType = 'savings' | 'repayment' | 'loan';

export interface MoneyItem {
  type: MoneyType;
  amount: number;
}

export type Intent =
  | { kind: 'start' }
  | { kind: 'attendanceDone' }
  | { kind: 'end' }
  | { kind: 'confirm' }
  | { kind: 'reject'; correction?: EntryIntent }
  | { kind: 'approve' }
  | { kind: 'undo' }
  | { kind: 'help' }
  | { kind: 'repeat' }
  | { kind: 'queryGroup' }
  | { kind: 'cashCount'; amount: number }
  | { kind: 'querySelf'; member: MatchResult; selfRef: boolean }
  | EntryIntent
  | { kind: 'name'; member: MatchResult }
  | { kind: 'amountOnly'; amount: number }
  | { kind: 'unknown' };

export interface EntryIntent {
  kind: 'entry';
  member: MatchResult;
  /** Speaker said "main", "mera", "mi": the entry is about herself. */
  selfRef: boolean;
  items: MoneyItem[];
  /** Amounts heard without a type word ("Meena 500"). */
  unassigned: number[];
  /** Type words heard without an amount ("Meena ki bachat"). */
  missingAmount: MoneyType[];
}

const w = (list: string[]) => new Set(list.map(fold));

const KEYWORDS: Record<MoneyType, Set<string>> = {
  savings: w(['bachat', 'bachaat', 'bachatt', 'jama', 'saving', 'savings', 'deposit', 'bachhat', 'bacht']),
  repayment: w(['kist', 'kisht', 'kishti', 'kisth', 'qist', 'kistt', 'emi', 'installment', 'instalment', 'hapta', 'hafta',
    'repay', 'repayment', 'chukaya', 'chukayi', 'chukaye', 'chukana', 'wapas', 'vapas', 'lautaya', 'parat']),
  loan: w(['loan', 'lon', 'lone', 'rin', 'karj', 'karz', 'karja', 'udhaar', 'udhar', 'borrow', 'credit']),
};

const CONFIRM = w(['sahi', 'sahee', 'haan', 'han', 'ha', 'haa', 'hanji', 'haanji', 'theek', 'thik', 'yes', 'ok', 'okay', 'bilkul',
  'barobar', 'ho', 'correct', 'right', 'ji', 'jee', 'hoy', 'sach']);
const REJECT = w(['galat', 'galath', 'nahi', 'nahin', 'nai', 'na', 'no', 'nako', 'chuk', 'chuki', 'wrong', 'mat', 'galti']);
const APPROVE = w(['manzoor', 'manjoor', 'manjur', 'manzur', 'approve', 'approved', 'sweekar', 'svikar', 'mangoor', 'pass']);
const SELF = w(['main', 'mai', 'mein', 'mera', 'meri', 'mere', 'mujhe', 'maine', 'mi', 'majha', 'majhi', 'mazha', 'mazi', 'my', 'i', 'me', 'mine']);
const QUESTION = w(['kitna', 'kitni', 'kitne', 'kiti', 'kevdha', 'how', 'much', 'kya', 'batao', 'bataiye', 'sangaa', 'sanga', 'balance', 'hisab', 'hisaab']);
const GROUP = w(['group', 'samuh', 'samooh', 'sabha', 'gat', 'sangh']);
/** Words used when the cash box is counted: "haath mein 20,100 hai", "nakad gina 20100", "rokh 20100". */
const CASH = w(['haath', 'hath', 'haat', 'nakad', 'nakd', 'nakdi', 'cash', 'rokad', 'rokh', 'rok', 'ginti', 'gina', 'gini',
  'ginkar', 'counted', 'count', 'hand', 'galla', 'peti', 'dabba', 'bakse', 'baksa']);

const PHRASES = {
  start: ['meeting shuru', 'meeting suru', 'sabha shuru', 'baithak shuru', 'baithak suru', 'shuru karo', 'shuru kare', 'suru kara',
    'start meeting', 'start the meeting', 'meeting start', 'meeting chalu'],
  end: ['meeting band', 'meeting khatam', 'meeting samapt', 'sabha band', 'baithak band', 'band karo', 'band kara', 'end meeting',
    'end the meeting', 'close meeting', 'close the meeting', 'meeting close', 'meeting end', 'meeting sampli'],
  attendanceWord: ['haziri', 'hajiri', 'hajri', 'haazri', 'hajeri', 'attendance', 'upasthiti'],
  attendanceDone: ['puri', 'puri hui', 'done', 'complete', 'khatam', 'purn', 'ho gayi', 'ho gai'],
  everyoneHere: ['sab aa gaye', 'sab aa gayi', 'sab aagaye', 'everyone is here'],
  undo: ['pichli entry hatao', 'pichhli entry hatao', 'pichli entry', 'last entry hatao', 'entry hatao', 'hatao', 'mitao', 'undo',
    'cancel karo', 'radd karo', 'kaat do', 'magil nond kadha'],
  help: ['madad', 'help', 'kya bolna', 'kaise bolna', 'kya bolu', 'kaise bolu', 'samjhao', 'madat'],
  repeat: ['phir se bolo', 'fir se bolo', 'phir se', 'fir se', 'dobara bolo', 'repeat', 'kya bola', 'kya kaha', 'punha sanga'],
  groupMoney: ['group ke paas', 'group ke pas', 'samooh ke paas', 'samuh ke pas', 'kul paisa', 'total kitna', 'total paisa',
    'cash kitna', 'gat kade', 'group me kitna', 'group mein kitna'],
};

function hasPhrase(joined: string, list: string[]): boolean {
  return list.some((p) => joined.includes(` ${p.split(' ').map(fold).join(' ')} `));
}

function classifyKeyword(f: string): MoneyType | null {
  for (const t of ['repayment', 'savings', 'loan'] as MoneyType[]) if (KEYWORDS[t].has(f)) return t;
  return null;
}

/** Pair amounts with their type words, following the speaker's own order. */
function pairItems(tokens: string[], spans: NumberSpan[]) {
  const folded = tokens.map(fold);
  let kws = folded
    .map((f, i) => ({ type: classifyKeyword(f), pos: i }))
    .filter((k): k is { type: MoneyType; pos: number } => k.type !== null);

  // "loan ki kist" / "loan chukaya" is a repayment, not a new loan.
  kws = kws.filter((k) => !(k.type === 'loan' && kws.some((o) => o.type === 'repayment' && o.pos > k.pos && o.pos - k.pos <= 2)));
  // "jama" right after a question word is a question ("kitna jama"), handled elsewhere.

  const items: MoneyItem[] = [];
  const usedNum = new Set<number>();
  const usedKw = new Set<number>();
  const numbersFirst = spans.length > 0 && (kws.length === 0 || spans[0].start < kws[0].pos);

  if (numbersFirst) {
    // "100 bachat, 500 kist": each amount takes the next type word after it.
    spans.forEach((s, si) => {
      const k = kws.findIndex((k, ki) => !usedKw.has(ki) && k.pos > s.end && (si + 1 >= spans.length || k.pos < spans[si + 1].start));
      if (k >= 0) { items.push({ type: kws[k].type, amount: s.value }); usedNum.add(si); usedKw.add(k); }
    });
  } else {
    // "bachat 100, kist 500": each type word takes the next amount after it.
    kws.forEach((k, ki) => {
      const s = spans.findIndex((s, si) => !usedNum.has(si) && s.start > k.pos && (ki + 1 >= kws.length || s.start < kws[ki + 1].pos));
      if (s >= 0) { items.push({ type: k.type, amount: spans[s].value }); usedNum.add(s); usedKw.add(ki); }
    });
  }
  // Leftovers: an amount with a type word on the "wrong" side still belongs to it.
  spans.forEach((s, si) => {
    if (usedNum.has(si)) return;
    const k = kws.findIndex((_, ki) => !usedKw.has(ki));
    if (k >= 0) { items.push({ type: kws[k].type, amount: s.value }); usedNum.add(si); usedKw.add(k); }
  });

  return {
    items,
    unassigned: spans.filter((_, si) => !usedNum.has(si)).map((s) => s.value),
    missingAmount: [...new Set(kws.filter((_, ki) => !usedKw.has(ki)).map((k) => k.type))],
  };
}

export function parseIntent(text: string, members: NamedMember[]): Intent {
  const tokens = tokenize(text);
  if (!tokens.length) return { kind: 'unknown' };
  const folded = tokens.map(fold);
  const set = new Set(folded);
  const joined = ` ${folded.join(' ')} `;
  const short = tokens.length <= 4;

  if (hasPhrase(joined, PHRASES.start)) return { kind: 'start' };
  if (hasPhrase(joined, PHRASES.end)) return { kind: 'end' };
  if ((hasPhrase(joined, PHRASES.attendanceWord) && hasPhrase(joined, PHRASES.attendanceDone)) || hasPhrase(joined, PHRASES.everyoneHere)) {
    return { kind: 'attendanceDone' };
  }
  if (hasPhrase(joined, PHRASES.undo)) return { kind: 'undo' };
  if (hasPhrase(joined, PHRASES.help)) return { kind: 'help' };
  if (hasPhrase(joined, PHRASES.repeat)) return { kind: 'repeat' };

  const spans = findAmounts(tokens);
  const numberTokens = new Set(spans.flatMap((s) => Array.from({ length: s.end - s.start + 1 }, (_, k) => s.start + k)));
  const nameTokens = tokens.map((t, i) => (numberTokens.has(i) ? '' : t));
  const member = matchMember(nameTokens, members);
  const selfRef = folded.some((f) => SELF.has(f));
  const isQuestion = folded.some((f) => QUESTION.has(f));

  if (spans.length === 1 && !member.best && folded.some((f) => CASH.has(f)) && !folded.some((f) => classifyKeyword(f))) {
    return { kind: 'cashCount', amount: spans[0].value };
  }
  if (hasPhrase(joined, PHRASES.groupMoney) || (isQuestion && folded.some((f) => GROUP.has(f)) && !member.best)) {
    return { kind: 'queryGroup' };
  }
  if (isQuestion && !spans.length) {
    return { kind: 'querySelf', member, selfRef };
  }

  if (folded.some((f) => APPROVE.has(f)) && !spans.length) return { kind: 'approve' };

  const { items, unassigned, missingAmount } = pairItems(tokens, spans);
  const entry: EntryIntent = { kind: 'entry', member, selfRef, items, unassigned, missingAmount };
  const hasMoney = items.length > 0 || unassigned.length > 0 || missingAmount.length > 0;

  const leadsWithReject = REJECT.has(folded[0]) || (short && folded.some((f) => REJECT.has(f)));
  if (leadsWithReject) return hasMoney ? { kind: 'reject', correction: entry } : { kind: 'reject' };
  if (!hasMoney && (short || CONFIRM.has(folded[0])) && folded.some((f) => CONFIRM.has(f)) && !member.best) {
    return { kind: 'confirm' };
  }

  if (hasMoney && (items.length || missingAmount.length || member.best || member.ambiguous)) return entry;
  if (member.best || member.ambiguous) return { kind: 'name', member };
  if (spans.length === 1) return { kind: 'amountOnly', amount: spans[0].value };
  if (set.has('sahi') || set.has('haan')) return { kind: 'confirm' };
  return { kind: 'unknown' };
}

export type Mark = 'name' | 'amount' | MoneyType | 'yes' | 'no' | 'cash' | null;

/**
 * Which words of a sentence were understood as what, so the screen can colour
 * the speaker's own words: the name, the amount, bachat/kist/loan, sahi/galat.
 */
export function annotate(text: string, members: NamedMember[]): Array<{ word: string; mark: Mark }> {
  const words = text.split(/(\s+)/);
  const flat: string[] = [];
  const owner: number[] = [];
  words.forEach((w, wi) => {
    if (!w.trim()) return;
    for (const t of tokenize(w)) { flat.push(t); owner.push(wi); }
  });
  const marks = new Map<number, Mark>();
  for (const s of findAmounts(flat)) for (let i = s.start; i <= s.end; i++) marks.set(owner[i], 'amount');
  flat.forEach((t, i) => {
    if (marks.has(owner[i])) return;
    const f = fold(t);
    const type = classifyKeyword(f);
    if (type) marks.set(owner[i], type);
    else if (APPROVE.has(f) || (CONFIRM.has(f) && f.length > 2)) marks.set(owner[i], 'yes');
    else if (REJECT.has(f) && f.length > 2) marks.set(owner[i], 'no');
    else if (CASH.has(f)) marks.set(owner[i], 'cash');
  });
  const m = matchMember(flat.map((t, i) => (marks.has(owner[i]) ? '' : t)), members);
  for (const c of [m.best, ...(m.ambiguous ?? [])]) if (c) marks.set(owner[c.start], 'name');
  return words.map((word, wi) => ({ word, mark: marks.get(wi) ?? null }));
}
