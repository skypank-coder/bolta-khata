import { describe, expect, it } from 'vitest';
import { findAmounts, parseAmount, tokenize, formatRupees } from '../numbers';
import { transliterate } from '../translit';

const amounts = (t: string) => findAmounts(tokenize(t)).map((s) => s.value);

describe('transliterate', () => {
  it('turns Devanagari names into Roman with schwa deletion', () => {
    expect(transliterate('मीना')).toBe('meenaa');
    expect(transliterate('सुनीता')).toBe('suneetaa');
    expect(transliterate('कमल')).toBe('kamal');
    expect(transliterate('हज़ार')).toBe('hazaar');
  });
  it('maps Devanagari digits', () => {
    expect(transliterate('५००')).toBe('500');
  });
});

describe('spoken money', () => {
  it.each([
    ['Main Meena, 100 rupaye bachat, 500 kist', [100, 500]],
    ['paanch sau', [500]],
    ['dedh hazaar', [1500]],
    ['saade teen hazaar', [3500]],
    ['paune do hazaar', [1750]],
    ['sava sau', [125]],
    ['dhai sau rupaye', [250]],
    ['do hazaar paanch sau', [2500]],
    ['ek hazaar do sau pachaas', [1250]],
    ['five hundred', [500]],
    ['two thousand five hundred', [2500]],
    ['twenty five rupees', [25]],
    ['2,000', [2000]],
    ['₹1500 jama', [1500]],
    ['ek lakh', [100000]],
    ['पांच सौ रुपए', [500]],
    ['मीना 100 बचत 500 किस्त', [100, 500]],
    ['डेढ़ हज़ार', [1500]],
    ['पाचशे', [500]],
    ['दीड हजार', [1500]],
    ['2k', [2000]],
  ])('%s', (text, expected) => {
    expect(amounts(text)).toEqual(expected);
  });

  it('ignores number-like words that are not money', () => {
    expect(amounts('Sunita ko do hazaar do')).toEqual([2000]);
    expect(amounts('Meena ke saath aayi')).toEqual([]);
    expect(amounts('ek baar phir se bolo')).toEqual([]);
    expect(amounts('I did not pay')).toEqual([]);
    expect(amounts('so what')).toEqual([]);
  });

  it('accepts small words when rupaye follows', () => {
    expect(amounts('paanch rupaye')).toEqual([5]);
  });

  it('parseAmount returns the first amount or null', () => {
    expect(parseAmount('kist dedh sau')).toBe(150);
    expect(parseAmount('kuch nahi')).toBeNull();
  });

  it('formats rupees in the Indian system', () => {
    expect(formatRupees(150000)).toBe('₹1,50,000');
  });
});
