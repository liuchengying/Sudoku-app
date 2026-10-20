import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runCLI } from '../scripts/ai-delivery.mjs'
import { withLock, TOOL_VERSION } from '../scripts/workflow.mjs'
import { manageInstallation } from '../scripts/install.mjs'

const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLI = path.join(bundle, 'scripts/ai-delivery.mjs')
function fixture(t) {
  const root = path.join(bundle, 'runtime/test-fixtures', 'project with spaces ' + crypto.randomUUID())
  fs.mkdirSync(root, { recursive: true })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const write = (relative, data) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data)); return relative }
  return { root, write }
}
const decoded = result => JSON.parse(result.output)
const profile = { schemaVersion: 2, name: 'other-project', timezone: 'UTC', maxRepairRounds: 3, checkTimeoutMs: 1000, watch: ['src', 'docs/tests', 'docs/ai-delivery/project.json'], exclude: [], checks: ['unit'], commands: { unit: [{ executable: 'node', args: ['--test', 'docs/tests/service.test.mjs'] }] } }
const spec = { id: 'portable-task', title: '可移植需求', request: '验证公共工具服务另一个项目', scope: ['src'], checks: ['unit'], criteria: [{ id: 'actual-behavior', description: 'Node 模块返回正确结果' }] }

test('目录与单文件软链接的 CLI 执行真实版本、检查及交付命令', t => {
  const f = fixture(t)
  const linkedBundle = path.join(f.root, 'linked skill with spaces')
  const linkedFile = path.join(f.root, 'linked cli with spaces.mjs')
  fs.symlinkSync(bundle, linkedBundle, 'dir')
  fs.symlinkSync(CLI, linkedFile, 'file')
  const linkedCLI = path.join(linkedBundle, 'scripts/ai-delivery.mjs')
  const execute = (entry, ...args) => {
    const result = spawnSync(process.execPath, [entry, '--project', f.root, ...args], { cwd: bundle, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr + result.stdout)
    assert.ok(result.stdout.trim(), '软链接入口不能空输出后返回成功')
    return result.stdout
  }
  for (const entry of [linkedCLI, linkedFile]) assert.equal(execute(entry, '--version').trim(), TOOL_VERSION)
  f.write('src/service.mjs', 'export const total = values => values.reduce((a, b) => a + b, 0);')
  f.write('docs/tests/service.test.mjs', "import assert from 'node:assert/strict'; import { total } from '../../src/service.mjs'; assert.equal(total([1, 2, 3]), 6);")
  f.write('docs/adapter.json', profile)
  f.write('docs/intake.json', { ...spec, plan: '通过带空格的公共技能软链接运行真实命令；根据原需求实现加总模块，执行 Node 行为检查并逐项复核，交付等待用户验收；源码变化必须使已有证据失效，记录保留。'.repeat(2) })
  const cli = (entry, ...args) => JSON.parse(execute(entry, ...args))
  assert.equal(cli(linkedCLI, 'init', '--adapter', 'docs/adapter.json').ready, true)
  assert.equal(cli(linkedFile, 'doctor').ready, true)
  assert.equal(cli(linkedCLI, 'begin', '--spec', 'docs/intake.json').stage, 'executing')
  assert.equal(cli(linkedFile, 'verify', spec.id).checks[0].passed, true)
  const task = JSON.parse(fs.readFileSync(path.join(f.root, 'docs/tasks/portable-task/task.json')))
  f.write('docs/review.json', { reviewer: '软链接入口测试', summary: '真实 CLI 与 Node 检查均已执行', findings: [], criteria: [{ id: 'actual-behavior', result: 'passed', evidence: [task.runs.at(-1).report] }] })
  assert.equal(cli(linkedCLI, 'finish', spec.id, '--file', 'docs/review.json').stage, 'awaiting_owner')
  assert.equal(cli(linkedFile, 'context', spec.id).evidenceCurrent, true)
})

test('目录与单文件软链接的安装器真实执行预览、安装、自检与卸载', t => {
  const f = fixture(t)
  const linkedBundle = path.join(f.root, 'linked installer directory')
  const linkedFile = path.join(f.root, 'linked installer.mjs')
  fs.symlinkSync(bundle, linkedBundle, 'dir')
  fs.symlinkSync(path.join(bundle, 'scripts/install.mjs'), linkedFile, 'file')
  const linkedInstaller = path.join(linkedBundle, 'scripts/install.mjs')
  const installHome = path.join(f.root, 'install home')
  fs.mkdirSync(installHome)
  const installer = (entry, mode, ...args) => {
    const result = spawnSync(process.execPath, [entry, mode, '--home', installHome, ...args], { cwd: bundle, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr + result.stdout)
    assert.ok(result.stdout.trim(), '软链接安装器不能空输出后返回成功')
    return JSON.parse(result.stdout)
  }
  assert.equal(installer(linkedInstaller, 'install', '--dry-run').changed, false)
  assert.equal(fs.existsSync(path.join(installHome, '.agents')), false)
  assert.equal(installer(linkedFile, 'install').installed, true)
  assert.equal(installer(linkedInstaller, 'doctor').version, TOOL_VERSION)
  assert.equal(installer(linkedFile, 'uninstall').changed, true)
  assert.equal(fs.existsSync(path.join(installHome, '.local/bin/ai-delivery')), false)
})

function snapshot(directory) {
  return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? Object.entries(snapshot(file)) : [[file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]]
  }))
}

test('init 无虚假检查，重复执行不覆盖配置，doctor 清楚报告待配置', t => {
  const f = fixture(t)
  assert.equal(decoded(runCLI(['init'], f.root)).ready, false)
  const file = path.join(f.root, 'docs/ai-delivery/project.json')
  const original = fs.readFileSync(file)
  assert.equal(runCLI(['doctor'], f.root).exitCode, 1)
  assert.equal(decoded(runCLI(['init'], f.root)).initialized, false)
  assert.deepEqual(fs.readFileSync(file), original)
  assert.throws(() => runCLI(['new', '--spec', 'docs/spec.json'], f.root), /注册/)
})

test('跨目录 CLI 指定带空格项目，真实 Node 完整交付且只写目标项目', t => {
  const f = fixture(t)
  f.write('src/service.mjs', 'export const total = items => items.reduce((a, b) => a + b, 0);')
  f.write('docs/tests/service.test.mjs', "import assert from 'node:assert/strict'; import { total } from '../../src/service.mjs'; assert.equal(total([1, 2, 3]), 6);")
  f.write('docs/adapter.json', profile); f.write('docs/intake.json', spec)
  const cli = (...args) => {
    const r = spawnSync(process.execPath, [CLI, '--project', f.root, ...args], { cwd: bundle, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr + r.stdout)
    return JSON.parse(r.stdout)
  }
  assert.equal(cli('init', '--adapter', 'docs/adapter.json').ready, true)
  assert.equal(cli('doctor').ready, true)
  assert.equal(cli('new', '--spec', 'docs/intake.json').stage, 'received')
  f.write('docs/tasks/portable-task/plan.md', '核对 Node 模块与测试，创建计划后修改并执行真实测试，逐项复核结果，生成交付并等待用户验收。'.repeat(4))
  cli('plan', spec.id); cli('start', spec.id)
  assert.equal(cli('verify', spec.id).checks[0].passed, true)
  const task = JSON.parse(fs.readFileSync(path.join(f.root, 'docs/tasks/portable-task/task.json')))
  f.write('docs/review.json', { reviewer: '当前测试会话', summary: '真实模块输出已验证', findings: [], criteria: [{ id: 'actual-behavior', result: 'passed', evidence: [task.runs.at(-1).report] }] })
  cli('review', spec.id, '--file', 'docs/review.json')
  assert.equal(cli('deliver', spec.id).stage, 'awaiting_owner')
  assert.equal(cli('receipt', spec.id).ownerAction, '确认交付或描述调整')
  const before = fs.readFileSync(path.join(f.root, 'docs/tasks/portable-task/task.json'))
  assert.equal(cli('status', spec.id)[0].evidenceCurrent, true)
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/portable-task/task.json')), before)
})

test('跨进程 next 接续真实失败修复与交付，早期取消另一需求', t => {
  const f = fixture(t)
  f.write('src/service.mjs', 'export const total = () => 0;')
  f.write('docs/tests/service.test.mjs', "import assert from 'node:assert/strict'; import { total } from '../../src/service.mjs'; assert.equal(total([1, 2, 3]), 6);")
  f.write('docs/adapter.json', profile); f.write('docs/intake.json', spec)
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [CLI, '--project', f.root, ...args], { cwd: bundle, encoding: 'utf8' })
    assert.ok([0, 1].includes(result.status), result.stderr)
    return { status: result.status, value: JSON.parse(result.stdout) }
  }
  cli('init', '--adapter', 'docs/adapter.json'); cli('new', '--spec', 'docs/intake.json')
  f.write('docs/tasks/portable-task/plan.md', '使用真实 Node 测试验证加总模块；失败后从待办定位日志，记录修复并重新检查，之后复核交付。'.repeat(4))
  cli('plan', spec.id); cli('start', spec.id)
  assert.equal(cli('verify', spec.id).status, 1)
  const pending = cli('next').value
  assert.equal(pending.selected, spec.id); assert.equal(pending.action, 'rework')
  assert.equal(pending.tasks[0].checks[0].passed, false)
  cli('rework', spec.id, '--reason', '真实模块错误，修复加总实现')
  f.write('src/service.mjs', 'export const total = values => values.reduce((a, b) => a + b, 0);')
  assert.equal(cli('verify', spec.id).status, 0)
  assert.equal(cli('next', spec.id).value.action, 'review')
  const task = JSON.parse(fs.readFileSync(path.join(f.root, 'docs/tasks/portable-task/task.json')))
  f.write('docs/review.json', { reviewer: '真实 CLI 夹具复核', summary: '模块修复且保留失败记录', findings: [], criteria: [{ id: 'actual-behavior', result: 'passed', evidence: [task.runs.at(-1).report] }] })
  cli('review', spec.id, '--file', 'docs/review.json'); cli('deliver', spec.id)
  const delivered = cli('next').value
  assert.equal(delivered.action, 'decision'); assert.equal(delivered.tasks[0].attempts.used, 2)
  const other = { ...spec, id: 'cancel-before-start' }
  f.write('docs/other.json', other); cli('new', '--spec', 'docs/other.json')
  f.write('docs/cancel.json', { source: 'explicit-user-message', reference: '夹具取消消息', note: '取消第二个需求', decision: 'cancel' })
  assert.equal(cli('decision', other.id, '--file', 'docs/cancel.json').value.stage, 'cancelled')
  assert.equal(cli('next').value.selected, spec.id)
  assert.equal(cli('next').value.counts.closed, 1)
})

test('next 在写锁存在时只读查询，不生成或刷新文件，不执行检查', t => {
  const f = fixture(t)
  f.write('docs/ai-delivery/project.json', profile); f.write('src/service.mjs', 'export const total = () => 0;')
  f.write('docs/spec.json', spec)
  runCLI(['new', '--spec', 'docs/spec.json'], f.root)
  const before = snapshot(f.root)
  assert.equal(decoded(runCLI(['next'], f.root)).action, 'plan')
  assert.deepEqual(snapshot(f.root), before)
  withLock(f.root, () => {
    const locked = snapshot(f.root)
    assert.equal(decoded(runCLI(['next', spec.id], f.root)).action, 'wait')
    assert.equal(decoded(runCLI(['next'], f.root)).runtime.alive, true)
    assert.deepEqual(snapshot(f.root), locked)
    f.write('docs/cancel.json', { source: 'explicit-user-message', reference: '夹具取消', note: '取消', decision: 'cancel' })
    assert.throws(() => runCLI(['decision', spec.id, '--file', 'docs/cancel.json'], f.root), /已有写入任务/)
  })
  assert.throws(() => runCLI(['next', spec.id, 'extra'], f.root), /额外参数/)
  assert.throws(() => runCLI(['next', '../escape'], f.root), /ID/)
})

test('真实 CLI 的 begin/context/verify/finish 完整交付并保持必要检查', t => {
  const f = fixture(t)
  f.write('src/service.mjs', 'export const total = values => values.reduce((a, b) => a + b, 0);')
  f.write('docs/tests/service.test.mjs', "import assert from 'node:assert/strict'; import { total } from '../../src/service.mjs'; assert.equal(total([1, 2, 3]), 6);")
  f.write('docs/adapter.json', { ...profile, checkPolicy: { always: ['unit'], rules: [] } })
  const { checks, ...intake } = spec
  f.write('docs/intake.json', { ...intake, plan: '依据需求实现加总行为并完整跟踪源文件与检查脚本；先用真实 Node 验证，再根据原始报告逐项复核；全部通过后交付等待用户决定，错误保留日志并恢复。'.repeat(2) })
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [CLI, '--project', f.root, ...args], { cwd: bundle, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr + result.stdout)
    return JSON.parse(result.stdout)
  }
  cli('init', '--adapter', 'docs/adapter.json')
  assert.equal(cli('begin', '--spec', 'docs/intake.json').stage, 'executing')
  const before = snapshot(f.root)
  const context = cli('context', spec.id)
  assert.deepEqual(context.requiredChecks, ['unit']); assert.equal(context.request, spec.request)
  assert.equal(context.baseline, undefined); assert.deepEqual(snapshot(f.root), before)
  assert.equal(cli('verify', spec.id).checks[0].passed, true)
  const task = JSON.parse(fs.readFileSync(path.join(f.root, 'docs/tasks/portable-task/task.json')))
  f.write('docs/review.json', { reviewer: '当前测试会话', summary: '真实 Node 行为检查且完整覆盖条件', findings: [], criteria: [{ id: 'actual-behavior', result: 'passed', evidence: [task.runs.at(-1).report] }] })
  assert.equal(cli('finish', spec.id, '--file', 'docs/review.json').stage, 'awaiting_owner')
  assert.equal(cli('context', spec.id).evidenceCurrent, true)
  f.write('docs/tests/service.test.mjs', 'throw new Error("changed test");')
  assert.equal(cli('context', spec.id).evidenceCurrent, false)
})

test('合并命令参数错误和写锁不能创建任务，context 在写锁下仍只读', t => {
  const f = fixture(t)
  f.write('docs/ai-delivery/project.json', profile)
  f.write('docs/spec.json', { ...spec, plan: '明确需求与完整文件范围，完成实现后执行相关项目检查，按实际证据复核交付，失败有限返工并保留恢复记录。'.repeat(3) })
  assert.throws(() => runCLI(['begin', '--spec', 'docs/spec.json', 'extra'], f.root), /额外参数/)
  withLock(f.root, () => assert.throws(() => runCLI(['begin', '--spec', 'docs/spec.json'], f.root), /已有写入任务/))
  assert.equal(fs.existsSync(path.join(f.root, 'docs/tasks')), false)
  runCLI(['begin', '--spec', 'docs/spec.json'], f.root)
  withLock(f.root, () => {
    const before = snapshot(f.root)
    assert.equal(decoded(runCLI(['context', spec.id], f.root)).readOnly, true)
    assert.deepEqual(snapshot(f.root), before)
  })
  assert.throws(() => runCLI(['context', spec.id, 'extra'], f.root), /需要任务 ID/)
  assert.throws(() => runCLI(['context', '../outside'], f.root), /ID/)
})

test('配置路径不允许越界、符号链接和额外参数', t => {
  const f = fixture(t)
  assert.throws(() => runCLI(['--config', '../escape.json', 'init'], f.root), /越界/)
  assert.throws(() => runCLI(['init', 'unexpected'], f.root), /仅接受/)
  assert.throws(() => runCLI(['--project', f.root, '--project', f.root, 'doctor']), /唯一/)
  f.write('docs/config.json', profile)
  fs.symlinkSync(path.join(f.root, 'docs/config.json'), path.join(f.root, 'docs/link.json'))
  assert.throws(() => runCLI(['--config', 'docs/link.json', 'doctor'], f.root), /符号链接/)
})

test('用户安装自包含、重复安装幂等、保留规则、卸载准确回滚', t => {
  const f = fixture(t)
  const rules = '不要操作 Git\n不要启动工程\n文档放 docs\n'
  f.write('.codex/AGENTS.md', rules)
  fs.chmodSync(path.join(f.root, '.codex/AGENTS.md'), 0o600)
  const result = manageInstallation({ home: f.root })
  assert.equal(result.installed, true)
  const manifestFile = path.join(f.root, '.agents/skills/ai-delivery/install-manifest.json')
  const before = fs.readFileSync(manifestFile)
  assert.equal(manageInstallation({ home: f.root }).changed, false)
  assert.deepEqual(fs.readFileSync(manifestFile), before)
  const version = spawnSync(result.bin, ['--version'], { encoding: 'utf8' })
  assert.equal(version.status, 0, version.stderr); assert.equal(version.stdout.trim(), TOOL_VERSION)
  assert.equal(manageInstallation({ mode: 'doctor', home: f.root }).routeActive, true)
  const global = path.join(f.root, '.codex/AGENTS.md')
  assert.ok(fs.readFileSync(global, 'utf8').startsWith(rules))
  assert.equal(fs.statSync(global).mode & 0o777, 0o600)
  fs.appendFileSync(global, '\n用户后来增加的规则\n')
  f.write('.agents/skills/ai-delivery/user-note.txt', '用户文件保留')
  manageInstallation({ mode: 'uninstall', home: f.root })
  assert.equal(fs.readFileSync(global, 'utf8'), rules + '\n用户后来增加的规则\n')
  assert.equal(fs.statSync(global).mode & 0o777, 0o600)
  assert.equal(fs.existsSync(result.bin), false)
  assert.equal(fs.readFileSync(path.join(f.root, '.agents/skills/ai-delivery/user-note.txt'), 'utf8'), '用户文件保留')
  assert.equal(manageInstallation({ mode: 'uninstall', home: f.root }).changed, false)
})

test('安装 dry-run 没有写入，非本工具同名技能或命令不能覆盖', t => {
  const f = fixture(t)
  assert.equal(manageInstallation({ home: f.root, dryRun: true }).installed, false)
  assert.equal(fs.existsSync(path.join(f.root, '.agents')), false)
  f.write('.agents/skills/ai-delivery/SKILL.md', 'other owner')
  assert.throws(() => manageInstallation({ home: f.root }), /同名技能/)
  assert.equal(fs.readFileSync(path.join(f.root, '.agents/skills/ai-delivery/SKILL.md'), 'utf8'), 'other owner')
  const g = fixture(t); g.write('.local/bin/ai-delivery', 'foreign command')
  assert.throws(() => manageInstallation({ home: g.root }), /同名命令/)
})

test('修改过的安装与路由拒绝卸载和升级，现有 override 得到有效路由', t => {
  const f = fixture(t); f.write('.codex/AGENTS.override.md', '优先规则\n')
  const result = manageInstallation({ home: f.root })
  assert.ok(result.route.endsWith('AGENTS.override.md'))
  f.write('.agents/skills/ai-delivery/SKILL.md', 'user customized')
  assert.throws(() => manageInstallation({ mode: 'uninstall', home: f.root }), /已被修改/)
  assert.throws(() => manageInstallation({ home: f.root }), /已被修改/)
  assert.equal(fs.existsSync(result.bin), true)
  const g = fixture(t); const installed = manageInstallation({ home: g.root })
  fs.writeFileSync(installed.route, 'route replaced')
  assert.throws(() => manageInstallation({ mode: 'uninstall', home: g.root }), /路由段已被修改/)
  assert.equal(fs.existsSync(installed.bin), true)
})

test('没有原始全局规则时卸载恢复未安装状态，符号链接保护生效', t => {
  const f = fixture(t); manageInstallation({ home: f.root }); manageInstallation({ home: f.root, mode: 'uninstall' })
  assert.equal(fs.existsSync(path.join(f.root, '.codex/AGENTS.md')), false)
  assert.equal(fs.existsSync(path.join(f.root, '.agents/skills/ai-delivery')), false)
  const g = fixture(t); fs.symlinkSync(f.root, path.join(g.root, '.agents'))
  assert.throws(() => manageInstallation({ home: g.root }), /符号链接/)
})

test('CLI 调整需求要求完整参数，inspect/doctor 在活动写锁下只读', t => {
  const f = fixture(t); f.write('docs/adapter.json', profile)
  runCLI(['init', '--adapter', 'docs/adapter.json'], f.root)
  f.write('docs/spec.json', spec); runCLI(['new', '--spec', 'docs/spec.json'], f.root)
  f.write('docs/amend.json', { ...spec, request: '用户补充需求' })
  assert.throws(() => runCLI(['amend', spec.id, '--spec', 'docs/amend.json'], f.root), /--reason/)
  assert.equal(decoded(runCLI(['amend', spec.id, '--spec', 'docs/amend.json', '--reason', '用户追加范围'], f.root)).event.action, 'amended')
  f.write('docs/workflow/runtime/writer.lock', { pid: process.pid, startedAt: 'active' })
  const before = fs.readFileSync(path.join(f.root, 'docs/tasks/portable-task/task.json'))
  assert.equal(decoded(runCLI(['inspect', spec.id], f.root)).runtime.alive, true)
  const doctor = decoded(runCLI(['doctor'], f.root))
  assert.equal(doctor.ready, true); assert.equal(doctor.writeAvailable, false)
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/portable-task/task.json')), before)
  assert.equal(fs.existsSync(path.join(f.root, 'docs/workflow/runtime/writer.lock')), true)
})

function legacyManifest(f, { keepNewFile = false } = {}) {
  const relative = '.agents/skills/ai-delivery/install-manifest.json'
  const file = path.join(f.root, relative)
  const manifest = JSON.parse(fs.readFileSync(file))
  manifest.version = '0.3.0'
  const added = '.agents/skills/ai-delivery/references/recovery.md'
  delete manifest.files[added]
  if (!keepNewFile) fs.unlinkSync(path.join(f.root, added))
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
  return { file, manifest, added }
}

test('升级接受缺少新资源的旧清单，移除已弃用的拥有文件并保留用户文件', t => {
  const f = fixture(t); manageInstallation({ home: f.root })
  const old = legacyManifest(f)
  const obsolete = '.agents/skills/ai-delivery/references/obsolete.md'
  f.write(obsolete, 'old owned reference')
  old.manifest.files[obsolete] = crypto.createHash('sha256').update('old owned reference').digest('hex')
  fs.writeFileSync(old.file, JSON.stringify(old.manifest))
  f.write('.agents/skills/ai-delivery/user-note.txt', 'user note')
  assert.equal(manageInstallation({ home: f.root }).changed, true)
  assert.equal(fs.existsSync(path.join(f.root, old.added)), true)
  assert.equal(fs.existsSync(path.join(f.root, obsolete)), false)
  assert.equal(fs.readFileSync(path.join(f.root, '.agents/skills/ai-delivery/user-note.txt'), 'utf8'), 'user note')
  assert.equal(manageInstallation({ home: f.root, mode: 'doctor' }).version, TOOL_VERSION)
  assert.equal(manageInstallation({ home: f.root }).changed, false)
})

test('升级新增目标已有用户文件时完整停止，原清单和全局规则不改变', t => {
  const f = fixture(t); manageInstallation({ home: f.root })
  const old = legacyManifest(f, { keepNewFile: true })
  f.write(old.added, 'user-owned content')
  const before = fs.readFileSync(old.file)
  const rules = fs.readFileSync(path.join(f.root, '.codex/AGENTS.md'))
  assert.throws(() => manageInstallation({ home: f.root }), /非拥有文件/)
  assert.deepEqual(fs.readFileSync(old.file), before)
  assert.deepEqual(fs.readFileSync(path.join(f.root, '.codex/AGENTS.md')), rules)
  assert.equal(fs.readFileSync(path.join(f.root, old.added), 'utf8'), 'user-owned content')
})

test('后出现的 override 自动接收路由，两个文件的用户规则和权限保留', t => {
  const f = fixture(t); f.write('.codex/AGENTS.md', '原用户规则\n')
  manageInstallation({ home: f.root })
  fs.appendFileSync(path.join(f.root, '.codex/AGENTS.md'), '后来追加的规则\n')
  f.write('.codex/AGENTS.override.md', '优先用户规则\n')
  fs.chmodSync(path.join(f.root, '.codex/AGENTS.override.md'), 0o600)
  assert.equal(manageInstallation({ home: f.root, mode: 'doctor' }).routeActive, false)
  const before = fs.readFileSync(path.join(f.root, '.codex/AGENTS.md'))
  manageInstallation({ home: f.root, dryRun: true })
  assert.deepEqual(fs.readFileSync(path.join(f.root, '.codex/AGENTS.md')), before)
  const upgrade = manageInstallation({ home: f.root })
  assert.ok(upgrade.route.endsWith('AGENTS.override.md'))
  assert.equal(manageInstallation({ home: f.root, mode: 'doctor' }).routeActive, true)
  assert.equal(fs.readFileSync(path.join(f.root, '.codex/AGENTS.md'), 'utf8'), '原用户规则\n后来追加的规则\n')
  assert.equal(fs.statSync(upgrade.route).mode & 0o777, 0o600)
  manageInstallation({ home: f.root, mode: 'uninstall' })
  assert.equal(fs.readFileSync(upgrade.route, 'utf8'), '优先用户规则\n')
  assert.equal(fs.readFileSync(path.join(f.root, '.codex/AGENTS.md'), 'utf8'), '原用户规则\n后来追加的规则\n')
})

test('路由迁移目标已有标记或旧清单路径越界时不会写入', t => {
  const f = fixture(t); manageInstallation({ home: f.root })
  const before = fs.readFileSync(path.join(f.root, '.agents/skills/ai-delivery/install-manifest.json'))
  f.write('.codex/AGENTS.override.md', '<!-- ai-delivery:begin -->\nforeign marker\n')
  assert.throws(() => manageInstallation({ home: f.root }), /非拥有路由/)
  assert.deepEqual(fs.readFileSync(path.join(f.root, '.agents/skills/ai-delivery/install-manifest.json')), before)
  const g = fixture(t); manageInstallation({ home: g.root })
  const file = path.join(g.root, '.agents/skills/ai-delivery/install-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(file)); manifest.files['.agents/skills/ai-delivery/scripts/../../../foreign'] = 'bad hash'
  fs.writeFileSync(file, JSON.stringify(manifest))
  assert.throws(() => manageInstallation({ home: g.root }), /安装路径无效/)
  assert.equal(fs.existsSync(path.join(g.root, '.local/bin/ai-delivery')), true)
})
