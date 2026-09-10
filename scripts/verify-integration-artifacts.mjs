#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const integration = resolve(repository, 'integrations/nexent/v2.5.0')
const demo = resolve(repository, 'docs/event/demos/nexent')

function read(relativePath) {
  return readFileSync(resolve(repository, relativePath), 'utf8')
}

function hash(relativePath) {
  return createHash('sha256')
    .update(readFileSync(resolve(repository, relativePath)))
    .digest('hex')
}

function assertFile(relativePath) {
  assert.ok(existsSync(resolve(repository, relativePath)), `missing artifact: ${relativePath}`)
}

function parseChecksums(relativePath) {
  const entries = new Map()
  for (const line of read(relativePath).split('\n').filter(Boolean)) {
    const match = /^(\w{64})  (.+)$/.exec(line)
    assert.ok(match, `invalid SHA256SUMS line: ${line}`)
    assert.equal(entries.has(match[2]), false, `duplicate checksum entry: ${match[2]}`)
    entries.set(match[2], match[1])
  }
  return entries
}

const manifestPath = 'integrations/nexent/v2.5.0/manifest.json'
const sumsPath = 'integrations/nexent/v2.5.0/SHA256SUMS'
const seriesPath = 'integrations/nexent/v2.5.0/series'
const manifest = JSON.parse(read(manifestPath))
const checksums = parseChecksums(sumsPath)
const objectId = /^[0-9a-f]{40}$/

assert.equal(manifest.schemaVersion, 3, 'unsupported Nexent integration manifest schema')
for (const [label, value] of [
  ['upstream tag commit', manifest.upstream.tagCommit],
  ['upstream baseline tree', manifest.upstream.baselineTree],
  ['download baseline tree', manifest.acceptance.download.baselineTree],
  ['download result tree', manifest.acceptance.download.expectedTree],
  ['result source head', manifest.result.sourceHead],
  ['result tree', manifest.result.expectedTree],
]) assert.match(value, objectId, `invalid ${label}`)

assert.equal(manifest.acceptance.node, '>=22', 'unexpected Nexent acceptance Node version')
assert.equal(manifest.acceptance.pnpm, '10.28.2', 'unexpected Nexent acceptance pnpm version')
assert.match(manifest.acceptance.frontendLockSha256, /^[0-9a-f]{64}$/, 'invalid frontend lock hash')
assert.match(manifest.acceptance.download.sha256, /^[0-9a-f]{64}$/, 'invalid Nexent download hash')
assert.equal(manifest.acceptance.download.bytes, 58167456, 'unexpected Nexent download size')
assert.equal(manifest.acceptance.quick.frontendTests, 27, 'unexpected frontend acceptance count')
assert.equal(manifest.acceptance.quick.externalServicesRequired, false, 'quick acceptance must stay isolated')
assert.equal(manifest.acceptance.full.pythonTests, 540, 'unexpected Python acceptance count')
assert.equal(manifest.acceptance.full.externalServicesRequired, false, 'full acceptance must stay isolated')
assert.equal(
  manifest.acceptance.full.excludeNewer,
  '2026-09-09T23:59:59Z',
  'unexpected Python dependency snapshot cutoff',
)
assert.deepEqual(
  manifest.acceptance.full.packages,
  [
    'pytest==9.1.1',
    'pytest-asyncio==1.4.0',
    'pydantic[email]==2.13.5',
    'fastapi==0.141.1',
    'python-dotenv==1.2.3',
    'runfold-event==0.1.0',
    'smolagents==1.23.0',
    'httpx==0.28.1',
  ],
  'unexpected Python acceptance package set',
)

for (const relativePath of [
  manifestPath,
  sumsPath,
  seriesPath,
  'integrations/nexent/README.md',
  'integrations/nexent/v2.5.0/README.md',
  'scripts/nexent-acceptance.mjs',
  'docs/event/demos/nexent/README.md',
  'docs/event/demos/nexent/cover.jpg',
  'docs/event/demos/nexent/trajectory-restore-fork-demo.mp4',
]) assertFile(relativePath)

const checksumPrefix = 'integrations/nexent/v2.5.0/'
for (const [listedPath, expected] of checksums) {
  const relativePath = listedPath.startsWith(checksumPrefix)
    ? listedPath
    : `${checksumPrefix}${listedPath}`
  assertFile(relativePath)
  assert.equal(hash(relativePath), expected, `checksum mismatch: ${listedPath}`)
}

const manifestChecksumPaths = new Set([
  'README.md',
  'manifest.json',
  'series',
  ...manifest.patches.map((patch) => patch.file),
])
assert.deepEqual(
  new Set(checksums.keys()),
  manifestChecksumPaths,
  'SHA256SUMS must cover exactly the manifest and patch series artifacts',
)

const patchFiles = manifest.patches.map((patch) => patch.file)
assert.equal(new Set(patchFiles).size, patchFiles.length, 'manifest patch paths must be unique')
assert.equal(manifest.result.commitCount, patchFiles.length, 'result commit count must match patch count')
assert.deepEqual(
  read(seriesPath).split('\n').filter(Boolean),
  patchFiles,
  'series must list manifest patches in their supported application order',
)
assert.deepEqual(
  readdirSync(resolve(integration, 'patches'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.patch'))
    .map((entry) => `patches/${entry.name}`)
    .sort(),
  [...patchFiles].sort(),
  'patches directory must contain exactly the manifest patch files',
)
for (const patch of manifest.patches) {
  const path = resolve(integration, patch.file)
  assert.ok(existsSync(path), `missing manifest patch: ${patch.file}`)
  assert.equal(statSync(path).size, patch.bytes, `byte count mismatch: ${patch.file}`)
  assert.equal(hash(`integrations/nexent/v2.5.0/${patch.file}`), patch.sha256, `manifest hash mismatch: ${patch.file}`)
  const content = readFileSync(path, 'utf8')
  assert.match(content, new RegExp(`^From ${patch.sourceCommit} `), `source commit mismatch: ${patch.file}`)
  const subjectLine = content.split('\n').find((line) => line.startsWith('Subject: '))
  assert.ok(subjectLine, `missing subject: ${patch.file}`)
  assert.equal(
    subjectLine.replace(/^Subject: \[PATCH(?: \d+\/\d+)?\] /, ''),
    patch.subject,
    `subject mismatch: ${patch.file}`,
  )
  assert.match(
    content,
    /diff --git a\/frontend\/pnpm-lock\.yaml b\/frontend\/pnpm-lock\.yaml/,
    'Nexent patch must carry the frozen frontend lockfile',
  )
  assert.match(
    content,
    /\+  "packageManager": "pnpm@10\.28\.2",/,
    'Nexent patch must pin its package manager',
  )
}
assert.equal(
  manifest.patches.at(-1).sourceTree,
  manifest.result.expectedTree,
  'last patch tree must match the canonical result tree',
)

const demoReadme = read('docs/event/demos/nexent/README.md')
for (const [file, expected] of [
  ['trajectory-restore-fork-demo.mp4', '21e1d5af6c975d59eb21472cfc43fbf89cb898d024238a71c8163ee0e078b36e'],
  ['cover.jpg', 'f42f9849a4d09893ada754c0084644bd7dd0aba945dd5e9291df6a8c559720fe'],
]) {
  assert.match(demoReadme, new RegExp(expected), `README hash missing: ${file}`)
  assert.equal(hash(`docs/event/demos/nexent/${file}`), expected, `Demo checksum mismatch: ${file}`)
}

const patchLabel = manifest.patches.length === 1 ? 'patch' : 'patches'
console.log(`Integration artifacts verified: ${manifest.patches.length} ${patchLabel}, ${checksums.size} checksums, 2 demo assets`)
