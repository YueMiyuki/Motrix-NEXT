import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import pluginVue from 'eslint-plugin-vue'
import vueStandard from '@vue/eslint-config-standard'
import prettierConfig from 'eslint-config-prettier'

const isProduction = process.env.NODE_ENV === 'production'
const motrixGlobals = {
  appId: 'readonly',
  __static: 'readonly',
}

export default [
  {
    name: 'motrix/ignores',
    ignores: [
      '**/*.d.ts',
      'src/shared/locales/*',
      '!src/shared/locales/all.ts',
      '!src/shared/locales/app.ts',
      '!src/shared/locales/index.ts',
      '!src/shared/locales/LocaleManager.ts',
    ],
  },
  ...pluginVue.configs['flat/essential'],
  ...vueStandard,
  prettierConfig,
  {
    name: 'motrix/typescript',
    files: ['src/**/*.{ts,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    name: 'motrix/vue-typescript',
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    name: 'motrix/project-rules',
    files: ['src/**/*.{js,mjs,cjs,ts,mts,cts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...motrixGlobals,
      },
    },
    rules: {
      'no-console': 'warn',
      'no-debugger': isProduction ? 'warn' : 'off',
      'object-shorthand': 'error',
      'vue/no-constant-condition': 'error',
    },
  },
  {
    name: 'motrix/shadcn-ui-overrides',
    files: ['src/renderer/components/ui/**/*.vue', 'src/renderer/components/ui/**/*.ts'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off',
      'symbol-description': 'off',
    },
  },
  {
    name: 'motrix/shadcn-usage-overrides',
    files: ['src/renderer/components/**/*.vue', 'src/renderer/pages/**/*.vue'],
    rules: {
      'vue/no-reserved-component-names': 'off',
    },
  },
]
