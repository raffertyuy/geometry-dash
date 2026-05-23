/**
 * Embedded profanity wordlist for 3-letter initials. Intentionally tight
 * (≤ 30 entries) — operators amend by editing this file and redeploying.
 *
 * The list contains common English slurs and obvious obscenities. Coverage
 * is best-effort; false negatives are accepted (operators can delete a
 * polluted entry via `wrangler kv key get/put`). Non-English coverage is
 * out of scope for v1.
 *
 * The list is intentionally kept small and case-folded; callers MUST pass
 * an already-uppercased value (the validator does that).
 */
const PROFANITY_INITIALS: ReadonlySet<string> = new Set([
  // Common English slurs (3-letter forms only)
  'FAG',
  'NIG',
  'KKK',
  'JEW',
  'SPC',
  'CHK',
  'GUK',
  'WOP',
  'POM',
  // Common English obscenities (3-letter forms only)
  'ASS',
  'TIT',
  'CUM',
  'DIK',
  'FUK',
  'COC',
  'COK',
  'PIS',
  'PUS',
  'PNS',
  'JIZ',
  // Sex acts / anatomy
  'SEX',
  'BJZ',
  'BJS',
  // Misc
  'GAY',
  'HOE',
  'BCH',
]);

export function containsProfanity(initials: string): boolean {
  return PROFANITY_INITIALS.has(initials);
}

/** Exposed for testing only. */
export function _profanitySetForTests(): ReadonlySet<string> {
  return PROFANITY_INITIALS;
}
