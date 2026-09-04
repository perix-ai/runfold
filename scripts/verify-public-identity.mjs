#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Split the legacy name so this scanner does not flag its own source text.
const legacyWord = ['per', 'ix'].join('')
const legacyLower = legacyWord.toLowerCase()
const projectMaintainer = `${legacyWord[0].toUpperCase()}${legacyWord.slice(1)}.ai`
const copyrightHolder = 'Heiki Scott'
const publicRepository = 'https://github.com/' + legacyLower + '-ai/runfold'
const publicHomepage = publicRepository + '#readme'
const publicIssues = publicRepository + '/issues'
const legacyTechnicalTokens = [
  `@${legacyLower}/`,
  `${legacyLower}_event`,
  `${legacyLower}-event`,
  `${legacyLower}_demo_`,
  `${legacyLower}.ai/schemas`,
]
const plainIdentityDocuments = new Set([
  'CONTRIBUTING.md',
  'COPYRIGHT.md',
  'OPEN_SOURCE_POLICY.md',
  'README.md',
  'docs/event/decisions.md',
  'packages/event/python/README.md',
])
const publicMetadataDocuments = new Set([
  'packages/event/python/pyproject.toml',
  'packages/event/typescript/sdk/package.json',
  'packages/event/typescript/ui/trajectory/package.json',
])
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

function isAllowedNegativeTest(path, line) {
  return path === 'packages/event/python/tests/package_consumer.py'
    && line.toLowerCase().includes(`${legacyLower}_event`)
}

function isAllowedReference(path, line) {
  const value = line.toLowerCase()
  if (isLegalNotice(path)) return true
  if (plainIdentityDocuments.has(path)) return true
  if (publicMetadataDocuments.has(path) && value.includes('github.com/perix-ai/runfold')) {
    return true
  }
  if (path === 'scripts/verify-public-identity.mjs'
    && value.includes('github.com/perix-ai/runfold')) {
    return true
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
    const value = line.toLowerCase()
    const hasTechnicalIdentity = legacyTechnicalTokens.some(token => value.includes(token))
    if (hasTechnicalIdentity && !isAllowedNegativeTest(path, line)) {
      violations.push(`${path}:${index + 1}: ${line.trim()}`)
      continue
    }
    if (hasTechnicalIdentity) {
      allowedReferences += 1
      continue
    }
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
assert.equal(readJson('package.json').author, copyrightHolder)
const eventManifest = readJson('packages/event/typescript/sdk/package.json')
assert.equal(eventManifest.name, '@runfold/event')
assert.equal(eventManifest.author, copyrightHolder)
assert.deepEqual(eventManifest.repository, {
  type: 'git',
  url: 'https://github.com/perix-ai/runfold.git',
  directory: 'packages/event/typescript/sdk',
})
assert.equal(eventManifest.homepage, publicHomepage)
assert.equal(eventManifest.bugs.url, publicIssues)
assert.deepEqual(eventManifest.keywords, [
  'agent',
  'durable-execution',
  'event-sourcing',
  'trajectory',
])
assert.deepEqual(eventManifest.publishConfig, { access: 'public' })
const trajectoryManifest = readJson('packages/event/typescript/ui/trajectory/package.json')
assert.equal(
  trajectoryManifest.name,
  '@runfold/trajectory-ui',
)
assert.equal(trajectoryManifest.author, copyrightHolder)
assert.deepEqual(trajectoryManifest.repository, {
  type: 'git',
  url: 'https://github.com/perix-ai/runfold.git',
  directory: 'packages/event/typescript/ui/trajectory',
})
assert.equal(trajectoryManifest.homepage, publicHomepage)
assert.equal(trajectoryManifest.bugs.url, publicIssues)
assert.deepEqual(trajectoryManifest.keywords, [
  'agent',
  'trajectory',
  'trajectory-ui',
  'react',
])
assert.deepEqual(trajectoryManifest.publishConfig, { access: 'public' })
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
assert.match(pythonManifest, /^authors = \[{ name = "Heiki Scott" }]$/m)
assert.match(pythonManifest, /^\[project\.urls\]$/m)
assert.match(pythonManifest, new RegExp('^Homepage = "' + publicHomepage + '"$', 'm'))
assert.match(pythonManifest, new RegExp('^Repository = "' + publicRepository + '"$', 'm'))
assert.match(pythonManifest, new RegExp('^Issues = "' + publicIssues + '"$', 'm'))
assert.ok(existsSync(resolve(repository, 'packages/event/python/src/runfold/event/__init__.py')))
assert.ok(!existsSync(resolve(
  repository,
  `packages/event/python/src/${legacyLower}_event`,
)))
assert.match(readFileSync(resolve(repository, 'README.md'), 'utf8'), /^# Runfold$/m)
assert.match(
  readFileSync(resolve(repository, 'COPYRIGHT.md'), 'utf8'),
  /^Copyright © 2026 Heiki Scott\.$/m,
)
for (const path of [
  'LICENSE',
  'packages/event/python/LICENSE',
  'packages/event/typescript/sdk/LICENSE',
  'packages/event/typescript/ui/trajectory/LICENSE',
]) {
  const license = readFileSync(resolve(repository, path), 'utf8')
  assert.ok(license.includes(`Copyright (c) 2026 ${copyrightHolder}`), path)
  assert.ok(license.includes('Copyright (c) 2026 DeepSeek'), path)
}
const nexentLicense = 'integrations/nexent/v2.5.0/LICENSE'
assert.ok(existsSync(resolve(repository, nexentLicense)), nexentLicense)
assert.match(
  readFileSync(resolve(repository, nexentLicense), 'utf8'),
  /^Copyright \(c\) 2025 Huawei Technologies Co\., Ltd\. All rights reserved\.$/m,
)
assert.match(
  readFileSync(resolve(repository, nexentLicense), 'utf8'),
  /Permission is hereby granted, free of charge, to any person obtaining a copy/,
)
for (const path of [
  'NOTICE.md',
  'packages/event/python/NOTICE.md',
  'packages/event/typescript/sdk/NOTICE.md',
  'packages/event/typescript/ui/trajectory/NOTICE.md',
]) {
  const notice = readFileSync(resolve(repository, path), 'utf8')
  assert.ok(notice.includes(copyrightHolder), path)
  assert.ok(notice.includes(projectMaintainer), path)
  assert.ok(notice.includes('DeepSeek'), path)
}

console.log(
  `Runfold public identity verification passed (${scannedFiles} text files; `
  + `${allowedReferences} explicit ownership, provenance, or negative-test references)`,
)
