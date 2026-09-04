#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
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

for (const relativePath of [
  manifestPath,
  sumsPath,
  seriesPath,
  'integrations/nexent/README.md',
  'integrations/nexent/v2.5.0/README.md',
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
assert.deepEqual(
  read(seriesPath).split('\n').filter(Boolean),
  patchFiles,
  'series must list manifest patches in their supported application order',
)
for (const patch of manifest.patches) {
  const path = resolve(integration, patch.file)
  assert.ok(existsSync(path), `missing manifest patch: ${patch.file}`)
  assert.equal(statSync(path).size, patch.bytes, `byte count mismatch: ${patch.file}`)
  assert.equal(hash(`integrations/nexent/v2.5.0/${patch.file}`), patch.sha256, `manifest hash mismatch: ${patch.file}`)
}

const demoReadme = read('docs/event/demos/nexent/README.md')
for (const [file, expected] of [
  ['trajectory-restore-fork-demo.mp4', '21e1d5af6c975d59eb21472cfc43fbf89cb898d024238a71c8163ee0e078b36e'],
  ['cover.jpg', 'f42f9849a4d09893ada754c0084644bd7dd0aba945dd5e9291df6a8c559720fe'],
]) {
  assert.match(demoReadme, new RegExp(expected), `README hash missing: ${file}`)
  assert.equal(hash(`docs/event/demos/nexent/${file}`), expected, `Demo checksum mismatch: ${file}`)
}

console.log(`Integration artifacts verified: ${manifest.patches.length} patches, ${checksums.size} checksums, 2 demo assets`)
