import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import pluginVue from 'eslint-plugin-vue'
import vueStandard from '@vue/eslint-config-standard'

const isProduction = process.env.NODE_ENV === 'production'
const motrixGlobals = {
  appId: 'readonly',
  __static: 'readonly'
}

export default [
  {
    name: 'motrix/ignores',
    ignores: [
      '**/*.d.ts',
      'src/renderer/components/Icons/*.ts',
      'src/shared/locales/*',
      '!src/shared/locales/all.js',
      '!src/shared/locales/app.js',
      '!src/shared/locales/index.js',
      '!src/shared/locales/LocaleManager.js'
    ]
  },
  ...pluginVue.configs['flat/essential'],
  ...vueStandard,
  {
    name: 'motrix/typescript',
    files: ['src/**/*.{ts,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  },
  {
    name: 'motrix/vue-typescript',
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue']
      }
    }
  },
  {
    name: 'motrix/project-rules',
    files: ['src/**/*.{js,mjs,cjs,ts,mts,cts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...motrixGlobals
      }
    },
    rules: {
      'no-console': 'off',
      'no-debugger': isProduction ? 'warn' : 'off',
      'vue/script-indent': ['error', 2, { baseIndent: 1 }],
      '@stylistic/indent': 'off',
      '@stylistic/quote-props': 'off',
      'object-shorthand': 'off',
      'vue/no-constant-condition': 'off',
      'vue/operator-linebreak': 'off',
      'vue/array-bracket-spacing': 'off',
      'vue/space-infix-ops': 'off',
      'vue/quote-props': 'off'
    }
  },
  {
    name: 'motrix/vue-indent-override',
    files: ['src/**/*.vue'],
    rules: {
      indent: 'off',
      '@stylistic/indent': 'off'
    }
  }
]
