import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

function source(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@runfold\/trajectory-ui$/, replacement: source('./packages/event/typescript/ui/trajectory/src/index.ts') },
      { find: /^@runfold\/event\/session\/types$/, replacement: source('./packages/event/typescript/sdk/src/session-types.ts') },
      { find: /^@runfold\/event\/session\/chunk-rows$/, replacement: source('./packages/event/typescript/sdk/src/session-chunk-rows.ts') },
      { find: /^@runfold\/event\/session\/surface$/, replacement: source('./packages/event/typescript/sdk/src/session-surface.ts') },
      { find: /^@runfold\/event\/session$/, replacement: source('./packages/event/typescript/sdk/src/session.ts') },
      { find: /^@runfold\/event\/persistence$/, replacement: source('./packages/event/typescript/sdk/src/persistence.ts') },
      { find: /^@runfold\/event\/persistence-jsonl$/, replacement: source('./packages/event/typescript/sdk/src/persistence-jsonl.ts') },
      { find: /^@runfold\/event\/runtime$/, replacement: source('./packages/event/typescript/runtime/src/host.ts') },
      { find: /^@runfold\/event\/messages$/, replacement: source('./packages/event/typescript/sdk/src/messages.ts') },
      { find: /^@runfold\/event$/, replacement: source('./packages/event/typescript/sdk/src/index.ts') },
    ],
  },
  test: {
    // Fixture-driven persistence/coordinator cases need headroom on shared CI runners.
    testTimeout: 20_000,
    setupFiles: [source('./packages/event/typescript/test-support/jsdom-storage.ts')],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
    ],
  },
})
