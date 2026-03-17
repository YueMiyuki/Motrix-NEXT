import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(dirname, 'src/renderer/pages/index')
const outDir = path.resolve(dirname, 'dist/electron')

export default defineConfig({
  root: rootDir,
  base: '',
  plugins: [
    vue({
      template: {
        compilerOptions: {
          compatConfig: {
            MODE: 2
          }
        }
      }
    }),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(dirname, 'static/**/*'),
          dest: 'static'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src/renderer'),
      '@shared': path.resolve(dirname, 'src/shared'),
      '@static': path.resolve(dirname, 'static'),
      vue: '@vue/compat',
      'electron': path.resolve(dirname, 'src/renderer/shims/electron.ts'),
      'electron-is': path.resolve(dirname, 'src/renderer/shims/electron-is.ts')
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/components/Theme/Variables.scss";',
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'slash-div', 'function-units']
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 9080,
    strictPort: true
  },
  build: {
    outDir,
    emptyOutDir: false,
    sourcemap: false,
    chunkSizeWarningLimit: 2000
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
  }
})
