import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sdkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = resolve(sdkRoot, 'lib')
const namespaces = [
  ['@deepseek-ai/dsh-session-persistence-jsonl', '@perix/event-sdk/persistence-jsonl'],
  ['@deepseek-ai/dsh-session-persistence', '@perix/event-sdk/persistence'],
  ['@deepseek-ai/dsh-session/types', '@perix/event-sdk/session/types'],
  ['@deepseek-ai/dsh-session', '@perix/event-sdk/session'],
]

async function generatedFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await generatedFiles(path))
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files
}

for (const file of await generatedFiles(outputRoot)) {
  let content = await readFile(file, 'utf8')
  for (const [upstream, perix] of namespaces) {
    content = content.replaceAll(upstream, perix)
  }
  await writeFile(file, content)
}

