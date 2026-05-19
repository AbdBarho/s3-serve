import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['build/**', 'coverage/**', 'examples/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    rules: {
      eqeqeq: 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      'prettier/prettier': [
        'error',
        {
          arrowParens: 'avoid',
          printWidth: 120,
          singleQuote: true,
          trailingComma: 'es5',
        },
      ],
    },
  },
]);
