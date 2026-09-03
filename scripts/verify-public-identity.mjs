#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const legacyWord = ['per', 'ix'].join('')
const legacyLower = legacyWord.toLowerCase()
const maintainer = `${legacyWord[0].toUpperCase()}${legacyWord.slice(1)}.ai`
const textExtensions = new Set([
  '.css', '.html', '.js', '.jsx', '.json', '.lock', '.md', '.mjs', '.patch',
  '.py', '.sh', '.toml', '.ts', '.tsx', '.txt', '.yaml', '.yml',
])

function trackedAndUntrackedFiles() {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repository, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`)
  }
  return result.stdout.split('\0').filter(Boolean).sort()
}

function isHistoricalOrUpstream(path) {
  return path === 'docs/event/tasks.md'
    || path.startsWith('docs/event/tasks/')
    || path.startsWith('third_party/deepseek-harness/upstream/')
}

function isText(path) {
  const name = basename(path)
  return name === 'LICENSE' || name === 'NOTICE' || textExtensions.has(extname(name))
}

function isLegalNotice(path) {
  const name = basename(path).toLowerCase()
  return name === 'license' || name === 'notice' || name.startsWith('notice.')
}

function isAllowedReference(path, line) {
  const value = line.toLowerCase()
  if (isLegalNotice(path)) return true
  if (path === 'README.md') {
    return value.includes(`${legacyLower}.ai`)
      && (value.includes('maintained') || value.includes('copyright'))
  }
  if (path === 'docs/event/decisions.md') {
    return value.includes(`${legacyLower}.ai`)
      && (value.includes('维护') || value.includes('权利'))
  }
  if (path === 'packages/event/python/README.md') {
    return value.includes(`maintained by ${legacyLower}.ai`)
  }
  if (path === 'packages/event/python/pyproject.toml') {
    return value.trim() === `authors = [{ name = "${legacyLower}.ai" }]`
  }
  if (path === 'package.json'
    || path === 'packages/event/typescript/sdk/package.json'
    || path === 'packages/event/typescript/ui/trajectory/package.json') {
    return value.trim() === `"author": "${legacyLower}.ai",`
  }
  if (path === 'packages/event/python/tests/package_consumer.py') {
    return value.includes(`${legacyLower}_event`)
  }
  if (path === 'tests/event/cross-language/fixtures/nexent-r33/README.md') {
    return value.includes(`${legacyLower}-ai/open-source/agent_platform/nexent`)
  }
  return false
}

const violations = []
let scannedFiles = 0
let allowedReferences = 0
for (const path of trackedAndUntrackedFiles()) {
  if (isHistoricalOrUpstream(path) || !isText(path)) continue
  const content = readFileSync(resolve(repository, path), 'utf8')
  scannedFiles += 1
  for (const [index, line] of content.split('\n').entries()) {
    if (!line.toLowerCase().includes(legacyLower)) continue
    if (isAllowedReference(path, line)) {
      allowedReferences += 1
      continue
    }
    violations.push(`${path}:${index + 1}: ${line.trim()}`)
  }
}

assert.deepEqual(
  violations,
  [],
  `legacy project identity found outside explicit legal, provenance, or negative-test allowances:\n${violations.join('\n')}`,
)

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repository, path), 'utf8'))
}

assert.equal(readJson('package.json').name, 'runfold')
assert.equal(readJson('package.json').author, maintainer)
const eventManifest = readJson('packages/event/typescript/sdk/package.json')
assert.equal(eventManifest.name, '@runfold/event')
assert.equal(eventManifest.author, maintainer)
const trajectoryManifest = readJson('packages/event/typescript/ui/trajectory/package.json')
assert.equal(
  trajectoryManifest.name,
  '@runfold/trajectory-ui',
)
assert.equal(trajectoryManifest.author, maintainer)
assert.equal(
  readJson('apps/event/typescript/trajectory-demo/package.json').name,
  '@runfold/trajectory-demo',
)
assert.equal(
  readJson('schemas/event/v0/session-event.schema.json').$id,
  'urn:runfold:event:v0:session-event',
)
assert.equal(
  readJson('schemas/event/v0/session-header.schema.json').$id,
  'urn:runfold:event:v0:session-header',
)

const pythonManifest = readFileSync(
  resolve(repository, 'packages/event/python/pyproject.toml'),
  'utf8',
)
assert.match(pythonManifest, /^name = "runfold-event"$/m)
assert.ok(existsSync(resolve(repository, 'packages/event/python/src/runfold/event/__init__.py')))
assert.ok(!existsSync(resolve(
  repository,
  `packages/event/python/src/${legacyLower}_event`,
)))
assert.match(readFileSync(resolve(repository, 'README.md'), 'utf8'), /^# Runfold$/m)

console.log(
  `Runfold public identity verification passed (${scannedFiles} text files; `
  + `${allowedReferences} explicit ownership, provenance, or negative-test references)`,
)
