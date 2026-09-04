#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docsDirectory = resolve(repository, 'docs/event')
const governedDocuments = [
  'architecture.md',
  'decisions.md',
  'requirements.md',
  'specification.md',
  'testing.md',
]
const unpairedDocuments = new Set(['README.md', 'tasks.md'])

function git(args) {
  const result = spawnSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
  return result.stdout.trim()
}

function isDirty(path) {
  return git(['status', '--porcelain=v1', '--', path]) !== ''
}

function verifyRelativeLinks(path) {
  const absolutePath = resolve(repository, path)
  const content = readFileSync(absolutePath, 'utf8')
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const destination = match[1].trim()
    if (destination.startsWith('#') || /^[a-z][a-z+.-]*:/i.test(destination)) {
      continue
    }
    const localPath = decodeURIComponent(destination.split('#', 1)[0])
    assert.ok(
      existsSync(resolve(dirname(absolutePath), localPath)),
      `${path} contains a broken relative link: ${destination}`,
    )
  }
}

const topLevelMarkdown = readdirSync(docsDirectory, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
  .map(entry => entry.name)
  .sort()
const canonicalDocuments = topLevelMarkdown.filter(
  name => !name.endsWith('.zh.md') && !unpairedDocuments.has(name),
)
const translatedDocuments = topLevelMarkdown.filter(name => name.endsWith('.zh.md'))

assert.deepEqual(
  canonicalDocuments,
  governedDocuments,
  'docs/event top-level governing documents must match the registered bilingual set',
)
assert.deepEqual(
  translatedDocuments,
  governedDocuments.map(name => name.replace(/\.md$/, '.zh.md')).sort(),
  'docs/event Chinese translations must exactly match the governing documents',
)

for (const canonicalName of governedDocuments) {
  const translatedName = canonicalName.replace(/\.md$/, '.zh.md')
  const canonicalPath = `docs/event/${canonicalName}`
  const translatedPath = `docs/event/${translatedName}`

  assert.ok(existsSync(resolve(repository, canonicalPath)), canonicalPath)
  assert.ok(existsSync(resolve(repository, translatedPath)), translatedPath)

  const canonical = readFileSync(resolve(repository, canonicalPath), 'utf8')
  const translated = readFileSync(resolve(repository, translatedPath), 'utf8')
  assert.ok(
    canonical.includes(`> Language: English | [中文](${translatedName})`),
    `${canonicalPath} must link to its Chinese translation`,
  )
  assert.ok(
    translated.includes(`> 语言：[English](${canonicalName}) | 中文`),
    `${translatedPath} must link to its English canonical copy`,
  )

  const canonicalDirty = isDirty(canonicalPath)
  const translatedDirty = isDirty(translatedPath)
  assert.equal(
    canonicalDirty,
    translatedDirty,
    `${canonicalPath} and ${translatedPath} must change together`,
  )

  if (!canonicalDirty) {
    const canonicalCommit = git(['log', '-1', '--format=%H', '--', canonicalPath])
    const translatedCommit = git(['log', '-1', '--format=%H', '--', translatedPath])
    assert.ok(canonicalCommit, `${canonicalPath} has no reachable Git history`)
    assert.equal(
      canonicalCommit,
      translatedCommit,
      `${canonicalPath} and ${translatedPath} were not last changed in the same commit`,
    )
  }
}

for (const name of [
  'README.md',
  ...governedDocuments,
  ...governedDocuments.map(document => document.replace(/\.md$/, '.zh.md')),
]) {
  verifyRelativeLinks(`docs/event/${name}`)
}

console.log(
  `Event documentation pairing verified (${governedDocuments.length} bilingual pairs; links resolved)`,
)
