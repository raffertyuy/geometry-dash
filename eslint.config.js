import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage', '.vite', '**/*.js'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*'],
              message:
                'Only modules under src/renderer/ and src/game/ may import from Three.js. Pure-logic modules must remain framework-agnostic (Constitution Principle III).',
            },
            {
              group: [
                '**/runner-engine/!(index)',
                '**/lane-state/!(index)',
                '**/input-adapter/!(index)',
                '**/renderer/!(index)',
                '**/leaderboard/!(index)',
              ],
              message:
                'Import from a module via its index.ts only - do not reach into internal files (Constitution Principle III).',
            },
          ],
        },
      ],
    },
  },
  {
    // Allow Three.js imports inside the integration layer.
    files: ['src/renderer/**/*.ts', 'src/game/**/*.ts', 'src/main.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/runner-engine/!(index)',
                '**/lane-state/!(index)',
                '**/input-adapter/!(index)',
                '**/renderer/!(index)',
                '**/leaderboard/!(index)',
              ],
              message:
                'Import from a module via its index.ts only - do not reach into internal files.',
            },
          ],
        },
      ],
    },
  },
  {
    // Worker code: pure-logic-only. May import shared types + config; MUST
    // NOT import Three.js, the renderer, the game-loop, or any DOM-facing module.
    files: ['src/worker/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*'],
              message:
                'src/worker/* runs on Cloudflare Workers — no Three.js / no DOM (Constitution Principle III).',
            },
            {
              group: [
                '**/renderer/*',
                '**/game/*',
                '**/runner-engine/*',
                '**/lane-state/*',
                '**/input-adapter/*',
                '**/leaderboard/*',
              ],
              message:
                'src/worker/* must only depend on src/shared/* and its own folder.',
            },
          ],
        },
      ],
    },
  },
);
