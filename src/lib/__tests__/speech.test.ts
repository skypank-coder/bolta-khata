import { describe, expect, it } from 'vitest';
import { sentences, voiceScore } from '../speech';

describe('clear voice', () => {
  it('prefers neural Hindi voices, then Google, then plain system voices', () => {
    const voices = [
      { name: 'Microsoft Hemant - Hindi (India)', lang: 'hi-IN' },
      { name: 'Google हिन्दी', lang: 'hi-IN' },
      { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN' },
      { name: 'Microsoft Ravi - English (India)', lang: 'en-IN' },
      { name: 'Samantha', lang: 'en-US' },
    ];
    const ranked = [...voices].sort((a, b) => voiceScore(b, 'hi-IN') - voiceScore(a, 'hi-IN')).map((v) => v.name);
    expect(ranked[0]).toContain('Swara');
    expect(ranked[1]).toContain('Google');
    expect(voiceScore({ name: 'Samantha', lang: 'en-US' }, 'hi-IN')).toBe(0);
    // Marathi text falls back to a Hindi voice, not an English one.
    expect(voiceScore({ name: 'Google हिन्दी', lang: 'hi-IN' }, 'mr-IN')).toBeGreaterThan(voiceScore({ name: 'Microsoft Ravi', lang: 'en-IN' }, 'mr-IN'));
  });

  it('speaks a reply sentence by sentence', () => {
    expect(sentences('मीना देवी: बचत ₹100। बाकी लोन ₹1,500। सही है?')).toEqual(['मीना देवी: बचत ₹100।', 'बाकी लोन ₹1,500।', 'सही है?']);
    expect(sentences('Saved.')).toEqual(['Saved.']);
  });
});
