#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const demo = resolve(repository, 'docs/event/demos/nexent')

const integrations = [
  {
    version: '2.5.0',
    tagCommit: '86d75923dd549008d725d83db18a93d654c84fb0',
    downloadBytes: 58167456,
    command: 'npm run accept:nexent',
  },
  {
    version: '2.5.1',
    tagCommit: 'b089f87cb61f0bf43f819bccbe8c0b96ece87213',
    downloadBytes: 58171357,
    command: 'npm run accept:nexent:2.5.1',
  },
]
const sharedExpectations = {
  node: '>=22',
  pnpm: '10.28.2',
  frontendLockSha256: 'b0f94bec1f48c80ec78ad083415910fa380d369d098f2517d1251e1538af0478',
  frontendTests: 27,
  pythonTests: 540,
  python: '3.11',
  excludeNewer: '2026-09-09T23:59:59Z',
  packages: [
    'pytest==9.1.1',
    'pytest-asyncio==1.4.0',
    'pydantic[email]==2.13.5',
    'fastapi==0.141.1',
    'python-dotenv==1.2.3',
    'runfold-event==0.1.0',
    'smolagents==1.23.0',
    'httpx==0.28.1',
  ],
}

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

const objectId = /^[0-9a-f]{40}$/

function verifyIntegration(expected) {
  const prefix = `integrations/nexent/v${expected.version}/`
  const integration = resolve(repository, prefix)
  const manifestPath = `${prefix}manifest.json`
  const sumsPath = `${prefix}SHA256SUMS`
  const seriesPath = `${prefix}series`
  const manifest = JSON.parse(read(manifestPath))
  const checksums = parseChecksums(sumsPath)
  const label = `Nexent v${expected.version}`

  assert.equal(manifest.schemaVersion, 3, `${label}: unsupported integration manifest schema`)
  assert.equal(manifest.upstream.version, `v${expected.version}`, `${label}: manifest version mismatch`)
  assert.equal(manifest.upstream.tagCommit, expected.tagCommit, `${label}: unexpected upstream tag commit`)
  assert.equal(
    manifest.acceptance.download.url,
    `https://github.com/ModelEngine-Group/nexent/archive/refs/tags/v${expected.version}.zip`,
    `${label}: unexpected download URL`,
  )
  assert.equal(
    manifest.acceptance.download.extractedDirectory,
    `nexent-${expected.version}`,
    `${label}: unexpected archive directory`,
  )
  assert.equal(manifest.acceptance.command, expected.command, `${label}: unexpected acceptance command`)
  for (const [name, value] of [
    ['upstream tag commit', manifest.upstream.tagCommit],
    ['upstream baseline tree', manifest.upstream.baselineTree],
    ['download baseline tree', manifest.acceptance.download.baselineTree],
    ['download result tree', manifest.acceptance.download.expectedTree],
    ['result source head', manifest.result.sourceHead],
    ['result tree', manifest.result.expectedTree],
  ]) assert.match(value, objectId, `${label}: invalid ${name}`)
  assert.notEqual(
    manifest.acceptance.download.baselineTree,
    manifest.acceptance.download.expectedTree,
    `${label}: patch result must differ from the download baseline`,
  )

  assert.equal(manifest.acceptance.node, sharedExpectations.node, `${label}: unexpected acceptance Node version`)
  assert.equal(manifest.acceptance.pnpm, sharedExpectations.pnpm, `${label}: unexpected acceptance pnpm version`)
  assert.equal(
    manifest.acceptance.frontendLockSha256,
    sharedExpectations.frontendLockSha256,
    `${label}: unexpected frontend lock hash`,
  )
  assert.match(manifest.acceptance.download.sha256, /^[0-9a-f]{64}$/, `${label}: invalid download hash`)
  assert.equal(manifest.acceptance.download.bytes, expected.downloadBytes, `${label}: unexpected download size`)
  assert.equal(
    manifest.acceptance.quick.frontendTests,
    sharedExpectations.frontendTests,
    `${label}: unexpected frontend acceptance count`,
  )
  assert.equal(manifest.acceptance.quick.externalServicesRequired, false, `${label}: quick acceptance must stay isolated`)
  assert.equal(manifest.acceptance.full.python, sharedExpectations.python, `${label}: unexpected Python version`)
  assert.equal(manifest.acceptance.full.pythonTests, sharedExpectations.pythonTests, `${label}: unexpected Python acceptance count`)
  assert.equal(manifest.acceptance.full.externalServicesRequired, false, `${label}: full acceptance must stay isolated`)
  assert.equal(
    manifest.acceptance.full.excludeNewer,
    sharedExpectations.excludeNewer,
    `${label}: unexpected Python dependency snapshot cutoff`,
  )
  assert.deepEqual(manifest.acceptance.full.packages, sharedExpectations.packages, `${label}: unexpected Python acceptance package set`)

  for (const relativePath of [manifestPath, sumsPath, seriesPath, `${prefix}README.md`, `${prefix}LICENSE`]) {
    assertFile(relativePath)
  }
  const readme = read(`${prefix}README.md`)
  assert.ok(readme.includes(`# Nexent v${expected.version} Event 人工验收`), `${label}: README title mismatch`)
  assert.ok(readme.includes(expected.command), `${label}: README must name its acceptance command`)

  for (const [listedPath, expectedHash] of checksums) {
    const relativePath = listedPath.startsWith(prefix) ? listedPath : `${prefix}${listedPath}`
    assertFile(relativePath)
    assert.equal(hash(relativePath), expectedHash, `${label}: checksum mismatch: ${listedPath}`)
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
    `${label}: SHA256SUMS must cover exactly the manifest and patch series artifacts`,
  )

  const patchFiles = manifest.patches.map((patch) => patch.file)
  assert.equal(new Set(patchFiles).size, patchFiles.length, `${label}: manifest patch paths must be unique`)
  assert.equal(manifest.result.commitCount, patchFiles.length, `${label}: result commit count must match patch count`)
  assert.deepEqual(
    read(seriesPath).split('\n').filter(Boolean),
    patchFiles,
    `${label}: series must list manifest patches in their supported application order`,
  )
  assert.deepEqual(
    readdirSync(resolve(integration, 'patches'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.patch'))
      .map((entry) => `patches/${entry.name}`)
      .sort(),
    [...patchFiles].sort(),
    `${label}: patches directory must contain exactly the manifest patch files`,
  )
  for (const patch of manifest.patches) {
    const path = resolve(integration, patch.file)
    assert.ok(existsSync(path), `${label}: missing manifest patch: ${patch.file}`)
    assert.equal(statSync(path).size, patch.bytes, `${label}: byte count mismatch: ${patch.file}`)
    assert.equal(hash(`${prefix}${patch.file}`), patch.sha256, `${label}: manifest hash mismatch: ${patch.file}`)
    const content = readFileSync(path, 'utf8')
    assert.match(content, new RegExp(`^From ${patch.sourceCommit} `), `${label}: source commit mismatch: ${patch.file}`)
    const subjectLine = content.split('\n').find((line) => line.startsWith('Subject: '))
    assert.ok(subjectLine, `${label}: missing subject: ${patch.file}`)
    assert.equal(
      subjectLine.replace(/^Subject: \[PATCH(?: \d+\/\d+)?\] /, ''),
      patch.subject,
      `${label}: subject mismatch: ${patch.file}`,
    )
    assert.match(
      content,
      /diff --git a\/frontend\/pnpm-lock\.yaml b\/frontend\/pnpm-lock\.yaml/,
      `${label}: patch must carry the frozen frontend lockfile`,
    )
    assert.match(
      content,
      /\+  "packageManager": "pnpm@10\.28\.2",/,
      `${label}: patch must pin its package manager`,
    )
  }
  assert.equal(
    manifest.patches.at(-1).sourceTree,
    manifest.result.expectedTree,
    `${label}: last patch tree must match the canonical result tree`,
  )
  return { patches: manifest.patches.length, checksums: checksums.size }
}

for (const relativePath of [
  'integrations/nexent/README.md',
  'scripts/nexent-acceptance.mjs',
  'docs/event/demos/nexent/README.md',
  'docs/event/demos/nexent/cover.jpg',
  'docs/event/demos/nexent/trajectory-restore-fork-demo.mp4',
]) assertFile(relativePath)

const catalog = read('integrations/nexent/README.md')
const verified = []
for (const expected of integrations) {
  assert.ok(
    catalog.includes('`v' + expected.version + '`') && catalog.includes(`(v${expected.version}/)`),
    `integrations/nexent/README.md must list v${expected.version}`,
  )
  verified.push({ version: expected.version, ...verifyIntegration(expected) })
}

const demoReadme = read('docs/event/demos/nexent/README.md')
for (const [file, expected] of [
  ['trajectory-restore-fork-demo.mp4', '21e1d5af6c975d59eb21472cfc43fbf89cb898d024238a71c8163ee0e078b36e'],
  ['cover.jpg', 'f42f9849a4d09893ada754c0084644bd7dd0aba945dd5e9291df6a8c559720fe'],
]) {
  assert.match(demoReadme, new RegExp(expected), `README hash missing: ${file}`)
  assert.equal(hash(`docs/event/demos/nexent/${file}`), expected, `Demo checksum mismatch: ${file}`)
}

const summary = verified
  .map((entry) => `v${entry.version}: ${entry.patches} ${entry.patches === 1 ? 'patch' : 'patches'}, ${entry.checksums} checksums`)
  .join('; ')
console.log(`Integration artifacts verified: ${summary}; 2 demo assets`)
