import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', '.local/**', '.angular/**', 'out-tsc/**'] },
  {
    files: ['projects/**/*.ts', 'src/**/*.ts', 'tests/**/*.ts', 'e2e/**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: {
      curly: ['error', 'all'],
      'max-statements-per-line': ['error', { max: 1 }],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
