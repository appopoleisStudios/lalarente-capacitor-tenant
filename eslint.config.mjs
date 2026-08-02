import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'build/**',
      '*.config.js',
      'supabase/functions/**',
      'admin/**',
    ],
  },
  ...compat.extends('expo'),
  // Node.js overrides for the CLI/scripts directory (run with `node`, not in
  // the RN/Expo runtime). MUST come after ...compat.extends('expo') — in flat
  // config the LAST matching rule value wins, so this block's settings would
  // otherwise be overridden by the expo preset.
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        AbortController: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      // load-env.mjs resolves keys dynamically (process.env[key]); that's the
      // point of a config loader and is safe for Node CLI tooling.
      'expo/no-dynamic-env-var': 'off',
    },
  },
];
