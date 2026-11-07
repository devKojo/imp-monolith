import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const unsafeRawQueryBans = ['$queryRawUnsafe', '$executeRawUnsafe'].map((name) => ({
  selector: `MemberExpression[property.name='${name}']`,
  message: `${name} is banned (R-STK-05); use the tagged-template $queryRaw / $executeRaw.`,
}));

const privilegedClientBans = ['createPlatformDb', 'createSystemDb'].map((name) => ({
  selector: `Identifier[name='${name}']`,
  message: `${name} may only be used in modules/administration, shared/messaging, profiles or a composition root (R-TEN-03).`,
}));

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/coverage/**',
      '.idea/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['**/*.{ts,js,vue}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['apps/api/**/*.ts', '*.config.{js,ts}', 'apps/*/*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // R-STK-05: unsafe raw queries banned. R-TEN-03: platformDb/systemDb only where allowed.
    files: ['apps/api/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...unsafeRawQueryBans] },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      'apps/api/src/shared/database/**',
      'apps/api/src/modules/administration/**',
      'apps/api/src/shared/messaging/**',
      'apps/api/src/profiles/**',
      'apps/api/src/main.ts',
      'apps/api/src/app.ts',
      '**/*.test.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...unsafeRawQueryBans, ...privilegedClientBans],
    },
  },
  {
    // R-STK-01: no explicit any inside modules.
    files: ['apps/api/src/modules/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    // The shared UI layer runs in the browser (and SSR); its scripts and config run in Node.
    files: ['packages/ui/app/**/*.{ts,vue}', 'packages/ui/tests/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // TypeScript optional props with withDefaults are the idiom here.
      'vue/require-default-prop': 'off',
    },
  },
  {
    files: ['packages/ui/scripts/**/*.ts', 'packages/ui/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Gallery pages are Nuxt route files (single-word names) that use Nuxt auto-imports.
    files: ['packages/ui/app/gallery/pages/**/*.vue'],
    languageOptions: { globals: { useHead: 'readonly' } },
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    files: ['packages/ui/tests/**/*.ts'],
    rules: { 'vue/one-component-per-file': 'off' },
  },
  {
    files: ['apps/web/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Nuxt auto-imports used in the web app.
        $fetch: 'readonly',
        useHead: 'readonly',
        useRoute: 'readonly',
        useRouter: 'readonly',
        useState: 'readonly',
        useAsyncData: 'readonly',
        useRuntimeConfig: 'readonly',
        navigateTo: 'readonly',
        definePageMeta: 'readonly',
        defineNuxtPlugin: 'readonly',
        defineNuxtRouteMiddleware: 'readonly',
        useCountdown: 'readonly',
        useClearOnInput: 'readonly',
      },
    },
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    files: ['**/*.{test,spec}.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  prettier,
);
