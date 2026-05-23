import { describe, expect, it } from 'vitest';
import { _profanitySetForTests, containsProfanity } from './profanity';

describe('containsProfanity', () => {
  it('matches every entry in the embedded wordlist', () => {
    for (const entry of _profanitySetForTests()) {
      expect(containsProfanity(entry)).toBe(true);
    }
  });

  it('does not match common non-offensive initials', () => {
    for (const ok of ['RAF', 'AAA', 'JON', 'KAT', 'BOB', 'ZOE', 'JIM']) {
      expect(containsProfanity(ok)).toBe(false);
    }
  });

  it('does not match empty string', () => {
    expect(containsProfanity('')).toBe(false);
  });

  it('is case-sensitive (callers must uppercase first; the validator does that)', () => {
    // Demonstrates the contract: the set is uppercase; lowercase input is not
    // matched. Validation ensures only uppercase reaches this function.
    expect(containsProfanity('ass')).toBe(false);
    expect(containsProfanity('ASS')).toBe(true);
  });

  it('contains at least 10 entries (small but non-empty)', () => {
    expect(_profanitySetForTests().size).toBeGreaterThanOrEqual(10);
  });
});
