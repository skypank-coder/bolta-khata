import { fold, transliterate } from './translit';

/**
 * Spoken money parser for how amounts are actually said in Indian villages:
 *   "paanch sau", "dedh hazaar", "saade teen hazaar", "paune do hazaar",
 *   "sava sau", "dhai sau", "do hazaar paanch sau", "five hundred",
 *   "2,000", "₹1500", Devanagari "पांच सौ", Marathi "पाचशे" / "दीड हजार".
 */

type Vocab = Array<[number, string[]]>;

/** Hindi 1–99. Every number here is irregular, so the full table is needed. */
const HINDI_NUMBERS: Vocab = [
  [1, ['ek']], [2, ['do']], [3, ['teen', 'tin']], [4, ['chaar', 'char']], [5, ['paanch', 'panch', 'pach']],
  [6, ['chhah', 'chhe', 'chha', 'chah', 'che']], [7, ['saat']], [8, ['aath', 'ath']], [9, ['nau', 'no']], [10, ['das', 'dus']],
  [11, ['gyarah', 'gyaarah', 'gyara']], [12, ['barah', 'baarah', 'bara']], [13, ['terah', 'tera']], [14, ['chaudah', 'chauda']],
  [15, ['pandrah', 'pandra', 'pendra']], [16, ['solah', 'sola']], [17, ['satrah', 'satra']], [18, ['atharah', 'athaarah', 'athara']],
  [19, ['unnis', 'unnees', 'unis']], [20, ['bees', 'bis']],
  [21, ['ikkis', 'ikkees']], [22, ['baais', 'bais', 'baees']], [23, ['teis', 'tees_23', 'teyis']], [24, ['chaubis', 'chaubees']],
  [25, ['pachchis', 'pachchees', 'pachis', 'pacchis']], [26, ['chhabbis', 'chhabbees']], [27, ['sattais', 'sattaees']],
  [28, ['atthais', 'atthaees']], [29, ['unatis', 'untees', 'unattis']], [30, ['tees', 'tis']],
  [31, ['iktis', 'ikattees', 'iktees']], [32, ['battis', 'battees']], [33, ['taintis', 'taintees', 'tetis']], [34, ['chautis', 'chautees']],
  [35, ['paintis', 'paintees']], [36, ['chhattis', 'chhattees']], [37, ['saintis', 'saintees']], [38, ['adtis', 'artees', 'adtees']],
  [39, ['untalis', 'untaalees']], [40, ['chalis', 'chaalees', 'chalees']],
  [41, ['iktalis', 'iktaalees']], [42, ['bayalis', 'bayaalees']], [43, ['taintalis', 'taintaalees']], [44, ['chauvalis', 'chavaalees']],
  [45, ['paintalis', 'paintaalees']], [46, ['chhiyalis', 'chhiyaalees']], [47, ['saintalis', 'saintaalees']], [48, ['adtalis', 'artaalees']],
  [49, ['unchas', 'unchaas']], [50, ['pachas', 'pachaas']],
  [51, ['ikyavan', 'ikyaavan']], [52, ['bavan', 'baavan']], [53, ['tirpan', 'tirepan']], [54, ['chauvan', 'chauvan']],
  [55, ['pachpan']], [56, ['chhappan']], [57, ['sattavan', 'sattaavan']], [58, ['atthavan', 'atthaavan']],
  [59, ['unsath', 'unsaath']], [60, ['saath']],
  [61, ['iksath', 'iksaath']], [62, ['basath', 'baasath']], [63, ['tirsath', 'tiresath']], [64, ['chausath', 'chausaath']],
  [65, ['painsath', 'painsaath']], [66, ['chhiyasath', 'chhiyaasath']], [67, ['sadsath', 'sarsath']], [68, ['adsath', 'arsath']],
  [69, ['unhattar']], [70, ['sattar']],
  [71, ['ikhattar']], [72, ['bahattar']], [73, ['tihattar']], [74, ['chauhattar']], [75, ['pachhattar', 'pachattar']],
  [76, ['chhihattar']], [77, ['satattar', 'sathattar']], [78, ['athattar']], [79, ['unasi', 'unaasee']], [80, ['assi', 'assee']],
  [81, ['ikyasi', 'ikyaasee']], [82, ['bayasi', 'bayaasee']], [83, ['tirasi', 'tiraasee']], [84, ['chaurasi', 'chauraasee']],
  [85, ['pachasi', 'pachaasee']], [86, ['chhiyasi', 'chhiyaasee']], [87, ['sattasi', 'sattaasee']], [88, ['athasi', 'athaasee']],
  [89, ['navasi', 'nawasi', 'navaasee']], [90, ['nabbe']],
  [91, ['ikyanve']], [92, ['banve', 'baanve']], [93, ['tiranve']], [94, ['chauranve']], [95, ['pachanve', 'pachaanve']],
  [96, ['chhiyanve']], [97, ['sattanve']], [98, ['attanve', 'atthaanve']], [99, ['ninyanve', 'ninyaanve']],
];

/** Marathi numbers that differ from Hindi. */
const MARATHI_NUMBERS: Vocab = [
  [2, ['don']], [5, ['paach']], [6, ['saha']], [10, ['daha']], [11, ['akra']], [12, ['bara']], [20, ['vees']],
  [25, ['panchvis', 'pachvis']], [30, ['tees']], [40, ['chalees']], [50, ['pannas', 'pannaas']],
  [60, ['saath']], [70, ['sattar']], [75, ['pachattar', 'panchyahattar']], [80, ['ainshi']], [90, ['navvad']],
];

const ENGLISH_NUMBERS: Vocab = [
  [1, ['one']], [2, ['two']], [3, ['three']], [4, ['four']], [5, ['five']], [6, ['six']], [7, ['seven']], [8, ['eight']],
  [9, ['nine']], [10, ['ten']], [11, ['eleven']], [12, ['twelve']], [13, ['thirteen']], [14, ['fourteen']], [15, ['fifteen']],
  [16, ['sixteen']], [17, ['seventeen']], [18, ['eighteen']], [19, ['nineteen']], [20, ['twenty']], [30, ['thirty']],
  [40, ['forty', 'fourty']], [50, ['fifty']], [60, ['sixty']], [70, ['seventy']], [80, ['eighty']], [90, ['ninety']],
];

const MULTIPLIERS: Vocab = [
  [100, ['sau', 'so', 'saw', 'hundred', 'shambhar', 'shembhar']],
  [1000, ['hazaar', 'hazar', 'hajar', 'hajaar', 'hazzar', 'thousand', 'k']],
  [100000, ['lakh', 'lac', 'laakh', 'lakhs']],
];

/** Fractions that change the number that follows them. */
const FRACTION_PREFIX: Record<string, { add: number; alone: number }> = {
  sava: { add: 0.25, alone: 1.25 },   // sava do = 2.25, sava sau = 125
  savaa: { add: 0.25, alone: 1.25 },
  sade: { add: 0.5, alone: 1.5 },     // saade teen hazaar = 3500
  sadhe: { add: 0.5, alone: 1.5 },
  sarhe: { add: 0.5, alone: 1.5 },
  paune: { add: -0.25, alone: 0.75 }, // paune do hazaar = 1750, paune sau = 75
  pavne: { add: -0.25, alone: 0.75 },
};

/** Fractions that are numbers on their own. */
const FRACTION_WORDS: Vocab = [
  [1.5, ['dedh', 'derh', 'dedhh', 'deed', 'did']], // did = Marathi दीड
  [2.5, ['dhai', 'dhaai', 'adhai', 'adhaai', 'adich', 'adeech']],
  [0.5, ['aadha', 'adha', 'aadhe']],
];

const CURRENCY = new Set(['rs', 'rupaye', 'rupaya', 'rupay', 'rupe', 'rupee', 'rupees', 'rupiya', 'rupiye', 'rupaiya', 'rupaiye', 'rupae', 'rupaye', 'rupaie', 'ru', 'inr', 'rupaye']
  .map(fold));

function buildLookup(...lists: Vocab[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const list of lists) {
    for (const [value, words] of list) {
      for (const w of words) {
        const key = fold(w.split('_')[0]);
        if (!map.has(key)) map.set(key, value);
      }
    }
  }
  return map;
}

const NUMBER_WORDS = buildLookup(HINDI_NUMBERS, ENGLISH_NUMBERS, MARATHI_NUMBERS);
const MULTIPLIER_WORDS = buildLookup(MULTIPLIERS);
const FRACTION_ALONE = buildLookup(FRACTION_WORDS);
const FRACTION_PREFIXES = new Map(Object.entries(FRACTION_PREFIX).map(([k, v]) => [fold(k), v]));

/** Words that look like numbers but usually are not, unless "rupaye" follows. */
const RISKY_ALONE = new Set(['saath', 'so', 'saw', 'k'].map(fold));
/** Compared before folding: हजर transliterates to "hajar", हजार to "hajaar". */
const PRESENT_NOT_THOUSAND = new Set(['hajar', 'hajir', 'hazir']);

export interface NumberSpan {
  value: number;
  start: number; // token index, inclusive
  end: number;   // token index, inclusive
}

/** Normalise any transcript into lowercase Roman tokens. */
export function tokenize(text: string): string[] {
  return transliterate(text)
    .replace(/₹/g, ' rs ')
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Marathi glues hundreds on: "paachshe" = 500, "donshe" = 200. */
function splitShe(token: string): [number, number] | null {
  const m = /^(.+?)(she|se|shey)$/.exec(token);
  if (!m) return null;
  const stem = fold(m[1]);
  // Devanagari keeps an inner schwa ("paachashe"), so try without it too.
  const n = NUMBER_WORDS.get(stem) ?? NUMBER_WORDS.get(stem.replace(/a$/, ''));
  return n !== undefined ? [n, 100] : null;
}

type Tok =
  | { kind: 'num'; value: number; digit: boolean }
  | { kind: 'mul'; value: number }
  | { kind: 'frac'; add: number; alone: number }
  | { kind: 'cur' }
  | { kind: 'word' };

function classify(token: string): Tok[] {
  if (/^\d+(\.\d+)?$/.test(token)) return [{ kind: 'num', value: parseFloat(token), digit: true }];
  const f = fold(token);
  if (CURRENCY.has(f)) return [{ kind: 'cur' }];
  const mul = MULTIPLIER_WORDS.get(f);
  if (mul !== undefined) return [{ kind: 'mul', value: mul }];
  const frac = FRACTION_PREFIXES.get(f);
  if (frac) return [{ kind: 'frac', ...frac }];
  const alone = FRACTION_ALONE.get(f);
  if (alone !== undefined) return [{ kind: 'num', value: alone, digit: false }];
  const n = NUMBER_WORDS.get(f);
  if (n !== undefined) return [{ kind: 'num', value: n, digit: false }];
  const she = splitShe(f);
  if (she) return [{ kind: 'num', value: she[0], digit: false }, { kind: 'mul', value: she[1] }];
  return [{ kind: 'word' }];
}

/** Find every money amount in a transcript, with token positions. */
export function findAmounts(tokens: string[]): NumberSpan[] {
  const spans: NumberSpan[] = [];
  let i = 0;

  while (i < tokens.length) {
    const first = classify(tokens[i]);
    if (!first.some((t) => t.kind === 'num' || t.kind === 'frac' || (t.kind === 'mul' && t.value >= 100 && i > 0))) {
      i++;
      continue;
    }

    let total = 0;
    let current = 0;
    let pendingFrac: { add: number; alone: number } | null = null;
    let sawDigit = false;
    let sawMultiplier = false;
    let sawFraction = false;
    let j = i;
    let lastConsumed = i - 1;
    // Where the running "current" part began, to drop a dangling verb like the last "do"
    // in "do hazaar do" (= "give two thousand").
    let currentStart = -1;
    let currentHasMul = false;
    let currentDigit = false;

    outer: for (; j < tokens.length; j++) {
      for (const t of classify(tokens[j])) {
        if (t.kind === 'num') {
          // Two plain numbers in a row ("100 500") are two amounts, not one.
          if (current > 0 && !sawMultiplier && (t.digit || t.value >= current)) break outer;
          if (current > 0 && t.digit) break outer;
          let v = t.value;
          if (current === 0) { currentStart = j; currentHasMul = false; currentDigit = t.digit; }
          if (pendingFrac) { v += pendingFrac.add; pendingFrac = null; sawFraction = true; }
          if (!Number.isInteger(t.value)) sawFraction = true;
          current += v;
          sawDigit ||= t.digit;
        } else if (t.kind === 'mul') {
          if (current === 0 && pendingFrac) { current = pendingFrac.alone; pendingFrac = null; sawFraction = true; }
          if (current === 0) current = 1;
          if (t.value === 100) { current *= 100; currentHasMul = true; }
          else { total += current * t.value; current = 0; }
          sawMultiplier = true;
        } else if (t.kind === 'frac') {
          if (current > 0 || total > 0) break outer;
          pendingFrac = { add: t.add, alone: t.alone };
        } else {
          break outer;
        }
      }
      lastConsumed = j;
    }

    let end = lastConsumed;
    if (total > 0 && current > 0 && current < 10 && !currentHasMul && !currentDigit && currentStart > i) {
      current = 0;
      end = currentStart - 1;
    }
    const value = Math.round(total + current);
    const followedByCurrency = end + 1 < tokens.length && classify(tokens[end + 1])[0].kind === 'cur';
    // A lone "hajar" is Marathi हजर (present), not हजार (thousand). A lone "sau" still means 100.
    const singleRisky = end === i && (RISKY_ALONE.has(fold(tokens[i])) || PRESENT_NOT_THOUSAND.has(tokens[i]));
    // A lone small word ("do", "ek") or a lone fraction ("did", "aadha") is too risky
    // to read as money unless "rupaye" follows it.
    const weakAlone = !sawDigit && !sawMultiplier && (value < 10 || sawFraction);
    const accept = value > 0 && (followedByCurrency || (!weakAlone && !singleRisky));

    if (accept) spans.push({ value, start: i, end });
    i = Math.max(end + 1, i + 1);
  }
  return spans;
}

/** Convenience: parse the first amount in free text. */
export function parseAmount(text: string): number | null {
  const spans = findAmounts(tokenize(text));
  return spans.length ? spans[0].value : null;
}

/** Format rupees the Indian way: 1,50,000. */
export function formatRupees(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
