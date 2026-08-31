import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // `@ts-ignore` is allowed WITH a description, not banned. The two in
      // `layers/base/composables` suppress TS2589 that appears only under the
      // consumer forks' stricter typecheck, so `@ts-expect-error` would fail
      // in this repo while still being required downstream. Requiring the
      // description keeps the rule's real value: no silent suppressions.
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-ignore': 'allow-with-description',
        minimumDescriptionLength: 10,
      }],
    },
  },
  // ---------------------------------------------------------------------------
  // .vue files. Until 2026-08-30 NONE of the repo's 557 single-file components
  // were linted by anything: this config declared `files: ['**/*.ts']` only, so
  // eslint never even loaded a .vue file, and `@commonpub/layer` — which owns
  // 306 of them — had no `lint` script at all. `eslint src/` in the editor and
  // explainer packages was true and empty for the same reason: their components
  // live in `vue/`, not `src/`.
  //
  // Scope is `flat/essential` deliberately: those are the rules that catch
  // defects (duplicate keys, mutated props, unkeyed v-for), not the ones that
  // relitigate style. Style is Prettier's job here.
  ...vuePlugin.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Deliberately NOT the whole `tsPlugin.configs.recommended` set. The
      // plugin is registered so that inline `eslint-disable` comments naming
      // its rules resolve instead of erroring, and the same two rules the .ts
      // block enables are enabled here. Spreading the full recommended set
      // across 557 previously-unlinted components surfaced 19 findings of a
      // single stylistic rule and buried the five real ones; that is a
      // separate, deliberate piece of work, not a side effect of turning
      // .vue linting on.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Nuxt resolves components by file path, and this repo's convention
      // (CLAUDE.md, "Components: PascalCase.vue") produces single-word names
      // like `ContentCard.vue` on purpose. This rule fired 104 times and found
      // nothing wrong; the other five findings in the same run were all real.
      'vue/multi-word-component-names': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },

  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/*.config.ts',
    ],
  },
];
