/**
 * Verify that every retained DeepSeek Harness file under
 * packages/event/typescript/packages/ is byte-identical to its counterpart in
 * the pinned snapshot under third_party/deepseek-harness/upstream/ after the
 * declared module-specifier rewrites, except for files in ALLOWED_DIFFERENCES.
 * Every declaration must resolve to a local file and match upstream text.
 *
 * Usage: node scripts/verify-upstream-identity.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const typescriptRoot = join(root, 'packages/event/typescript')
const retainedRoot = join(typescriptRoot, 'packages')
const upstreamRoot = join(root, 'third_party/deepseek-harness/upstream/packages')
const skipDirectories = new Set(['node_modules', 'lib', 'dist'])

/**
 * Import/export rewrites required to make retained source independently
 * buildable. Keys are retained paths relative to `retainedRoot`; targets are
 * files relative to `typescriptRoot`. The replacement specifier is calculated
 * from the importing file, so moving either side fails the identity check.
 *
 * Each entry must have the form:
 *
 *   ['core/example/src/index.ts', [
 *     { from: '@upstream/example', target: 'runtime/src/example.ts' },
 *   ]],
 */
const SPECIFIER_MAPPINGS = new Map([
  ['core/session/src/index.ts', [
    { from: '@deepseek-ai/dsh-brand', target: 'runtime/src/brand.ts' },
    { from: '@deepseek-ai/dsh-util-values', target: 'runtime/src/values.ts' },
    { from: '@deepseek-ai/dsh-llm', target: 'runtime/src/messages.ts' },
  ]],
  ['core/session/src/types.ts', [
    { from: '@deepseek-ai/dsh-brand', target: 'runtime/src/brand.ts' },
    { from: '@deepseek-ai/dsh-llm', target: 'runtime/src/messages.ts' },
    { from: '@deepseek-ai/dsh-util-values', target: 'runtime/src/values.ts' },
  ]],
  ['core/session/src/surface.ts', [
    { from: '@deepseek-ai/dsh-llm', target: 'runtime/src/messages.ts' },
  ]],
  ['core/session/src/repair.ts', [
    { from: '@deepseek-ai/dsh-brand', target: 'runtime/src/brand.ts' },
    { from: '@deepseek-ai/dsh-llm', target: 'runtime/src/messages.ts' },
    { from: '@deepseek-ai/dsh-util-values', target: 'runtime/src/values.ts' },
  ]],
  ['core/session/src/request-header.ts', [
    { from: '@deepseek-ai/dsh-llm', target: 'runtime/src/messages.ts' },
  ]],
  ['core/session/src/chunk-rows.ts', [
    { from: '@deepseek-ai/dsh-brand', target: 'runtime/src/brand.ts' },
    { from: '@deepseek-ai/dsh-llm/brand', target: 'runtime/src/messages.ts' },
    { from: '@deepseek-ai/dsh-llm', target: 'runtime/src/messages.ts' },
  ]],
  ['session/session-persistence/src/index.ts', [
    { from: '@deepseek-ai/dsh-session', target: 'packages/core/session/src/index.ts' },
  ]],
  ['session/session-persistence/src/coordinator.ts', [
    { from: '@deepseek-ai/dsh-session', target: 'packages/core/session/src/index.ts' },
    { from: '@deepseek-ai/dsh-timeout', target: 'runtime/src/timeout.ts' },
    { from: '@deepseek-ai/dsh-util-values', target: 'runtime/src/values.ts' },
  ]],
  ['session/session-persistence/src/preparations.ts', [
    { from: '@deepseek-ai/dsh-session', target: 'packages/core/session/src/index.ts' },
  ]],
  ['session/session-persistence/src/write-behind.ts', [
    { from: '@deepseek-ai/dsh-session', target: 'packages/core/session/src/index.ts' },
  ]],
  ['session/session-persistence/src/revision.ts', [
    { from: '@deepseek-ai/dsh-brand', target: 'runtime/src/brand.ts' },
  ]],
  ['session/session-persistence/src/errors.ts', [
    { from: '@deepseek-ai/dsh-session', target: 'packages/core/session/src/index.ts' },
  ]],
  ['session/session-persistence-jsonl/src/index.ts', [
    { from: '@deepseek-ai/dsh-session-persistence', target: 'packages/session/session-persistence/src/index.ts' },
    { from: '@deepseek-ai/dsh-session', target: 'packages/core/session/src/index.ts' },
  ]],
  ['session/session-persistence-jsonl/src/format.ts', [
    { from: '@deepseek-ai/dsh-session', target: 'packages/core/session/src/index.ts' },
    { from: '@deepseek-ai/dsh-session-persistence', target: 'packages/session/session-persistence/src/index.ts' },
  ]],
])

/**
 * Retained files that intentionally differ from upstream. Every entry needs a
 * reason recorded in packages/event/typescript/README.md ("Necessary local
 * changes"). Adding an entry here without that record is a review failure.
 */
const ALLOWED_DIFFERENCES = new Set([
  // Perix host seams: Cordis Service/Context, scope carrier, Typert lookup, and
  // Schemastery config replaced by EventHost (docs/event/tasks.md R17-R19)
  'core/session/src/index.ts',
  'core/session/src/types.ts',
  'session/session-persistence/src/index.ts',
  'session/session-persistence/src/coordinator.ts',
  'session/session-persistence-jsonl/src/index.ts',
  // TypeScript configs: monorepo project references removed (Vite reads them)
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

function moduleSpecifier(fromFile, target) {
  let specifier = relative(dirname(fromFile), resolve(typescriptRoot, target)).replaceAll('\\', '/')
  if (!specifier.startsWith('.')) specifier = `./${specifier}`
  return specifier
}

function replaceAllCount(content, search, replacement) {
  let count = 0
  let offset = 0
  while ((offset = content.indexOf(search, offset)) >= 0) {
    count += 1
    offset += search.length
  }
  return { content: content.replaceAll(search, replacement), count }
}

function rewriteUpstreamSpecifiers(file, key, upstreamContent, problems) {
  const mappings = SPECIFIER_MAPPINGS.get(key) ?? []
  let expected = upstreamContent.toString('utf8')
  for (const mapping of mappings) {
    const replacement = moduleSpecifier(file, mapping.target)
    let replacements = 0
    for (const quote of ["'", '"']) {
      const result = replaceAllCount(expected, `${quote}${mapping.from}${quote}`, `${quote}${replacement}${quote}`)
      expected = result.content
      replacements += result.count
    }
    if (replacements === 0) {
      problems.push(`${key}: declared specifier ${JSON.stringify(mapping.from)} does not occur in upstream`)
    }
  }
  return Buffer.from(expected)
}

const problems = []
const seenAllowed = new Set()
const seenMappingFiles = new Set()
const retained = await walk(retainedRoot)

for (const [key, mappings] of SPECIFIER_MAPPINGS) {
  const seenSpecifiers = new Set()
  for (const mapping of mappings) {
    if (seenSpecifiers.has(mapping.from)) {
      problems.push(`${key}: duplicate mapping for ${JSON.stringify(mapping.from)}`)
      continue
    }
    seenSpecifiers.add(mapping.from)
    const target = resolve(typescriptRoot, mapping.target)
    const localTarget = relative(typescriptRoot, target)
    if (localTarget === '..' || localTarget.startsWith(`..${sep}`) || isAbsolute(localTarget)) {
      problems.push(`${key}: mapping target ${JSON.stringify(mapping.target)} escapes the TypeScript root`)
      continue
    }
    try {
      if (!(await stat(target)).isFile()) problems.push(`${key}: mapping target ${JSON.stringify(mapping.target)} is not a file`)
    } catch {
      problems.push(`${key}: mapping target ${JSON.stringify(mapping.target)} does not exist`)
    }
  }
}

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
  const [left, upstreamContent] = await Promise.all([readFile(file), readFile(upstream)])
  if (SPECIFIER_MAPPINGS.has(key)) seenMappingFiles.add(key)
  const expected = rewriteUpstreamSpecifiers(file, key, upstreamContent, problems)
  const identical = left.equals(expected)
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

for (const key of SPECIFIER_MAPPINGS.keys()) {
  if (!seenMappingFiles.has(key)) problems.push(`${key}: specifier mapping file is not present in the retained tree`)
}

if (problems.length > 0) {
  console.error('Upstream identity check failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
const mappingCount = [...SPECIFIER_MAPPINGS.values()].reduce((count, mappings) => count + mappings.length, 0)
console.log([
  `Upstream identity verified: ${retained.length} retained files,`,
  `${ALLOWED_DIFFERENCES.size} documented differences,`,
  `${mappingCount} declared specifier mappings`,
].join(' '))
