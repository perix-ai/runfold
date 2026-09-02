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
      // Perix runtime modules replace the DSH utility packages for every retained source and test.
      { find: /^@deepseek-ai\/cordis$/, replacement: source('./packages/event/typescript/test-support/cordis-shim.ts') },
      { find: /^@deepseek-ai\/dsh-scope$/, replacement: source('./packages/event/typescript/test-support/scope-shim.ts') },
      { find: /^@deepseek-ai\/dsh-brand$/, replacement: source('./packages/event/typescript/runtime/src/brand.ts') },
      { find: /^@deepseek-ai\/dsh-util-values$/, replacement: source('./packages/event/typescript/runtime/src/values.ts') },
      { find: /^@deepseek-ai\/dsh-timeout$/, replacement: source('./packages/event/typescript/runtime/src/timeout.ts') },
      { find: /^@deepseek-ai\/dsh-llm(?:\/brand|\/types)?$/, replacement: source('./packages/event/typescript/runtime/src/messages.ts') },
      { find: /^@deepseek-ai\/dsh-session$/, replacement: source('./packages/event/typescript/packages/core/session/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-session\/invariant$/, replacement: source('./packages/event/typescript/packages/core/session/src/invariant.ts') },
      { find: /^@deepseek-ai\/dsh-session\/types$/, replacement: source('./packages/event/typescript/packages/core/session/src/types.ts') },
      { find: /^@deepseek-ai\/dsh-session\/chunk-rows$/, replacement: source('./packages/event/typescript/packages/core/session/src/chunk-rows.ts') },
      { find: /^@deepseek-ai\/dsh-session\/surface$/, replacement: source('./packages/event/typescript/packages/core/session/src/surface.ts') },
      { find: /^@deepseek-ai\/dsh-session-persistence$/, replacement: source('./packages/event/typescript/packages/session/session-persistence/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-session-persistence\/invariant$/, replacement: source('./packages/event/typescript/packages/session/session-persistence/src/invariant.ts') },
      { find: /^@deepseek-ai\/dsh-session-persistence-jsonl$/, replacement: source('./packages/event/typescript/packages/session/session-persistence-jsonl/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-session-persistence-jsonl\/invariant$/, replacement: source('./packages/event/typescript/packages/session/session-persistence-jsonl/src/invariant.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-conversation\/client$/, replacement: source('./packages/event/typescript/ui/trajectory/src/conversation-client.ts') },
      { find: /^@deepseek-ai\/dsh-client-locale\/src\/locales\/en\.ts$/, replacement: source('./packages/event/typescript/packages/client/locale/src/locales/en.ts') },
      { find: /^@deepseek-ai\/dsh-client-locale\/src\/locales\/zh\.ts$/, replacement: source('./packages/event/typescript/packages/client/locale/src/locales/zh.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-trajectory$/, replacement: source('./packages/event/typescript/packages/client/ui-trajectory/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-trajectory\/client$/, replacement: source('./packages/event/typescript/packages/client/ui-trajectory/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-trajectory\/invariant$/, replacement: source('./packages/event/typescript/packages/client/ui-trajectory/src/invariant.ts') },
    ],
  },
  ssr: {
    noExternal: ['@deepseek-ai/dsh-client-ui-primitives'],
  },
  test: {
    setupFiles: ['./packages/event/typescript/test-support/jsdom-storage.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
      // Monorepo code-generation contract, not Session runtime behavior.
      'packages/event/typescript/packages/core/session/tests/gen-persistence-catalog.spec.ts',
      // Cordis host mechanisms not retained: scope-filtered dispatch, the Typert lookup
      // registry, and the invariants diagnostic plugin (see docs/event/tasks.md R17, R20).
      'packages/event/typescript/packages/core/session/tests/scoped.spec.ts',
      'packages/event/typescript/packages/core/session/tests/typert.spec.ts',
      'packages/event/typescript/packages/core/session/tests/invariant.spec.ts',
      // DSH ModuleLoader packaging contract; the standalone extraction uses Vite ESM.
      'packages/event/typescript/packages/client/ui-trajectory/tests/client-bundle.client.spec.ts',
      // Full DSH shell/slot integration; covered here by the standalone boundary test.
      'packages/event/typescript/packages/client/ui-trajectory/tests/views.client.spec.tsx',
    ],
  },
})
