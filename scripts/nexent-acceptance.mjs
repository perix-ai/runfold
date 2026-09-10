#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createWriteStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const integration = join(repository, 'integrations/nexent/v2.5.0')
const manifest = JSON.parse(readFileSync(join(integration, 'manifest.json'), 'utf8'))
const defaultSource = join(repository, 'build/nexent-v2.5.0-acceptance')
let reportedSource = defaultSource
const fixtureRoot = join(
  repository,
  'tests/event/cross-language/fixtures/nexent-r33/--workspace-nexent-acceptance--',
)
const pythonTests = [
  'test/sdk/core/agents/test_event_trajectory.py',
  'test/sdk/core/agents/test_core_agent.py',
  'test/sdk/core/agents/test_run_agent.py',
  'test/sdk/core/agents/test_nexent_agent.py',
  'test/sdk/core/agents/test_agent_model.py',
  'test/backend/services/test_event_trajectory_service.py',
  'test/backend/app/test_event_trajectory_app.py',
]
const pythonTestBootstrap = `# Load only the modules exercised by the Event matrix. Nexent's eager package
# initializers otherwise import unrelated model, vector, storage, and document stacks.
import importlib.machinery
import os
import sys
import types

sdk_root = os.environ.get("RUNFOLD_NEXENT_SDK")
if sdk_root:
    package_root = os.path.join(sdk_root, "nexent")

    def namespace(name, path):
        package = types.ModuleType(name)
        package.__path__ = [path]
        package.__package__ = name
        package.__spec__ = importlib.machinery.ModuleSpec(
            name, loader=None, is_package=True
        )
        package.__spec__.submodule_search_locations = [path]
        return package

    sys.modules.setdefault("nexent", namespace("nexent", package_root))
    sdk = sys.modules.setdefault("sdk", namespace("sdk", sdk_root))
    sdk_nexent = sys.modules.setdefault(
        "sdk.nexent", namespace("sdk.nexent", package_root)
    )
    sdk.nexent = sdk_nexent
    sys.modules.setdefault(
        "sdk.nexent.core.models",
        namespace("sdk.nexent.core.models", os.path.join(package_root, "core", "models")),
    )
    tools = sys.modules.setdefault(
        "sdk.nexent.core.tools",
        namespace("sdk.nexent.core.tools", os.path.join(package_root, "core", "tools")),
    )
    tools.__all__ = []
`

function usage() {
  console.log(`Nexent v2.5.0 Event 验收

用法：
  npm run accept:nexent       快速检查并打开 fixture-backed Event UI
  npm run accept:nexent:full  额外运行 Python 回归和生产构建

脚本直接下载固定归档，只使用 build/nexent-v2.5.0-acceptance，
不启动 Docker 或真实服务。`)
}

function parseOptions(argv) {
  const options = {
    full: false,
    ui: true,
    open: process.env.NEXENT_ACCEPTANCE_NO_OPEN !== '1',
    source: defaultSource,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--full') options.full = true
    else if (argument === '--no-ui') options.ui = false
    else if (argument === '--no-open') options.open = false
    else if (argument === '--source') {
      const value = argv[index + 1]
      if (!value) throw new Error('--source 需要一个目录')
      options.source = resolve(value)
      index += 1
    } else if (argument === '--help' || argument === '-h') {
      usage()
      return null
    } else {
      throw new Error(`未知参数：${argument}`)
    }
  }
  return options
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function parseChecksums(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line)
      if (!match) throw new Error(`校验和格式无效：${line}`)
      return { expected: match[1], file: match[2] }
    })
}

function verifyChecksums(path, baseDirectory) {
  for (const entry of parseChecksums(path)) {
    const target = resolve(baseDirectory, entry.file)
    if (!existsSync(target)) throw new Error(`缺少文件：${target}`)
    if (sha256(target) !== entry.expected) {
      throw new Error(`文件校验失败：${entry.file}`)
    }
  }
}

function executable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name
}

function run(command, args, { cwd = repository, env, label, allowFailure = false } = {}) {
  if (label) console.log(`\n[${label}]`)
  const result = spawnSync(command, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    stdio: 'inherit',
  })
  if (result.error) {
    if (allowFailure) return result
    throw new Error(`无法运行 ${command}：${result.error.message}`)
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${label ?? command} 失败（退出码 ${result.status ?? '未知'}）`)
  }
  return result
}

function capture(command, args, { cwd = repository, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if ((result.error || result.status !== 0) && !allowFailure) {
    const detail = result.stderr?.trim() || result.error?.message || `退出码 ${result.status}`
    throw new Error(`${command} ${args.join(' ')} 失败：${detail}`)
  }
  return result.status === 0 ? result.stdout.trim() : ''
}

function assertPrerequisites(full) {
  const nodeMajor = Number(process.versions.node.split('.')[0])
  if (!Number.isSafeInteger(nodeMajor) || nodeMajor < 22) {
    throw new Error(`需要 Node.js 22 或更高版本；当前为 ${process.version}`)
  }
  capture('git', ['--version'])
  capture('unzip', ['-v'])
  if (full) capture(executable('uv'), ['--version'])
}

function verifyIntegrationArtifacts() {
  verifyChecksums(join(integration, 'SHA256SUMS'), integration)
  const series = readFileSync(join(integration, 'series'), 'utf8')
    .split('\n')
    .filter(Boolean)
  if (series.length !== 1 || series[0] !== manifest.patches[0]?.file) {
    throw new Error('集成目录必须只包含 manifest 声明的单一补丁')
  }
  return join(integration, series[0])
}

function ensureCleanSource(source) {
  const changes = capture('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: source })
  if (changes) {
    throw new Error(`验收目录存在未提交文件，请保留后删除整个目录再重试：${source}`)
  }
}

function sourceTree(source) {
  return capture('git', ['rev-parse', 'HEAD^{tree}'], { cwd: source })
}

async function downloadArchive(destination) {
  const download = manifest.acceptance.download
  const localArchive = process.env.NEXENT_ACCEPTANCE_ARCHIVE
  if (localArchive) {
    console.log(`使用本地固定归档：${resolve(localArchive)}`)
    await copyFile(resolve(localArchive), destination)
    if (statSync(destination).size !== download.bytes || sha256(destination) !== download.sha256) {
      throw new Error('本地归档的大小或 SHA-256 不匹配')
    }
    return
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await rm(destination, { force: true })
    try {
      console.log(`直接下载 ${Math.round(download.bytes / 1024 / 1024)} MB 固定归档（第 ${attempt}/3 次）`)
      const response = await fetch(download.url, {
        headers: { 'user-agent': 'Runfold-Nexent-Acceptance' },
        signal: AbortSignal.timeout(20 * 60 * 1000),
      })
      if (!response.ok || !response.body) {
        throw new Error(`下载返回 HTTP ${response.status}`)
      }
      let received = 0
      let nextProgress = 10 * 1024 * 1024
      const progress = new Transform({
        transform(chunk, encoding, callback) {
          received += chunk.length
          if (received >= nextProgress) {
            console.log(`已下载 ${Math.floor(received / 1024 / 1024)} MB`)
            nextProgress += 10 * 1024 * 1024
          }
          callback(null, chunk)
        },
      })
      await pipeline(
        Readable.fromWeb(response.body),
        progress,
        createWriteStream(destination, { flags: 'wx' }),
      )
      if (received !== download.bytes) {
        throw new Error(`归档大小不匹配：${received} bytes`)
      }
      if (sha256(destination) !== download.sha256) {
        throw new Error('归档 SHA-256 不匹配')
      }
      return
    } catch (error) {
      await rm(destination, { force: true })
      if (attempt === 3) throw error
      console.log(`下载未完成：${error.message}；自动重试`)
    }
  }
}

async function downloadSource(source) {
  const parent = dirname(source)
  const archive = join(parent, '.nexent-v2.5.0.zip')
  const extraction = join(parent, '.nexent-v2.5.0-extract')
  await mkdir(parent, { recursive: true })
  await rm(extraction, { recursive: true, force: true })
  try {
    await downloadArchive(archive)
    await mkdir(extraction, { recursive: true })
    run('unzip', ['-q', archive, '-d', extraction], { label: '解压固定归档' })
    const extracted = join(extraction, manifest.acceptance.download.extractedDirectory)
    if (!existsSync(extracted)) throw new Error('归档内缺少预期的 Nexent 目录')
    await rename(extracted, source)
  } finally {
    await rm(archive, { force: true })
    await rm(extraction, { recursive: true, force: true })
  }

  capture('git', ['init', '--quiet'], { cwd: source })
  capture('git', ['config', 'user.name', 'Runfold Acceptance'], { cwd: source })
  capture('git', ['config', 'user.email', 'acceptance@runfold.local'], { cwd: source })
  capture('git', ['add', '--force', '.'], { cwd: source })
  capture('git', ['commit', '--quiet', '-m', 'snapshot: Nexent v2.5.0 archive'], { cwd: source })
  const tree = sourceTree(source)
  if (tree !== manifest.acceptance.download.baselineTree) {
    throw new Error(`下载归档的基线 tree 不匹配：${tree}`)
  }
}

async function prepareSource(source, patch) {
  if (!existsSync(source)) {
    console.log('\n[1/4 下载 Nexent v2.5.0]')
    await downloadSource(source)
  }

  if (!existsSync(join(source, '.git'))) {
    throw new Error(`验收目录不是 Git 仓库：${source}`)
  }
  ensureCleanSource(source)

  let tree = sourceTree(source)
  const download = manifest.acceptance.download
  if (tree === manifest.result.expectedTree || tree === download.expectedTree) {
    console.log('\n[1/4 Nexent 补丁已就绪，复用现有目录]')
    return
  }
  let expectedTree
  if (tree === manifest.upstream.baselineTree) {
    const head = capture('git', ['rev-parse', 'HEAD'], { cwd: source })
    if (head !== manifest.upstream.tagCommit) {
      throw new Error(`Nexent HEAD 不是 v2.5.0 的固定提交：${head}`)
    }
    expectedTree = manifest.result.expectedTree
  } else if (tree === download.baselineTree) {
    expectedTree = download.expectedTree
  } else {
    throw new Error(
      `Nexent 源码不是受支持的基线或结果（当前 tree ${tree}）。` +
        `请保留后删除整个目录再重试：${source}`,
    )
  }

  run('git', ['config', 'user.name', 'Runfold Acceptance'], { cwd: source })
  run('git', ['config', 'user.email', 'acceptance@runfold.local'], { cwd: source })
  const applied = run('git', ['am', '--3way', patch], {
    cwd: source,
    label: '2/4 应用唯一集成补丁',
    allowFailure: true,
  })
  if (applied.status !== 0) {
    run('git', ['am', '--abort'], { cwd: source, allowFailure: true })
    throw new Error('补丁无法应用；已回滚到干净基线')
  }
  tree = sourceTree(source)
  if (tree !== expectedTree) {
    throw new Error(`补丁结果 tree 不匹配：${tree}`)
  }
}

function resolvePnpm(frontend) {
  const globalPnpm = executable('pnpm')
  const version = capture(globalPnpm, ['--version'], { cwd: frontend, allowFailure: true })
  if (version === manifest.acceptance.pnpm) {
    return { command: globalPnpm, args: [] }
  }
  const npx = executable('npx')
  capture(npx, ['--version'])
  return { command: npx, args: ['--yes', `pnpm@${manifest.acceptance.pnpm}`] }
}

function runFrontendChecks(source) {
  const frontend = join(source, 'frontend')
  const lockfile = join(frontend, 'pnpm-lock.yaml')
  if (sha256(lockfile) !== manifest.acceptance.frontendLockSha256) {
    throw new Error('Nexent 前端锁文件与验收清单不一致')
  }
  verifyChecksums(join(frontend, 'vendor/SHA256SUMS'), frontend)

  const pnpm = resolvePnpm(frontend)
  run(
    pnpm.command,
    [...pnpm.args, 'install', '--frozen-lockfile', '--ignore-scripts'],
    { cwd: frontend, env: { CI: 'true' }, label: '3/4 安装锁定的前端依赖' },
  )

  const testFiles = readdirSync(join(frontend, 'tests'))
    .filter((file) => file.endsWith('.test.ts'))
    .sort()
    .map((file) => join(frontend, 'tests', file))
  run(process.execPath, ['--test', ...testFiles], {
    cwd: frontend,
    label: '4/4 运行 27 个前端测试',
  })
  run(
    process.execPath,
    [join(frontend, 'node_modules/typescript/bin/tsc'), '--noEmit', '--incremental', 'false'],
    { cwd: frontend, label: 'TypeScript 检查' },
  )
  return frontend
}

async function runFullChecks(source, frontend) {
  const uv = executable('uv')
  const virtualEnvironment = join(source, '.venv')
  const python = process.platform === 'win32'
    ? join(virtualEnvironment, 'Scripts/python.exe')
    : join(virtualEnvironment, 'bin/python')

  const dependencySnapshot = manifest.acceptance.full
  const existingVersion = existsSync(python)
    ? capture(python, ['-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], {
        allowFailure: true,
      })
    : ''
  if (existingVersion === dependencySnapshot.python) {
    console.log('\n[完整模式：复用现有 Python 3.11 环境]')
  } else {
    run(uv, ['venv', '--clear', '--python', dependencySnapshot.python, virtualEnvironment], {
      cwd: source,
      label: '完整模式：准备 Python 3.11 环境',
    })
  }

  run(
    uv,
    [
      'pip',
      'install',
      '--exact',
      '--python',
      python,
      '--exclude-newer',
      dependencySnapshot.excludeNewer,
      ...dependencySnapshot.packages,
    ],
    { cwd: source, label: '完整模式：同步最小 Event 测试依赖' },
  )
  const sitePackages = capture(python, [
    '-c',
    'import site; print(site.getsitepackages()[0])',
  ])
  await writeFile(join(sitePackages, 'runfold_nexent_test_bootstrap.py'), pythonTestBootstrap)
  await writeFile(
    join(sitePackages, 'runfold_nexent_test_bootstrap.pth'),
    'import runfold_nexent_test_bootstrap\n',
  )
  const testEnvironment = { RUNFOLD_NEXENT_SDK: join(source, 'sdk') }
  for (const test of pythonTests) {
    run(
      python,
      ['-m', 'pytest', '-q', test],
      { cwd: source, env: testEnvironment, label: `Python：${test}` },
    )
  }
  run(process.execPath, [join(frontend, 'node_modules/next/dist/bin/next'), 'build'], {
    cwd: frontend,
    label: '完整模式：生产构建',
  })
  await rm(join(frontend, '.next'), { recursive: true, force: true })
  console.log('\n[清理] 已删除只用于生产构建验证的 frontend/.next')
}

function loadTrajectory(name) {
  const records = readFileSync(join(fixtureRoot, name, 'session.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  return { session: records[0], events: records.slice(1) }
}

function conversation(id, title, messages) {
  const now = Date.now()
  return {
    conversation_id: id,
    conversation_title: title,
    agent_id: 1,
    create_time: now - 60_000,
    update_time: now,
    chat_mode: 'execution',
    knowledge_scope: null,
    runtime_metadata: {},
    runtime_metadata_version: 0,
    message: messages,
  }
}

function fixtureState() {
  const parent = loadTrajectory('nexent-real')
  const fixedChild = loadTrajectory('nexent-real-fork')
  const now = Date.now()
  const parentMessages = [
    { role: 'user', message: 'Add two and three.', message_id: 101, message_index: 0, create_time: now - 50_000 },
    {
      role: 'assistant',
      message: [
        { type: 'tool', content: 'add(a=2, b=3)', tool_name: 'add', tool_call_id: 'acceptance-add' },
        { type: 'final_answer', content: 'The result is five.' },
      ],
      message_id: 102,
      message_index: 1,
      create_time: now - 45_000,
    },
    { role: 'user', message: 'Confirm the result.', message_id: 103, message_index: 2, create_time: now - 35_000 },
    {
      role: 'assistant',
      message: [{ type: 'final_answer', content: 'The result remains five.' }],
      message_id: 104,
      message_index: 3,
      create_time: now - 30_000,
    },
  ]
  const childMessages = [
    ...parentMessages,
    { role: 'user', message: 'Continue independently.', message_id: 105, message_index: 4, create_time: now - 20_000 },
    {
      role: 'assistant',
      message: [{ type: 'final_answer', content: 'The fork continued independently.' }],
      message_id: 106,
      message_index: 5,
      create_time: now - 15_000,
    },
  ]
  const state = {
    trajectories: new Map(),
    conversations: new Map(),
    parent,
    fixedChild,
    childMessages,
    nextConversationId: 3802,
  }
  state.reset = () => {
    state.trajectories = new Map([[3801, parent]])
    state.conversations = new Map([
      [3801, conversation(3801, 'Nexent · Runfold Event 验收', parentMessages)],
    ])
    state.nextConversationId = 3802
  }
  state.reset()
  return state
}

function send(response, body, status = 200) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('请求 JSON 无效')
  }
}

function makeFixtureHandler(state) {
  const agent = {
    agent_id: 1,
    name: 'runfold_event_acceptance',
    display_name: 'Runfold Event 验收 Agent',
    description: '验证 Nexent 中的 Event 记录、恢复和轨迹 UI。',
    author: 'Runfold',
    model_id: 1,
    model_name: 'deterministic-event-model',
    is_available: true,
    is_main_agent: true,
    current_version_no: 1,
    version_name: 'v1',
    greeting_message: 'Runfold Event 验收环境',
    example_questions: [],
    permission: 'READ_ONLY',
  }

  return async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost')
      const path = url.pathname
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'access-control-allow-headers': 'content-type,authorization',
        })
        response.end()
        return
      }
      if (path === '/api/tenant_config/deployment_version') {
        send(response, {
          deployment_version: 'speed',
          app_version: 'v2.5.0-runfold-acceptance',
          enable_aidp_knowledge: false,
          status: 'success',
        })
        return
      }
      if (path === '/api/agent/published_list') {
        send(response, [agent])
        return
      }
      if (path === '/api/config/load_config') {
        send(response, { config: { app: {}, models: {} } })
        return
      }
      if (path === '/api/memory/config/embedding-status') {
        // Memory is outside Event acceptance; suppress Nexent's global shell prompt
        // without installing or contacting an embedding service.
        send(response, { configured: true, current_es_index_name: null })
        return
      }
      if (path === '/api/conversation/list') {
        const items = [...state.conversations.values()]
        send(response, {
          code: 0,
          message: 'success',
          data: { items, metadata: { total: items.length, today: items.length, last_7_days: 0, older: 0 } },
        })
        return
      }
      const forkMatch = /^\/api\/conversation\/(\d+)\/trajectory\/fork$/.exec(path)
      if (request.method === 'POST' && forkMatch) {
        const parentId = Number(forkMatch[1])
        const trajectory = state.trajectories.get(parentId)
        if (!trajectory) {
          send(response, { code: 404, message: 'trajectory not found', data: null }, 404)
          return
        }
        const body = await readJson(request)
        const boundaries = trajectory.events
          .filter((event) => event.type === 'turn/end')
          .map((event) => event.seq)
        const requested = Number(body.boundary)
        const boundary = boundaries.includes(requested) ? requested : boundaries.at(-1)
        if (boundary === undefined) {
          send(response, { code: 409, message: 'no stable boundary', data: null }, 409)
          return
        }
        const seed = trajectory.events.slice(0, boundary + 1)
        const useFixedChild = parentId === 3801 && boundary === state.parent.events.at(-1)?.seq
        const childId = state.nextConversationId
        state.nextConversationId += 1
        const child = {
          session: {
            ...(useFixedChild ? state.fixedChild.session : trajectory.session),
            id: `${trajectory.session.id}-fork-${childId}`,
            parentSession: trajectory.session.id,
            seedLength: seed.length,
            createdAt: Date.now(),
          },
          events: useFixedChild ? state.fixedChild.events : seed,
        }
        const parentConversation = state.conversations.get(parentId)
        const childConversation = conversation(
          childId,
          body.title || `${parentConversation?.conversation_title ?? 'Nexent Event'}（分叉）`,
          state.childMessages,
        )
        state.trajectories.set(childId, child)
        state.conversations.set(childId, childConversation)
        send(response, {
          code: 0,
          message: 'success',
          data: {
            parent_conversation_id: parentId,
            conversation: childConversation,
            boundary,
            completed_turns: seed.filter((event) => event.type === 'turn/end').length,
            session: child.session,
          },
        })
        return
      }
      const trajectoryMatch = /^\/api\/conversation\/(\d+)\/trajectory$/.exec(path)
      if (trajectoryMatch) {
        const trajectory = state.trajectories.get(Number(trajectoryMatch[1]))
        if (!trajectory) {
          send(response, { code: 404, message: 'trajectory not found', data: null }, 404)
          return
        }
        const fromSeq = Math.max(0, Number(url.searchParams.get('from_seq') ?? 0))
        const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 5000))
        const events = trajectory.events.slice(fromSeq, fromSeq + limit)
        const nextSeq = fromSeq + events.length
        send(response, {
          code: 0,
          message: 'success',
          data: {
            session: trajectory.session,
            events,
            from_seq: fromSeq,
            next_seq: nextSeq,
            has_more: nextSeq < trajectory.events.length,
            total_events: trajectory.events.length,
          },
        })
        return
      }
      const conversationMatch = /^\/api\/conversation\/(\d+)$/.exec(path)
      if (conversationMatch) {
        const item = state.conversations.get(Number(conversationMatch[1]))
        send(
          response,
          item
            ? { code: 0, message: 'success', data: [item] }
            : { code: 404, message: 'conversation not found', data: null },
          item ? 200 : 404,
        )
        return
      }
      if (path === '/api/agent/1/knowledge-capabilities') {
        send(response, {
          code: 0,
          message: 'success',
          data: {
            agent_id: 1,
            version_no: 1,
            sources: {
              local: { enabled: false, max_select: 0, requires_same_embedding_model: false, default_summary: '', default_knowledge_ids: [], default_range_values: [] },
              aidp: { enabled: false, max_select: 0, default_summary: '', default_knowledge_ids: [], default_range_values: [] },
            },
          },
        })
        return
      }
      if (path === '/api/user/current_user_info') {
        send(response, {
          code: 0,
          message: 'success',
          data: {
            user: {
              user_id: 'acceptance',
              user_email: 'acceptance@localhost',
              user_role: 'SPEED',
              tenant_id: '',
              group_ids: [],
              auth_provider: 'local',
              permissions: [],
              accessibleRoutes: ['/newchat', '/chat'],
            },
          },
        })
        return
      }
      send(response, { code: 0, message: 'success', data: [] })
    } catch (error) {
      send(response, { code: 500, message: error.message, data: null }, 500)
    }
  }
}

async function assertPortAvailable(port, host = '127.0.0.1') {
  await new Promise((resolvePromise, rejectPromise) => {
    const probe = createServer()
    probe.once('error', () => rejectPromise(new Error(`端口 ${port} 已被占用；请先在旧验收终端按 Ctrl+C`)))
    probe.listen(port, host, () => probe.close(resolvePromise))
  })
}

async function startFixtureServers() {
  const state = fixtureState()
  const handler = makeFixtureHandler(state)
  const servers = []
  for (const port of [5010, 5014]) {
    const server = createServer(handler)
    await new Promise((resolvePromise, rejectPromise) => {
      server.once('error', rejectPromise)
      server.listen(port, '127.0.0.1', resolvePromise)
    })
    servers.push(server)
  }
  return {
    reset: state.reset,
    close: () => Promise.all(
      servers.map((server) => new Promise((resolvePromise) => server.close(resolvePromise))),
    ),
  }
}

async function requestJson(url, init) {
  const response = await fetch(url, init)
  const body = await response.json()
  if (!response.ok || body.code !== 0 || !body.data) {
    throw new Error(body.message || `fixture API 返回 HTTP ${response.status}`)
  }
  return body.data
}

async function verifyFixtureLifecycle() {
  const trajectoryUrl = 'http://127.0.0.1:5010/api/conversation/3801/trajectory?from_seq=0&limit=5000'
  const first = await requestJson(trajectoryUrl)
  const restored = await requestJson(trajectoryUrl)
  if (
    first.session.id !== restored.session.id ||
    JSON.stringify(first.events) !== JSON.stringify(restored.events)
  ) {
    throw new Error('刷新后的 Session 恢复读取不一致')
  }
  const boundary = first.events.filter((event) => event.type === 'turn/end').at(-1)?.seq
  if (boundary === undefined) throw new Error('fixture 没有稳定的分叉边界')
  const fork = await requestJson(
    'http://127.0.0.1:5010/api/conversation/3801/trajectory/fork',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ boundary }),
    },
  )
  const childId = Number(fork.conversation.conversation_id)
  const child = await requestJson(
    `http://127.0.0.1:5010/api/conversation/${childId}/trajectory?from_seq=0&limit=5000`,
  )
  if (
    childId === 3801 ||
    child.session.id === first.session.id ||
    child.session.parentSession !== first.session.id ||
    child.session.seedLength !== boundary + 1
  ) {
    throw new Error('分叉没有创建带正确 lineage 的全新 child Session')
  }
  console.log(
    `\n[恢复/分叉检查] Session ${first.session.id} 可重复恢复；` +
      `已创建并读取 child Session ${child.session.id}`,
  )
}

async function waitForUrl(url, child) {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Nexent UI 提前退出（退出码 ${child.exitCode}）`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (response.ok) return
    } catch {
      // Next.js 首次编译期间继续等待。
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000))
  }
  throw new Error('等待 Nexent UI 启动超时')
}

function openBrowser(url) {
  let command
  let args
  if (process.platform === 'darwin') {
    command = 'open'
    args = [url]
  } else if (process.platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '', url]
  } else {
    command = 'xdg-open'
    args = [url]
  }
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.unref()
}

async function runUi(frontend, shouldOpen) {
  const uiHost = process.platform === 'darwin' ? '::1' : '127.0.0.1'
  await assertPortAvailable(3000, uiHost)
  for (const port of [5010, 5014]) await assertPortAvailable(port)
  const fixtures = await startFixtureServers()
  const url = process.platform === 'darwin'
    ? 'http://[::1]:3000/zh/newchat?conversation_id=3801'
    : 'http://127.0.0.1:3000/zh/newchat?conversation_id=3801'
  let frontendProcess

  try {
    await verifyFixtureLifecycle()
    fixtures.reset()
    frontendProcess = spawn(process.execPath, ['server.js'], {
      cwd: frontend,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DEPLOYMENT_VERSION: 'speed',
        HTTP_BACKEND: 'http://127.0.0.1:5010',
        RUNTIME_HTTP_BACKEND: 'http://127.0.0.1:5014',
        WS_BACKEND: 'ws://127.0.0.1:5014',
      },
      stdio: 'inherit',
    })
    await waitForUrl(url, frontendProcess)
    console.log(`\n✅ 快速验收通过，Event UI 已就绪：\n${url}`)
    console.log('人工只需切到“轨迹”，查看 Event 详情并点一次“分叉”。')
    console.log('检查完按 Ctrl+C；fixture 环境不会连接真实模型或写入业务数据。')
    if (shouldOpen) openBrowser(url)

    await new Promise((resolvePromise, rejectPromise) => {
      let requestedStop = false
      const stop = () => {
        requestedStop = true
        resolvePromise()
      }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
      frontendProcess.once('exit', (code) => {
        if (requestedStop) resolvePromise()
        else rejectPromise(new Error(`Nexent UI 已退出（退出码 ${code ?? '未知'}）`))
      })
    })
  } finally {
    if (frontendProcess?.exitCode === null) frontendProcess.kill('SIGTERM')
    await fixtures.close()
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  if (!options) return
  reportedSource = options.source
  assertPrerequisites(options.full)
  const patch = verifyIntegrationArtifacts()
  await prepareSource(options.source, patch)
  const frontend = runFrontendChecks(options.source)
  if (options.full) await runFullChecks(options.source, frontend)
  if (options.ui) await runUi(frontend, options.open)
  else console.log('\n✅ Nexent Event 验收全部通过。')
}

main().catch((error) => {
  console.error(`\n❌ ${error.message}`)
  console.error(`验收内容都在一个目录中：${reportedSource}`)
  process.exitCode = 1
})
