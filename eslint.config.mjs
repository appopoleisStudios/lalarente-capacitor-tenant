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
  // ─── Epic 5 enforcement: shared utils + no hardcoded colors ─────────────────
  // Scoped to src/features/** only. Set to 'warn' until legacy violations are
  // migrated away; flip to 'error' once the tracked baseline reaches zero.
  // Baseline (2026-11-10): ~2209 hex colors, ~78 formatDate/Currency/getStatusColor
  // duplicates, ~73 toLocaleString currency calls.
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        // 1. Hex color literals — use src/shared/theme/colors instead
        {
          selector: "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message:
            "Hardcoded hex color. Use a token from src/shared/theme/colors (e.g. colors.primary[500]).",
        },
        // 2. Local formatDate / formatCurrency / getStatusColor re-declarations
        {
          selector:
            "FunctionDeclaration[id.name=/^(formatDate|formatCurrency|getStatusColors?|getStatusTextColor|getStatusBackgroundColor)$/]",
          message:
            "Import this utility from src/shared/utils instead of re-declaring it locally.",
        },
        {
          selector:
            "VariableDeclarator[id.name=/^(formatDate|formatCurrency|getStatusColors?|getStatusTextColor|getStatusBackgroundColor)$/] > ArrowFunctionExpression",
          message:
            "Import this utility from src/shared/utils instead of re-declaring it locally.",
        },
        // 3. toLocaleString for currency — use formatCurrency from src/shared/utils/format
        {
          selector:
            "CallExpression[callee.property.name='toLocaleString'] > Literal[value='en-ZA']",
          message:
            "Use formatCurrency or formatDate from src/shared/utils/format instead of inline toLocaleString.",
        },
      ],
    },
  },
];
