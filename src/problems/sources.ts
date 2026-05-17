export interface ProblemSource {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly license: 'CC BY 4.0';
  readonly attribution: string;
}

/**
 * Canonical list of CC-BY-licensed sources from which hand-curated Basic
 * problems are adapted. Each Problem in pool-b.ts references one of these
 * by its `sourceRef` field; the credits panel + LICENSES.md both render
 * these entries for player + repo-level attribution.
 */
export const PROBLEM_SOURCES: readonly ProblemSource[] = [
  {
    id: 'openstax-cm-ch10',
    name: 'OpenStax Contemporary Mathematics, Chapter 10 Geometry',
    url: 'https://openstax.org/details/books/contemporary-mathematics',
    license: 'CC BY 4.0',
    attribution:
      'Basic problems adapted from OpenStax Contemporary Mathematics, Chapter 10. © OpenStax 2023, used under CC BY 4.0.',
  },
  {
    id: 'illustrative-math-k8',
    name: 'Illustrative Mathematics K-8 Geometry',
    url: 'https://illustrativemathematics.org/',
    license: 'CC BY 4.0',
    attribution:
      'Basic problems adapted from Illustrative Mathematics K-8 Geometry. © Illustrative Mathematics 2019, used under CC BY 4.0.',
  },
];
