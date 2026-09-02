/**
 * Verify that every retained DeepSeek Harness file under
 * packages/event/typescript/packages/ is byte-identical to its counterpart in
 * the pinned snapshot under third_party/deepseek-harness/upstream/, except for
 * the files listed in ALLOWED_DIFFERENCES, which must still exist upstream.
 *
 * Usage: node scripts/verify-upstream-identity.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const retainedRoot = join(root, 'packages/event/typescript/packages')
const upstreamRoot = join(root, 'third_party/deepseek-harness/upstream/packages')
const skipDirectories = new Set(['node_modules', 'lib', 'dist'])

/**
 * Retained files that intentionally differ from upstream. Every entry needs a
 * reason recorded in packages/event/typescript/README.md ("Necessary local
 * changes"). Adding an entry here without that record is a review failure.
 */
const ALLOWED_DIFFERENCES = new Set([
  // npm workspaces: workspace:^ references replaced by published versions
  'core/session/package.json',
  'session/session-persistence/package.json',
  'session/session-persistence-jsonl/package.json',
  // TypeScript configs: monorepo project references removed
  'core/session/tsconfig.json',
  'session/session-persistence/tsconfig.json',
  'session/session-persistence-jsonl/tsconfig.json',
  'client/ui-trajectory/tsconfig.json',
])

async function walk(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipDirectories.has(entry.name)) files.push(...await walk(join(directory, entry.name)))
    } else if (entry.isFile()) {
      files.push(join(directory, entry.name))
    }
  }
  return files
}

const problems = []
const seenAllowed = new Set()
const retained = await walk(retainedRoot)

for (const file of retained) {
  const key = relative(retainedRoot, file).replaceAll('\\', '/')
  const upstream = join(upstreamRoot, key)
  let upstreamStat
  try {
    upstreamStat = await stat(upstream)
  } catch {
    problems.push(`${key}: no upstream counterpart (retained files must come from the pinned snapshot)`)
    continue
  }
  if (!upstreamStat.isFile()) {
    problems.push(`${key}: upstream counterpart is not a file`)
    continue
  }
  const [left, right] = await Promise.all([readFile(file), readFile(upstream)])
  const identical = left.equals(right)
  if (ALLOWED_DIFFERENCES.has(key)) {
    seenAllowed.add(key)
    if (identical) problems.push(`${key}: listed as an allowed difference but is identical to upstream; remove it from ALLOWED_DIFFERENCES`)
  } else if (!identical) {
    problems.push(`${key}: differs from upstream and is not an allowed difference`)
  }
}

for (const key of ALLOWED_DIFFERENCES) {
  if (!seenAllowed.has(key)) problems.push(`${key}: allowed difference is not present in the retained tree`)
}

if (problems.length > 0) {
  console.error('Upstream identity check failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(`Upstream identity verified: ${retained.length} retained files, ${ALLOWED_DIFFERENCES.size} documented differences`)
