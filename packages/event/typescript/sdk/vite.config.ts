import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const bundledPackages = [
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-persistence',
  '@deepseek-ai/dsh-session-persistence-jsonl',
]

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@deepseek-ai\/dsh-session\/types$/, replacement: source('../packages/core/session/src/types.ts') },
      { find: /^@deepseek-ai\/dsh-session\/invariant$/, replacement: source('../packages/core/session/src/invariant.ts') },
      { find: /^@deepseek-ai\/dsh-session\/chunk-rows$/, replacement: source('../packages/core/session/src/chunk-rows.ts') },
      { find: /^@deepseek-ai\/dsh-session\/surface$/, replacement: source('../packages/core/session/src/surface.ts') },
      { find: /^@deepseek-ai\/dsh-session$/, replacement: source('../packages/core/session/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-session-persistence\/invariant$/, replacement: source('../packages/session/session-persistence/src/invariant.ts') },
      { find: /^@deepseek-ai\/dsh-session-persistence$/, replacement: source('../packages/session/session-persistence/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-session-persistence-jsonl\/invariant$/, replacement: source('../packages/session/session-persistence-jsonl/src/invariant.ts') },
      { find: /^@deepseek-ai\/dsh-session-persistence-jsonl$/, replacement: source('../packages/session/session-persistence-jsonl/src/index.ts') },
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
        'session-invariant': source('./src/session-invariant.ts'),
        'session-chunk-rows': source('./src/session-chunk-rows.ts'),
        'session-surface': source('./src/session-surface.ts'),
        persistence: source('./src/persistence.ts'),
        'persistence-invariant': source('./src/persistence-invariant.ts'),
        'persistence-jsonl': source('./src/persistence-jsonl.ts'),
        'persistence-jsonl-invariant': source('./src/persistence-jsonl-invariant.ts'),
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
