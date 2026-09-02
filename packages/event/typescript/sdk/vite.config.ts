import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const bundledPackages = [
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-persistence',
  '@deepseek-ai/dsh-session-persistence-jsonl',
  // Resolved to ../runtime/src by the aliases below and bundled.
  '@deepseek-ai/dsh-brand',
  '@deepseek-ai/dsh-util-values',
  '@deepseek-ai/dsh-timeout',
  '@deepseek-ai/dsh-llm',
  '@perix/event-sdk/runtime',
]

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@perix\/event-sdk\/runtime$/, replacement: source('../runtime/src/host.ts') },
      { find: /^@deepseek-ai\/dsh-brand$/, replacement: source('../runtime/src/brand.ts') },
      { find: /^@deepseek-ai\/dsh-util-values$/, replacement: source('../runtime/src/values.ts') },
      { find: /^@deepseek-ai\/dsh-timeout$/, replacement: source('../runtime/src/timeout.ts') },
      { find: /^@deepseek-ai\/dsh-llm(?:\/brand|\/types)?$/, replacement: source('../runtime/src/messages.ts') },
      { find: /^@deepseek-ai\/dsh-session\/types$/, replacement: source('../packages/core/session/src/types.ts') },
      { find: /^@deepseek-ai\/dsh-session\/chunk-rows$/, replacement: source('../packages/core/session/src/chunk-rows.ts') },
      { find: /^@deepseek-ai\/dsh-session\/surface$/, replacement: source('../packages/core/session/src/surface.ts') },
      { find: /^@deepseek-ai\/dsh-session$/, replacement: source('../packages/core/session/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-session-persistence$/, replacement: source('../packages/session/session-persistence/src/index.ts') },
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
