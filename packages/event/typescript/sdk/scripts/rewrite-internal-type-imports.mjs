import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const typesRoot = resolve(root, 'lib/types')
const targets = new Map([
  ['@runfold/event/runtime', 'runtime/src/host.d.ts'],
])
const upstreamProvenance = new Map([
  ['@module @deepseek-ai/dsh-session-persistence-jsonl', 'Upstream: packages/session/session-persistence-jsonl/src/index.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session-persistence/coordinator', 'Upstream: packages/session/session-persistence/src/coordinator.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session-persistence/preparations', 'Upstream: packages/session/session-persistence/src/preparations.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session-persistence/write-behind', 'Upstream: packages/session/session-persistence/src/write-behind.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session-persistence', 'Upstream: packages/session/session-persistence/src/index.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session/known-event-types', 'Upstream: packages/core/session/src/known-event-types.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session/chunk-rows', 'Upstream: packages/core/session/src/chunk-rows.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session/preparation', 'Upstream: packages/core/session/src/preparation.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session/repair', 'Upstream: packages/core/session/src/repair.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session/surface', 'Upstream: packages/core/session/src/surface.ts @ dd6322d6'],
  ['@module @deepseek-ai/dsh-session', 'Upstream: packages/core/session/src/index.ts @ dd6322d6'],
  ['`@deepseek-ai/dsh-scope`', 'the pinned DeepSeek Harness scope host'],
  ['`@deepseek-ai/dsh-attachment`', 'the pinned DeepSeek Harness attachment contract'],
  ['`@deepseek-ai/dsh-llm`', 'the pinned DeepSeek Harness LLM contract'],
])

async function declarations(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await declarations(path))
    else if (entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files
}

for (const file of await declarations(typesRoot)) {
  let text = await readFile(file, 'utf8')
  for (const [specifier, target] of targets) {
    let replacement = relative(dirname(file), resolve(typesRoot, target))
      .replaceAll('\\', '/')
      .replace(/\.d\.ts$/, '.js')
    if (!replacement.startsWith('.')) replacement = `./${replacement}`
    text = text
      .replaceAll(`'${specifier}'`, `'${replacement}'`)
      .replaceAll(`"${specifier}"`, `"${replacement}"`)
  }
  for (const [upstream, provenance] of upstreamProvenance) {
    text = text.replaceAll(upstream, provenance)
  }
  if (text.includes('@deepseek-ai/')) {
    throw new Error(`unmapped DeepSeek Harness reference in ${file}`)
  }
  if (file.replaceAll('\\', '/').includes('/types/sdk/src/')) {
    text = `/// <reference types="node" />\n/// <reference lib="esnext.disposable" />\n${text}`
  }
  await writeFile(file, text)
}
