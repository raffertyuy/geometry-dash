import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage', '.vite', '**/*.js'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'phaser/*'],
              message:
                'Only modules under src/renderer/ and src/phaser/ may import from Phaser. Pure-logic modules must remain framework-agnostic (Constitution Principle III).',
            },
            {
              group: [
                '**/runner-engine/!(index)',
                '**/lane-state/!(index)',
                '**/input-adapter/!(index)',
                '**/renderer/!(index)',
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
    // Allow Phaser imports inside the integration layer.
    files: ['src/renderer/**/*.ts', 'src/phaser/**/*.ts', 'src/main.ts'],
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
              ],
              message:
                'Import from a module via its index.ts only - do not reach into internal files.',
            },
          ],
        },
      ],
    },
  },
);
