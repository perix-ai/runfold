import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

function source(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@perix\/event-ui$/, replacement: source('./packages/event/typescript/ui/trajectory/src/index.ts') },
      { find: /^@perix\/event-sdk\/session\/types$/, replacement: source('./packages/event/typescript/sdk/src/session-types.ts') },
      { find: /^@perix\/event-sdk\/session\/chunk-rows$/, replacement: source('./packages/event/typescript/sdk/src/session-chunk-rows.ts') },
      { find: /^@perix\/event-sdk\/session\/surface$/, replacement: source('./packages/event/typescript/sdk/src/session-surface.ts') },
      { find: /^@perix\/event-sdk\/session$/, replacement: source('./packages/event/typescript/sdk/src/session.ts') },
      { find: /^@perix\/event-sdk\/persistence$/, replacement: source('./packages/event/typescript/sdk/src/persistence.ts') },
      { find: /^@perix\/event-sdk\/persistence-jsonl$/, replacement: source('./packages/event/typescript/sdk/src/persistence-jsonl.ts') },
      { find: /^@perix\/event-sdk\/runtime$/, replacement: source('./packages/event/typescript/runtime/src/host.ts') },
      { find: /^@perix\/event-sdk\/messages$/, replacement: source('./packages/event/typescript/sdk/src/messages.ts') },
      { find: /^@perix\/event-sdk$/, replacement: source('./packages/event/typescript/sdk/src/index.ts') },
    ],
  },
  test: {
    setupFiles: [source('./packages/event/typescript/test-support/jsdom-storage.ts')],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
    ],
  },
})
