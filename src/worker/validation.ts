import {
  LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND,
  LEADERBOARD_PLAUSIBLE_MIN_FLOOR,
} from '../shared/config';
import type { SubmissionRequest } from '../shared/leaderboard-types';

/** Result of validating a raw submission payload. */
export type ValidationResult =
  | {
      readonly kind: 'ok';
      readonly value: SubmissionRequest & { readonly initials: string };
    }
  | { readonly kind: 'err'; readonly code: 'invalid_payload' | 'implausible_score' };

/** Score plausibility upper bound. See research.md §R5. */
export function plausibleMaxScore(timeMs: number): number {
  if (!Number.isFinite(timeMs) || timeMs < 0) return LEADERBOARD_PLAUSIBLE_MIN_FLOOR;
  const fromTime = Math.ceil(timeMs / 1000) * LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND;
  return Math.max(LEADERBOARD_PLAUSIBLE_MIN_FLOOR, fromTime);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

/** Validate a `unknown` payload from the wire. Pure; no side-effects. */
export function validateSubmission(raw: unknown): ValidationResult {
  if (raw === null || typeof raw !== 'object') {
    return { kind: 'err', code: 'invalid_payload' };
  }
  const obj = raw as Record<string, unknown>;

  // initials: must be 1-3 letters; uppercase before testing.
  const initialsRaw = obj['initials'];
  if (typeof initialsRaw !== 'string') {
    return { kind: 'err', code: 'invalid_payload' };
  }
  const initials = initialsRaw.toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(initials)) {
    return { kind: 'err', code: 'invalid_payload' };
  }

  const score = obj['score'];
  if (!isInteger(score) || score < 0) {
    return { kind: 'err', code: 'invalid_payload' };
  }

  const timeMs = obj['timeMs'];
  if (!isInteger(timeMs) || timeMs < 0) {
    return { kind: 'err', code: 'invalid_payload' };
  }

  if (score > plausibleMaxScore(timeMs)) {
    return { kind: 'err', code: 'implausible_score' };
  }

  // `signature` is reserved (R10). Validate type only if present so a
  // future client sending one against a v1 server doesn't cause an error.
  const signature = obj['signature'];
  if (signature !== undefined && typeof signature !== 'string') {
    return { kind: 'err', code: 'invalid_payload' };
  }

  const value: SubmissionRequest & { readonly initials: string } =
    signature === undefined
      ? { initials, score, timeMs }
      : { initials, score, timeMs, signature };

  return { kind: 'ok', value };
}
