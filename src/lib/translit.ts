/**
 * Devanagari -> rough Roman transliteration.
 *
 * Chrome's hi-IN / mr-IN speech recognition returns Devanagari ("मीना ने 500 बचत"),
 * while people also type or get Hinglish ("Meena ne 500 bachat"). Everything in the
 * parser works on one Roman form, so both paths meet here.
 *
 * It is deliberately phonetic, not scholarly: the output only has to be stable
 * enough for `fold()` and fuzzy matching to line up with Roman spellings.
 */

const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e',
};

const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e',
};

const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
};

/** Consonant + nukta (़) gives a different sound. */
const NUKTA: Record<string, string> = {
  'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f', 'य': 'y',
};

const NUKTA_PRECOMPOSED: Record<string, string> = {
  'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
};

const SIGNS: Record<string, string> = { 'ं': 'n', 'ँ': 'n', 'ः': 'h' };
const VIRAMA = '्';
const NUKTA_SIGN = '़';
const DIGITS = '०१२३४५६७८९';

/** Placeholder for the inherent vowel, so we can drop it at word ends (schwa deletion). */
const SCHWA = '\u0001';

export function hasDevanagari(text: string): boolean {
  return /[ऀ-ॿ]/.test(text);
}

export function transliterate(input: string): string {
  if (!hasDevanagari(input)) return input.toLowerCase();
  // Normalise precomposed nukta letters to their own sound first.
  const chars = Array.from(input.normalize('NFC'));
  let out = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (ch in NUKTA_PRECOMPOSED || ch in CONSONANTS) {
      let base = NUKTA_PRECOMPOSED[ch] ?? CONSONANTS[ch];
      let j = i + 1;
      if (chars[j] === NUKTA_SIGN) {
        base = NUKTA[ch] ?? base;
        j++;
      }
      out += base;
      const next = chars[j];
      if (next === VIRAMA) {
        i = j;
      } else if (next && next in MATRAS) {
        out += MATRAS[next];
        i = j;
      } else {
        out += SCHWA;
        i = j - 1;
      }
      continue;
    }

    if (ch in VOWELS) { out += VOWELS[ch]; continue; }
    if (ch in SIGNS) {
      // Anusvara after an inherent vowel: keep the vowel ("pa" + "n").
      out = out.replace(new RegExp(SCHWA + '$'), 'a');
      out += SIGNS[ch];
      continue;
    }
    if (ch === NUKTA_SIGN || ch === VIRAMA) continue;
    const d = DIGITS.indexOf(ch);
    if (d >= 0) { out += String(d); continue; }
    if (ch === '।' || ch === '॥') { out += '.'; continue; }
    out += ch.toLowerCase();
  }

  // Schwa deletion, as Hindi is spoken:
  //  - silent at the end of a word ("कमल" -> kamal)
  //  - silent between vowel+consonant and consonant+vowel ("कितना" -> kitnaa, "पिछली" -> pichhlee)
  out = out.replace(new RegExp(SCHWA + '(?=$|[^a-z\u0001])', 'g'), '');
  out = out.replace(
    new RegExp(`([aeiou${SCHWA}])([bcdfghjklmnpqrstvwxyz]+)${SCHWA}(?=[bcdfghjklmnpqrstvwxyz]+[aeiou])`, 'g'),
    '$1$2',
  );
  return out.replace(new RegExp(SCHWA, 'g'), 'a');
}

/**
 * Fold spelling differences that do not change meaning in Indian English/Hinglish:
 * long vowels written double, w/v, z/j, doubled consonants.
 * "Suneeta" / "Sunita", "hazaar" / "hajar", "pachchees" / "pachis" all meet here.
 */
export function fold(word: string): string {
  return word
    .toLowerCase()
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/aa+/g, 'a')
    .replace(/ou/g, 'au')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/ph/g, 'f')
    .replace(/q/g, 'k')
    .replace(/([a-z])\1+/g, '$1');
}
