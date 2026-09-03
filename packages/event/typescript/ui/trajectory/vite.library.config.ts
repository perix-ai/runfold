import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { thirdPartyNotices } from './scripts/third-party-notices.mjs'

export default defineConfig({
  plugins: [thirdPartyNotices()],
  build: {
    outDir: 'lib',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
    },
  },
})
