import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const bundledPackages = [
  '@perix/event-sdk/runtime',
]

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@perix\/event-sdk\/runtime$/, replacement: source('../runtime/src/host.ts') },
    ],
  },
  build: {
    outDir: 'lib',
    emptyOutDir: true,
    lib: {
      entry: {
        index: source('./src/index.ts'),
        session: source('./src/session.ts'),
        'session-types': source('./src/session-types.ts'),
        'session-chunk-rows': source('./src/session-chunk-rows.ts'),
        'session-surface': source('./src/session-surface.ts'),
        persistence: source('./src/persistence.ts'),
        'persistence-jsonl': source('./src/persistence-jsonl.ts'),
        runtime: source('./src/runtime.ts'),
        messages: source('./src/messages.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: id => {
        if (bundledPackages.some(name => id === name || id.startsWith(`${name}/`))) return false
        return id.startsWith('node:') || (!id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'))
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
})
