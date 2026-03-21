import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(dirname, 'src/renderer/pages/index')
const outDir = path.resolve(dirname, 'dist/outputs')
const staticDir = path.resolve(dirname, 'static')

const hasStaticAssets =
  fs.existsSync(staticDir) &&
  fs.statSync(staticDir).isDirectory() &&
  fs.readdirSync(staticDir, { recursive: true }).some((entry) => {
    const fullPath = path.join(staticDir, String(entry))
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()
  })

export default defineConfig({
  root: rootDir,
  base: '',
  plugins: [
    vue(),
    tailwindcss(),
    ...(hasStaticAssets
      ? [
          viteStaticCopy({
            targets: [
              {
                src: `${normalizePath(staticDir)}/**/*`,
                dest: 'static',
              },
            ],
            silent: true,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src/renderer'),
      '@shared': path.resolve(dirname, 'src/shared'),
      '@static': path.resolve(dirname, 'static'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
  },
  server: {
    host: '127.0.0.1',
    port: 9080,
    strictPort: true,
  },
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
})
