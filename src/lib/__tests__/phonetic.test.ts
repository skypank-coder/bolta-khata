import { describe, expect, it } from 'vitest';
import { matchMember, nameSimilarity, phoneticKey } from '../phonetic';
import { tokenize } from '../numbers';

const members = [
  { id: 'm1', name: 'Meena Devi', nameLocal: 'मीना देवी' },
  { id: 'm2', name: 'Sunita Kumari', nameLocal: 'सुनीता कुमारी' },
  { id: 'm3', name: 'Rekha', nameLocal: 'रेखा' },
  { id: 'm4', name: 'Reena', nameLocal: 'रीना' },
  { id: 'm5', name: 'Lakshmi Bai', nameLocal: 'लक्ष्मी बाई', aliases: ['Munni'] },
  { id: 'm6', name: 'Radha', nameLocal: 'राधा' },
];

const who = (text: string) => matchMember(tokenize(text), members);

describe('phonetic keys', () => {
  it('treats common spelling variants as the same name', () => {
    expect(phoneticKey('Sunitha')).toBe(phoneticKey('Suneeta'));
    expect(phoneticKey('Laxmi')).toBe(phoneticKey('Lakshmi'));
    expect(phoneticKey('Meena')).toBe(phoneticKey('Mina'));
    expect(nameSimilarity('Radhika', 'Radhika')).toBe(1);
  });
});

describe('matchMember', () => {
  it.each([
    ['Main Meena, 100 bachat', 'm1'],
    ['मीना 100 बचत', 'm1'],
    ['Sunitha ki kist 500', 'm2'],
    ['सुनीता का लोन', 'm2'],
    ['Laxmi 200 jama', 'm5'],
    ['Munni ne 100 diye', 'm5'],
    ['Radha haazir', 'm6'],
    ['Rekha', 'm3'],
    ['Reena', 'm4'],
  ])('%s -> %s', (text, id) => {
    expect(who(text).best?.memberId).toBe(id);
  });

  it('returns nothing for unknown names', () => {
    expect(who('Pushpa 100 bachat').best).toBeNull();
  });

  it('flags names that are too close to call', () => {
    const r = who('Reka');
    expect(r.best?.memberId === 'm3' || r.ambiguous !== null).toBe(true);
    // Same sound, different spelling on record: the exact spelling wins.
    const near = matchMember(tokenize('Sunita'), [
      { id: 'a', name: 'Sunitha' },
      { id: 'b', name: 'Sunita' },
    ]);
    expect(near.best?.memberId).toBe('b');
    // Two members whose names are said the same way: ask, never guess.
    const tie = matchMember(tokenize('Rina'), [
      { id: 'a', name: 'Reena' },
      { id: 'b', name: 'Rina' },
    ]);
    expect(tie.ambiguous).not.toBeNull();
  });
});
