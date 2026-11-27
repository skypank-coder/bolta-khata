import { fold } from './translit';

/**
 * Matching Indian names as speech recognition actually hears them.
 * "Sunita", "Suneeta", "Sunitha", "सुनीता" and "Sunitaa" must all land on one member,
 * while "Rekha" and "Reena" must not silently swap.
 */

/** Collapse sounds that speakers, accents and recognisers mix up. */
export function phoneticKey(word: string): string {
  return fold(word)
    .replace(/([kgcjtdpb])h/g, '$1') // aspiration: Sunitha -> Sunita, Radhika -> Radika
    .replace(/sh/g, 's')             // Shanti / Santi (Bengali, Odia)
    .replace(/ksh|x/g, 'ks')         // Laxmi / Lakshmi
    .replace(/([aeiou])n(?=[^aeiou]|$)/g, '$1')  // nasal: Sanjna / Sajna, Pinki / Piki
    .replace(/v/g, 'b')              // Bengali/Assamese b-v
    .replace(/e/g, 'i')              // Meena / Mina, Seema / Sima
    .replace(/o/g, 'u')              // Sonu / Sunu
    .replace(/[aeiou]+$/g, '')       // trailing vowel: Meena / Meen, Geeta / Geet
    .replace(/([a-z])\1+/g, '$1');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 similarity on phonetic keys. */
export function nameSimilarity(heard: string, name: string): number {
  const a = phoneticKey(heard);
  const b = phoneticKey(name);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  return Math.max(0, 1 - dist / Math.max(a.length, b.length));
}

export interface NamedMember {
  id: string;
  name: string;       // Roman, e.g. "Sunita Devi"
  nameLocal?: string; // Devanagari, e.g. "सुनीता देवी"
  aliases?: string[]; // what the group calls her, e.g. "Munni"
}

export interface NameMatch {
  memberId: string;
  score: number;
  /** Heard spelling equals the stored spelling, not just the same sound. */
  exact: boolean;
  start: number; // token index
  end: number;
}

export interface MatchResult {
  best: NameMatch | null;
  /** Set when two members sound too alike to choose safely ("Rekha ya Reena?"). */
  ambiguous: [NameMatch, NameMatch] | null;
}

const STOP_WORDS = new Set(
  ['main', 'mai', 'mein', 'me', 'mera', 'meri', 'ka', 'ki', 'ke', 'ko', 'ne', 'hai', 'hoon', 'hu', 'hun', 'aur', 'ji', 'didi', 'devi',
    'bai', 'tai', 'behen', 'bahan', 'naam', 'name', 'is', 'my', 'and', 'the', 'se', 'ka', 'kitna', 'jama', 'bachat', 'kist', 'loan',
    'rupaye', 'rs', 'sahi', 'galat', 'haan', 'nahi', 'meeting', 'shuru', 'band', 'karo', 'group', 'samuh', 'samooh', 'haajir',
    'hajir', 'haazir', 'present', 'hazir', 'aaj', 'abhi', 'sau', 'hazaar', 'hajar', 'mi', 'majha', 'mazi', 'aahe', 'ahe']
    .map(fold),
);

const MATCH_THRESHOLD = 0.72;
/** Extra score for each further part of a name that was also said ("Sunita Yadav" beats "Sunita"). */
const EXTRA_PART_BONUS = 0.15;
/** Case endings glued onto names: Marathi "Radhala", "Meenachi"; Hindi "Meenaji". */
const SUFFIXES = ['la', 'ne', 'chi', 'cha', 'che', 'ji', 'ko', 'ki', 'ka', 'kade', 'sathi'];

function variants(tok: string): string[] {
  const out = [tok];
  for (const s of SUFFIXES) if (tok.length > s.length + 2 && tok.endsWith(s)) out.push(tok.slice(0, -s.length));
  return out;
}
const AMBIGUITY_GAP = 0.12;

function namePartsOf(m: NamedMember): string[] {
  const parts = [m.name, ...(m.aliases ?? [])].flatMap((n) => n.split(/\s+/));
  // First name carries most weight; surnames like "Devi" are shared by many members.
  return parts.filter((p) => p.length > 1 && !STOP_WORDS.has(fold(p)));
}

/**
 * Find which member a transcript refers to.
 * `tokens` are already transliterated/lower-cased (see numbers.tokenize).
 */
export function matchMember(tokens: string[], members: NamedMember[]): MatchResult {
  const candidates: NameMatch[] = [];

  for (const m of members) {
    let best: NameMatch | null = null;
    const parts = namePartsOf(m);
    const partHits = new Set<string>();
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.length < 2 || /^\d/.test(tok) || STOP_WORDS.has(fold(tok))) continue;
      for (const v of variants(fold(tok))) {
        for (const part of parts) {
          const score = nameSimilarity(v, part);
          if (score < MATCH_THRESHOLD) continue;
          partHits.add(part);
          const exact = fold(v) === fold(part);
          if (!best || score > best.score || (score === best.score && exact)) {
            best = { memberId: m.id, score, exact, start: i, end: i };
          }
        }
      }
    }
    if (best) {
      best.score += EXTRA_PART_BONUS * (partHits.size - 1);
      candidates.push(best);
    }
  }

  candidates.sort((a, b) => b.score - a.score || Number(b.exact) - Number(a.exact));
  const [first, second] = candidates;
  if (!first) return { best: null, ambiguous: null };
  const close = second && first.score - second.score < AMBIGUITY_GAP;
  const exactWins = first.exact && !second?.exact;
  if (close && !exactWins) {
    return { best: null, ambiguous: [first, second!] };
  }
  return { best: first, ambiguous: null };
}
