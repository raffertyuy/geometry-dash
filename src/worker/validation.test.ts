import { describe, expect, it } from 'vitest';
import {
  LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND,
  LEADERBOARD_PLAUSIBLE_MIN_FLOOR,
} from '../shared/config';
import { plausibleMaxScore, validateSubmission } from './validation';

describe('plausibleMaxScore', () => {
  it('respects the floor on tiny times', () => {
    expect(plausibleMaxScore(0)).toBe(LEADERBOARD_PLAUSIBLE_MIN_FLOOR);
    expect(plausibleMaxScore(1)).toBe(LEADERBOARD_PLAUSIBLE_MIN_FLOOR);
    expect(plausibleMaxScore(1000)).toBeGreaterThanOrEqual(LEADERBOARD_PLAUSIBLE_MIN_FLOOR);
  });

  it('scales linearly with seconds elapsed beyond the floor', () => {
    const oneMin = plausibleMaxScore(60_000);
    expect(oneMin).toBe(60 * LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND);
    const fiveMin = plausibleMaxScore(300_000);
    expect(fiveMin).toBe(300 * LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND);
  });

  it('ceil-rounds partial seconds upward', () => {
    expect(plausibleMaxScore(1_500)).toBe(2 * LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND);
  });

  it('handles non-finite or negative inputs by returning the floor', () => {
    expect(plausibleMaxScore(Number.NaN)).toBe(LEADERBOARD_PLAUSIBLE_MIN_FLOOR);
    expect(plausibleMaxScore(Number.POSITIVE_INFINITY)).toBe(LEADERBOARD_PLAUSIBLE_MIN_FLOOR);
    expect(plausibleMaxScore(-1)).toBe(LEADERBOARD_PLAUSIBLE_MIN_FLOOR);
  });
});

describe('validateSubmission', () => {
  const good = { initials: 'RAF', score: 1000, timeMs: 60_000 };

  it('accepts a well-formed payload', () => {
    const result = validateSubmission(good);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.initials).toBe('RAF');
    }
  });

  it('uppercases lowercase initials', () => {
    const result = validateSubmission({ ...good, initials: 'raf' });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value.initials).toBe('RAF');
  });

  it('rejects null', () => {
    expect(validateSubmission(null)).toEqual({ kind: 'err', code: 'invalid_payload' });
  });

  it('rejects primitives', () => {
    expect(validateSubmission(42)).toEqual({ kind: 'err', code: 'invalid_payload' });
    expect(validateSubmission('hello')).toEqual({ kind: 'err', code: 'invalid_payload' });
  });

  it('rejects missing initials', () => {
    expect(validateSubmission({ score: 1, timeMs: 1 })).toEqual({
      kind: 'err',
      code: 'invalid_payload',
    });
  });

  it('rejects initials of length 0', () => {
    expect(validateSubmission({ ...good, initials: '' }).kind).toBe('err');
  });

  it('rejects initials of length 4+', () => {
    expect(validateSubmission({ ...good, initials: 'WXYZ' }).kind).toBe('err');
  });

  it('rejects initials with non-letters', () => {
    expect(validateSubmission({ ...good, initials: 'R3F' }).kind).toBe('err');
    expect(validateSubmission({ ...good, initials: 'AB!' }).kind).toBe('err');
  });

  it('rejects non-integer score', () => {
    expect(validateSubmission({ ...good, score: 1.5 }).kind).toBe('err');
  });

  it('rejects negative score', () => {
    expect(validateSubmission({ ...good, score: -1 }).kind).toBe('err');
  });

  it('rejects NaN / Infinity score', () => {
    expect(validateSubmission({ ...good, score: Number.NaN }).kind).toBe('err');
    expect(validateSubmission({ ...good, score: Number.POSITIVE_INFINITY }).kind).toBe('err');
  });

  it('rejects non-integer timeMs', () => {
    expect(validateSubmission({ ...good, timeMs: 1.5 }).kind).toBe('err');
  });

  it('rejects negative timeMs', () => {
    expect(validateSubmission({ ...good, timeMs: -1 }).kind).toBe('err');
  });

  it('rejects score above plausibleMaxScore(timeMs)', () => {
    const result = validateSubmission({ ...good, timeMs: 1000, score: 999_999_999 });
    expect(result).toEqual({ kind: 'err', code: 'implausible_score' });
  });

  it('accepts score equal to plausibleMaxScore(timeMs)', () => {
    const ts = 60_000;
    const max = plausibleMaxScore(ts);
    expect(validateSubmission({ ...good, timeMs: ts, score: max }).kind).toBe('ok');
  });

  it('respects the floor for short times (1s + 100k score passes)', () => {
    expect(validateSubmission({ ...good, timeMs: 1000, score: 100_000 }).kind).toBe('ok');
  });

  it('silently accepts but preserves a string signature field', () => {
    const result = validateSubmission({ ...good, signature: 'opaque-v2' });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value.signature).toBe('opaque-v2');
  });

  it('rejects a non-string signature field', () => {
    expect(validateSubmission({ ...good, signature: 42 }).kind).toBe('err');
  });
});
