import tseslint from 'typescript-eslint';
import pluginQuery from '@tanstack/eslint-plugin-query';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/drizzle/**'],
  },
  ...tseslint.configs.recommended,
  ...pluginQuery.configs['flat/recommended'],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
    },
  },
);
