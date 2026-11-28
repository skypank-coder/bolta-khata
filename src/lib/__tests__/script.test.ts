import { describe, expect, it } from 'vitest';
import { parseIntent } from '../intent';
import { DEMO_GROUP } from '../store';

describe('lines in the recording script', () => {
  it('understands the cash count line exactly', () => {
    expect(parseIntent('हाथ में अठारह हज़ार एक सौ है', DEMO_GROUP.members)).toEqual({ kind: 'cashCount', amount: 18100 });
  });
});
