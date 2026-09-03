import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const testsDirectory = dirname(fileURLToPath(import.meta.url))
const repository = resolve(testsDirectory, '../../../../..')
const sdkDirectory = join(repository, 'packages/event/typescript/sdk')
const uiDirectory = join(repository, 'packages/event/typescript/ui/trajectory')
const temporary = await mkdtemp(join(tmpdir(), 'runfold-event-consumer-'))
const artifacts = join(temporary, 'artifacts')
const consumer = join(temporary, 'consumer')

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: join(temporary, 'npm-cache') },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed with exit code ${result.status}`,
      result.stdout,
      result.stderr,
    ].join('\n'))
  }
  return result.stdout
}

async function assertExportFiles(packageDirectory) {
  const manifest = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'))
  for (const target of Object.values(manifest.exports)) {
    if (typeof target === 'string') {
      await access(join(packageDirectory, target))
      continue
    }
    for (const path of Object.values(target)) await access(join(packageDirectory, path))
  }
}

async function generatedTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await generatedTextFiles(path))
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files
}

try {
  await Promise.all([
    mkdir(artifacts, { recursive: true }),
    mkdir(consumer, { recursive: true }),
  ])

  const sdkPack = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', artifacts], sdkDirectory))[0]
  const uiPack = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', artifacts], uiDirectory))[0]
  const sdkTarball = join(artifacts, sdkPack.filename)
  const uiTarball = join(artifacts, uiPack.filename)

  await writeFile(join(consumer, 'package.json'), JSON.stringify({
    name: 'runfold-event-blank-consumer',
    private: true,
    type: 'module',
  }, null, 2) + '\n')
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2024',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      jsx: 'react-jsx',
      noEmit: true,
    },
    include: ['consumer.tsx'],
  }, null, 2) + '\n')
  await writeFile(join(consumer, 'consumer.tsx'), `
import { createEventRuntime, SessionId } from '@runfold/event'
import JsonlSessionPersistence from '@runfold/event/persistence-jsonl'
import type { SessionEvent } from '@runfold/event/session/types'
import { createUserMessage } from '@runfold/event/messages'
import type { EventHost } from '@runfold/event/runtime'
import { EventTrajectory, type EventTrajectoryProps } from '@runfold/trajectory-ui'
import '@runfold/trajectory-ui/style.css'

const context = createEventRuntime({
  persistence: (host: EventHost) => new JsonlSessionPersistence(host, { root: '/tmp/runfold-consumer', compression: 'none' }),
})
const session = context.sessions.create(SessionId('typed-consumer'))
session.append('user/message', createUserMessage({
  content: [{ type: 'text', text: 'typed' }],
  source: { kind: 'user' },
}), { surfaceOp: 'append' })
const events: readonly SessionEvent[] = session.events
const props: EventTrajectoryProps = { events, locale: 'en' }
const view = <EventTrajectory {...props} />
void view
await context.dispose()
`)
  await writeFile(join(consumer, 'runtime.mjs'), `
import { createEventRuntime, SessionId } from '@runfold/event'
import { createUserMessage } from '@runfold/event/messages'

const context = createEventRuntime()
const session = context.sessions.create(SessionId('runtime-consumer'))
session.append('user/message', createUserMessage({
  content: [{ type: 'text', text: 'runtime' }],
  source: { kind: 'user' },
}), { surfaceOp: 'append' })
if (session.events.length !== 1 || session.deriveMessages().length !== 1) {
  throw new Error('installed Event SDK failed its runtime lifecycle')
}
await context.dispose()
`)

  run('npm', [
    'install',
    '--no-package-lock',
    sdkTarball,
    uiTarball,
    'react@18.3.1',
    'react-dom@18.3.1',
    '@types/react@18.3.1',
    '@types/react-dom@18.3.0',
    'typescript@5.9.2',
  ], consumer)
  run(resolve(consumer, 'node_modules/.bin/tsc'), ['--project', 'tsconfig.json'], consumer)
  run(process.execPath, ['runtime.mjs'], consumer)

  await assertExportFiles(join(consumer, 'node_modules/@runfold/event'))
  await assertExportFiles(join(consumer, 'node_modules/@runfold/trajectory-ui'))
  // No DSH package may be listed, required at runtime, or mentioned by a
  // published JavaScript/declaration artifact. Generated declaration comments
  // carry source-path provenance without registry package names.
  const installedSdk = JSON.parse(await readFile(
    join(consumer, 'node_modules/@runfold/event/package.json'),
    'utf8',
  ))
  const installedUi = JSON.parse(await readFile(
    join(consumer, 'node_modules/@runfold/trajectory-ui/package.json'),
    'utf8',
  ))
  for (const [label, manifest] of [['SDK', installedSdk], ['UI', installedUi]]) {
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(manifest[field] ?? {})) {
        assert.equal(name.startsWith('@deepseek-ai/'), false, `${label} ${field} still lists ${name}`)
      }
    }
  }
  for (const packageName of ['event', 'trajectory-ui']) {
    for (const file of await generatedTextFiles(
      join(consumer, `node_modules/@runfold/${packageName}/lib`),
    )) {
      const content = await readFile(file, 'utf8')
      assert.equal(content.includes('@deepseek-ai'), false, `DSH namespace leaked into ${file}`)
    }
  }
  const uiDeclaration = await readFile(
    join(consumer, 'node_modules/@runfold/trajectory-ui/index.d.ts'),
    'utf8',
  )
  assert.equal(uiDeclaration.includes('@deepseek-ai'), false)
  assert.equal(uiDeclaration.includes('DshTrajectory'), false)
  assert.equal(uiDeclaration.includes('EventTrajectory'), true)

  console.log('Runfold Event package consumer verification passed')
} finally {
  await rm(temporary, { recursive: true, force: true })
}
