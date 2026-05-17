import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROBLEM_SOURCES } from './sources';

const REPO_ROOT = resolve(__dirname, '..', '..');

describe('PROBLEM_SOURCES well-formedness', () => {
  it('contains at least 2 sources', () => {
    expect(PROBLEM_SOURCES.length).toBeGreaterThanOrEqual(2);
  });

  it('every source has a well-formed https:// URL', () => {
    for (const s of PROBLEM_SOURCES) {
      expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('every source has a non-empty attribution string', () => {
    for (const s of PROBLEM_SOURCES) {
      expect(s.attribution.length).toBeGreaterThan(0);
    }
  });

  it('all source ids are unique', () => {
    const ids = new Set(PROBLEM_SOURCES.map((s) => s.id));
    expect(ids.size).toBe(PROBLEM_SOURCES.length);
  });

  it('every source has license set to CC BY 4.0', () => {
    for (const s of PROBLEM_SOURCES) {
      expect(s.license).toBe('CC BY 4.0');
    }
  });

  it('every source has a non-empty name', () => {
    for (const s of PROBLEM_SOURCES) {
      expect(s.name.length).toBeGreaterThan(0);
    }
  });
});

describe('LICENSES.md consistency with PROBLEM_SOURCES', () => {
  it('every PROBLEM_SOURCES.name appears in LICENSES.md (catches added-source-without-attribution)', () => {
    const licensesPath = resolve(REPO_ROOT, 'LICENSES.md');
    const content = readFileSync(licensesPath, 'utf-8');
    for (const s of PROBLEM_SOURCES) {
      expect(content).toContain(s.name);
    }
  });
});
