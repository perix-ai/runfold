import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const typesRoot = resolve(root, 'lib/types')
const targets = new Map([
  ['@deepseek-ai/dsh-brand', 'runtime/src/brand.d.ts'],
  ['@deepseek-ai/dsh-util-values', 'runtime/src/values.d.ts'],
  ['@deepseek-ai/dsh-timeout', 'runtime/src/timeout.d.ts'],
  ['@deepseek-ai/dsh-llm/brand', 'runtime/src/messages.d.ts'],
  ['@deepseek-ai/dsh-llm/types', 'runtime/src/messages.d.ts'],
  ['@deepseek-ai/dsh-llm', 'runtime/src/messages.d.ts'],
  ['@deepseek-ai/dsh-session', 'packages/core/session/src/index.d.ts'],
  ['@deepseek-ai/dsh-session/types', 'packages/core/session/src/types.d.ts'],
  ['@deepseek-ai/dsh-session/chunk-rows', 'packages/core/session/src/chunk-rows.d.ts'],
  ['@deepseek-ai/dsh-session/surface', 'packages/core/session/src/surface.d.ts'],
  ['@deepseek-ai/dsh-session-persistence', 'packages/session/session-persistence/src/index.d.ts'],
  ['@deepseek-ai/dsh-session-persistence-jsonl', 'packages/session/session-persistence-jsonl/src/index.d.ts'],
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
  if (file.replaceAll('\\', '/').includes('/types/sdk/src/')) {
    text = `/// <reference types="node" />\n/// <reference lib="esnext.disposable" />\n${text}`
  }
  await writeFile(file, text)
}
