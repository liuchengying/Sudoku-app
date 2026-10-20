import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { isDeepStrictEqual } from 'node:util'
import { validateCheckPolicy, selectChecks } from './policy.mjs'

const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const json = value => JSON.stringify(value, null, 2) + '\n'
const now = () => new Date().toISOString()
const ID = /^[a-z0-9][a-z0-9-]{2,79}$/
const LABELS = { received: '已收件', planned: '已计划', executing: '执行中', verifying: '检查中', verified: '检查通过', reviewed: '复核通过', awaiting_owner: '待用户验收', accepted: '用户已确认交付', cancelled: '已取消' }
export const TOOL_VERSION = '0.5.1'
const CHECK_ID = /^[a-z][a-z0-9-]{0,63}$/

function assert(condition, message) { if (!condition) throw new Error(message) }
function nonempty(value, label) { assert(typeof value === 'string' && value.trim().length > 0, `${label}不能为空`); return value.trim() }

export function safePath(root, relative, materialsOnly = false) {
  assert(typeof relative === 'string' && relative.length > 0 && !relative.includes('\\') && !relative.includes('\0'), '无效相对路径')
  const segments = relative.split('/')
  assert(!path.isAbsolute(relative) && segments.every(s => s && s !== '.' && s !== '..'), `禁止路径越界：${relative}`)
  assert(!['.git', '.codex', '.agents', '.aws', 'node_modules'].includes(segments[0]), `禁止访问：${relative}`)
  assert(!materialsOnly || ['docs', '.ai-agent'].includes(segments[0]), '工作材料必须位于 docs/ 或 .ai-agent/')
  let target = path.resolve(root)
  for (const segment of segments) {
    target = path.join(target, segment)
    const stat = fs.lstatSync(target, { throwIfNoEntry: false })
    if (stat) assert(!stat.isSymbolicLink(), `禁止符号链接：${relative}`)
  }
  return target
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${crypto.randomUUID()}.tmp`
  try { fs.writeFileSync(temp, content, { flag: 'wx' }); fs.renameSync(temp, file) }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp) }
}

export function inspectLock(root, runtimeDir = 'docs/workflow/runtime') {
  const file = safePath(root, `${runtimeDir}/writer.lock`, true)
  if (!fs.existsSync(file)) return { exists: false, alive: false }
  try {
    const owner = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert(Number.isInteger(owner.pid) && owner.pid > 0, '锁 PID 无效，不能自动判定持有进程')
    let alive = true
    try { process.kill(owner.pid, 0) } catch (error) { if (error.code === 'ESRCH') alive = false; else if (error.code !== 'EPERM') throw error }
    return { exists: true, pid: owner.pid, startedAt: owner.startedAt, alive }
  } catch (error) { return { exists: true, alive: null, error: error.message } }
}

export function withLock(root, callback, runtimeDir = 'docs/workflow/runtime') {
  const lock = safePath(root, `${runtimeDir}/writer.lock`, true)
  fs.mkdirSync(path.dirname(lock), { recursive: true })
  if (fs.existsSync(lock)) {
    const owner = inspectLock(root, runtimeDir)
    assert(!owner.error, `锁记录不可判定：${owner.error}；先 inspect，保留记录并核实持有进程`)
    assert(!owner.alive, `已有写入任务运行，PID ${owner.pid}；请勿并发修改`)
    fs.renameSync(lock, `${lock}.interrupted-${crypto.randomUUID()}.json`)
  }
  fs.writeFileSync(lock, json({ pid: process.pid, startedAt: now() }), { flag: 'wx' })
  try { return callback() } finally { fs.unlinkSync(lock) }
}

export function createWorkflow(root, profile, execute = (command, args, options) => spawnSync(command, args, options)) {
  root = fs.realpathSync(root)
  assert([1, 2].includes(profile.schemaVersion) && Array.isArray(profile.watch) && profile.watch.length > 0, '项目配置格式无效')
  assert(Array.isArray(profile.checks) && profile.checks.length > 0 && new Set(profile.checks).size === profile.checks.length, '请先注册项目脚本检查')
  assert(profile.commands && typeof profile.commands === 'object' && !Array.isArray(profile.commands), '请配置项目 commands 适配器')
  for (const id of profile.checks) {
    assert(CHECK_ID.test(id) && Array.isArray(profile.commands[id]) && profile.commands[id].length > 0, `未注册检查：${id}`)
    for (const command of profile.commands[id]) {
      nonempty(command.executable, '检查可执行程序')
      assert(!command.executable.includes('\0'), '无效可执行程序')
      assert(!['git', 'sh', 'bash', 'zsh', 'cmd', 'powershell', 'pwsh'].includes(path.basename(command.executable).replace(/\.exe$/i, '').toLowerCase()), '禁止将 Git 或 shell 注册为脚本检查')
      assert(Array.isArray(command.args) && command.args.every(arg => typeof arg === 'string' && !arg.includes('\0')), '检查参数必须为字符串数组')
      assert(!command.outputs || (Array.isArray(command.outputs) && command.outputs.every(output => typeof output === 'string')), '检查输出必须为路径数组')
    }
  }
  assert(Number.isInteger(profile.maxRepairRounds) && profile.maxRepairRounds >= 0 && profile.maxRepairRounds <= 10, '修复次数无效')
  assert(Number.isInteger(profile.checkTimeoutMs) && profile.checkTimeoutMs > 0 && profile.checkTimeoutMs <= 300000, '检查超时无效')
  for (const relative of [...profile.watch, ...(profile.exclude ?? [])]) safePath(root, relative)
  validateCheckPolicy(profile, relative => safePath(root, relative))
  const taskRoot = profile.taskRoot ?? 'docs/tasks'
  const statusFile = profile.statusFile ?? 'docs/workflow/STATUS.md'
  const runtimeDir = profile.runtimeDir ?? 'docs/workflow/runtime'
  for (const relative of [taskRoot, statusFile, runtimeDir]) {
    safePath(root, relative, true)
    assert(relative.startsWith('docs/'), '项目记录与临时状态必须放在 docs/')
    assert(!profile.watch.some(prefix => (relative === prefix || relative.startsWith(prefix + '/')) && !(profile.exclude ?? []).some(exclusion => relative === exclusion || relative.startsWith(exclusion + '/'))), '跟踪范围包含生成状态，请加入 exclude')
  }
  assert(taskRoot !== runtimeDir && !taskRoot.startsWith(runtimeDir + '/') && !runtimeDir.startsWith(taskRoot + '/'), '任务与运行目录不能互相嵌套')
  new Intl.DateTimeFormat('zh-CN', { timeZone: profile.timezone ?? 'UTC' })
  const read = relative => fs.readFileSync(safePath(root, relative), 'utf8')
  const readJson = relative => JSON.parse(read(relative))
  const write = (relative, content) => atomicWrite(safePath(root, relative, true), content)
  const base = id => { assert(ID.test(id), '任务 ID 只允许小写字母、数字和短横线'); return `${taskRoot}/${id}` }
  const load = id => {
    const task = readJson(`${base(id)}/task.json`)
    assert([1, 2].includes(task.schemaVersion) && task.id === id && LABELS[task.status], '任务状态格式无效')
    return task
  }
  const save = task => { task.updatedAt = now(); task.toolVersion = TOOL_VERSION; write(`${base(task.id)}/task.json`, json(task)); report(); return task }
  const event = (task, action, note = '') => task.events.push({ at: now(), action, status: task.status, note, toolVersion: TOOL_VERSION })
  const requireStatus = (task, statuses) => assert(statuses.includes(task.status), `当前状态 ${LABELS[task.status]} 不允许此操作`)
  const matches = (file, prefix) => file === prefix || file.startsWith(prefix + '/')

  function filesSnapshot() {
    const files = {}
    const visited = new Set()
    function walk(relative) {
      if (visited.has(relative)) return
      visited.add(relative)
      if ((profile.exclude ?? []).some(prefix => matches(relative, prefix))) return
      const file = safePath(root, relative)
      if (!fs.existsSync(file)) { files[relative] = null; return }
      const stat = fs.lstatSync(file)
      if (stat.isDirectory()) for (const entry of fs.readdirSync(file).sort()) walk(`${relative}/${entry}`)
      else if (stat.isFile()) files[relative] = hash(fs.readFileSync(file))
      else throw new Error(`不支持的文件类型：${relative}`)
    }
    profile.watch.forEach(walk)
    return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
  }

  function snapshotReader() {
    let snapshot, error
    return () => {
      if (error) throw error
      try { return snapshot ??= filesSnapshot() } catch (failure) { error = failure; throw failure }
    }
  }
  function fingerprint(task, snapshot = filesSnapshot) {
    return hash(JSON.stringify({
      files: snapshot(), profile,
      definition: { title: task.title, request: task.request, scope: task.scope, criteria: task.criteria, checks: task.checks, manualChecks: task.manualChecks },
      ...(task.revisions?.length ? { revisions: task.revisions } : {}),
      ...(task.schemaVersion >= 2 ? { engine: ['workflow.mjs', 'ai-delivery.mjs', 'policy.mjs'].map(file => ({ file, hash: hash(fs.readFileSync(new URL(file, import.meta.url))) })) } : {}),
      brief: read(`${base(task.id)}/brief.md`), plan: read(`${base(task.id)}/plan.md`)
    }))
  }

  function changedFiles(task, snapshot = filesSnapshot) {
    const current = snapshot()
    return [...new Set([...Object.keys(task.baseline), ...Object.keys(current)])].sort().filter(file => task.baseline[file] !== current[file])
  }

  function proof(files) {
    return files.map(file => ({ path: file, sha256: hash(fs.readFileSync(safePath(root, file, true))) }))
  }
  function proofValid(items) {
    try { return Array.isArray(items) && items.length > 0 && items.every(item => /^[a-f0-9]{64}$/.test(item.sha256) && fs.existsSync(safePath(root, item.path, true)) && hash(fs.readFileSync(safePath(root, item.path, true))) === item.sha256) }
    catch { return false }
  }
  function verificationConsistent(task) {
    try {
      const run = task.verification
      const report = task.runs.at(-1).report
      assert(report.startsWith(`${base(task.id)}/evidence/`), '检查结果必须属于当前任务')
      safePath(root, report, true)
      const original = readJson(report)
      const directory = path.posix.dirname(report)
      const outputs = task.checks.flatMap(id => checkCommands(id, directory).flatMap(command => command.outputs))
      const expected = [report, `${directory}/input.json`, ...run.checks.map(check => check.log), ...outputs]
      return run.checks.length === task.checks.length && run.checks.every((check, index) => check.id === task.checks[index] && check.passed === true)
        && original.passed === true && original.id === run.id && original.fingerprint === run.fingerprint
        && isDeepStrictEqual(original.checks, run.checks) && expected.every(file => run.evidence.some(item => item.path === file))
    } catch { return false }
  }
  function fresh(task) {
    assert(task.verification?.passed === true, '需要一次全部通过的检查')
    assert(fingerprint(task) === task.verification.fingerprint, '文件、需求或计划已变化，请 rework 后重新检查')
    assert(proofValid(task.verification.evidence), '检查证据已变化，请重新检查')
    assert(verificationConsistent(task), '检查记录与原始结果不一致，请核实证据并重新检查')
    assert((task.revisions ?? []).every(revision => proofValid(revision.evidence)), '需求调整历史已变化，请核实并恢复归档')
  }

  function validateSpec(spec) {
    assert(ID.test(spec.id), '无效任务 ID')
    nonempty(spec.title, '标题'); nonempty(spec.request, '原始需求')
    assert(Array.isArray(spec.scope) && spec.scope.length > 0, '需要声明修改范围')
    spec.scope.forEach(relative => safePath(root, relative))
    validateScope(spec.scope)
    assert(Array.isArray(spec.criteria) && spec.criteria.length > 0, '需要验收条件')
    const ids = new Set()
    for (const criterion of spec.criteria) {
      assert(ID.test(criterion.id) && !ids.has(criterion.id), '验收条件 ID 无效或重复')
      ids.add(criterion.id); nonempty(criterion.description, '验收条件描述')
    }
    const selection = selectChecks(profile, spec.scope, spec.checks)
    assert(!spec.manualChecks || (Array.isArray(spec.manualChecks) && spec.manualChecks.every(item => typeof item === 'string' && item.trim())), '人工待验收项格式无效')
    return selection
  }
  function validateScope(scope) {
    const records = [taskRoot, statusFile, runtimeDir, 'docs/intake']
    for (const relative of scope) {
      if (records.some(prefix => matches(relative, prefix))) continue
      assert(profile.watch.some(prefix => matches(relative, prefix)) && !(profile.exclude ?? []).some(prefix => matches(relative, prefix)), `修改范围未完整纳入 watch 或已被排除：${relative}；先完善项目跟踪配置`)
    }
  }
  function writeBrief(task) {
    write(`${base(task.id)}/brief.md`, `# ${task.title}\n\n原始需求：${task.request}\n\n## 验收条件\n\n${task.criteria.map(c => `- ${c.id}：${c.description}`).join('\n')}\n\n## 修改范围\n\n${task.scope.map(s => `- ${s}`).join('\n')}\n\n## 允许的检查\n\n${task.checks.join('、')}\n\n## 未纳入本次自动验收\n\n${task.manualChecks.map(s => `- ${s}`).join('\n') || '无'}\n`)
  }
  function create(spec) {
    const selection = validateSpec(spec)
    const directory = base(spec.id)
    assert(!fs.existsSync(safePath(root, directory)), '任务已存在，不能覆盖')
    const task = { schemaVersion: 2, toolVersion: TOOL_VERSION, id: spec.id, title: spec.title, request: spec.request, scope: spec.scope, criteria: spec.criteria, checks: selection.checks, checkSelection: selection, manualChecks: spec.manualChecks ?? [], status: 'received', createdAt: now(), updatedAt: now(), baseline: filesSnapshot(), repairRounds: 0, runs: [], events: [] }
    writeBrief(task)
    write(`${directory}/plan.md`, '# 实施计划\n\n[待填写：现状、方案、执行步骤、检查方法、恢复方式]\n')
    event(task, 'created'); return save(task)
  }

  function amend(id, spec, reason) {
    const task = load(id)
    requireStatus(task, ['received', 'planned', 'executing', 'verifying', 'verified', 'reviewed', 'awaiting_owner'])
    const selection = validateSpec(spec); assert(spec.id === id, '调整任务 ID 必须一致'); nonempty(reason, '调整原因')
    assert(task.checks.every(check => selection.checks.includes(check)), '需求调整不能减少已有检查；需要重定范围时保留原任务并建立新任务说明原因')
    const consumesRepair = !['received', 'planned'].includes(task.status)
    assert(!consumesRepair || task.repairRounds < profile.maxRepairRounds, '达到修复轮数上限，请拆分新任务')
    const revision = String((task.revisions?.length ?? 0) + 1).padStart(4, '0')
    const directory = `${base(id)}/revisions/${revision}`
    assert(!fs.existsSync(safePath(root, directory, true)), '需求调整历史已存在，不能覆盖')
    const snapshots = [{ source: `${base(id)}/task.json`, name: 'task.json' }, { source: `${base(id)}/brief.md`, name: 'brief.md' }, { source: `${base(id)}/plan.md`, name: 'plan.md' }]
    if (task.review) snapshots.push({ source: task.review.file, name: 'review.json' })
    if (task.delivery) snapshots.push({ source: task.delivery.file, name: 'delivery.md' })
    const history = { at: now(), reason, previousStatus: task.status, files: snapshots.map(item => ({ source: item.source, snapshot: `${directory}/${item.name}` })) }
    // Read every input before writing any archive; missing historical materials stop the amendment.
    const data = snapshots.map(item => ({ ...item, data: read(item.source) }))
    for (const item of data) write(`${directory}/${item.name}`, item.data)
    write(`${directory}/history.json`, json(history))
    task.revisions ??= []
    task.revisions.push({ id: revision, at: history.at, reason, directory, evidence: proof([...data.map(item => `${directory}/${item.name}`), `${directory}/history.json`]) })
    for (const key of ['title', 'request', 'scope', 'criteria']) task[key] = spec[key]
    task.checks = selection.checks; task.checkSelection = selection
    task.manualChecks = spec.manualChecks ?? []
    if (consumesRepair) task.repairRounds++
    delete task.verification; delete task.review; delete task.delivery
    task.status = 'received'; task.toolVersion = TOOL_VERSION
    writeBrief(task)
    write(`${base(id)}/plan.md`, '# 调整后的实施计划\n\n[待填写：依据新需求更新范围、实现、检查和恢复；旧计划在 revisions 中保留]\n')
    event(task, 'amended', reason); return save(task)
  }

  function plan(id) {
    const task = load(id); requireStatus(task, ['received'])
    const content = read(`${base(id)}/plan.md`)
    validatePlan(content)
    task.status = 'planned'; event(task, 'planned'); return save(task)
  }
  function start(id) {
    const task = load(id); requireStatus(task, ['planned'])
    task.status = 'executing'; event(task, 'started'); return save(task)
  }
  function validatePlan(content) {
    assert(typeof content === 'string' && content.trim().length >= 80 && !content.includes('[待填写'), '请先完成 plan.md 中的具体计划')
  }
  function begin(spec) {
    validateSpec(spec); validatePlan(spec.plan)
    const task = create(spec)
    write(`${base(task.id)}/plan.md`, spec.plan)
    plan(task.id)
    return start(task.id)
  }

  function checkCommands(id, runDirectory) {
    assert(profile.checks.includes(id), '未知或未授权检查')
    const values = { projectRoot: root, evidenceDir: runDirectory, taskDir: path.posix.dirname(path.posix.dirname(runDirectory)) }
    const expand = value => value.replace(/\{(projectRoot|evidenceDir|taskDir)\}/g, (_match, key) => values[key])
    return profile.commands[id].map(command => {
      const outputs = (command.outputs ?? []).map(expand)
      for (const output of outputs) {
        safePath(root, output, true)
        assert(output.startsWith(runDirectory + '/'), '检查报告必须保存在当前运行证据目录')
      }
      return { command: command.executable === 'node' ? process.execPath : expand(command.executable), args: command.args.map(expand), outputs }
    })
  }

  function verify(id) {
    const task = load(id); requireStatus(task, ['executing'])
    assert(task.runs.length < profile.maxRepairRounds + 1, '达到检查尝试上限，请保留结果并拆分新任务')
    validateScope(task.scope)
    selectChecks(profile, task.scope, task.checks)
    const snapshot = snapshotReader()
    const outside = changedFiles(task, snapshot).filter(file => !task.scope.some(prefix => matches(file, prefix)))
    assert(outside.length === 0, `发现声明范围外的变化：${outside.join('、')}；先协调任务范围`)
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`
    const directory = `${base(id)}/evidence/${runId}`
    const run = { id: runId, toolVersion: TOOL_VERSION, startedAt: now(), fingerprint: fingerprint(task, snapshot), passed: null, checks: [], evidence: [] }
    const artifacts = []
    write(`${directory}/input.json`, json({ fingerprint: run.fingerprint, checks: task.checks, files: snapshot(), startedAt: run.startedAt }))
    task.status = 'verifying'; task.verification = run; task.runs.push({ id: runId, report: `${directory}/result.json` }); event(task, 'verification-started'); save(task)
    try {
      for (const check of task.checks) {
        const started = Date.now(); const output = []; let passed = true
        for (const { command, args, outputs } of checkCommands(check, directory)) {
          const env = { ...process.env, NO_COLOR: '1', CI: '1' }
          // This is internal runner state, not project configuration. Inheriting it
          // makes nested `node --test` skip its files and return a false success.
          delete env.NODE_TEST_CONTEXT
          const result = execute(command, args, { cwd: root, encoding: 'utf8', timeout: profile.checkTimeoutMs, maxBuffer: 8 * 1024 * 1024, shell: false, env })
          output.push(`Command: ${path.basename(command)} ${args.join(' ')}\nExit: ${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? '\n' + result.error.message : ''}`)
          if (result.status !== 0 || result.error) { passed = false; break }
          for (const outputFile of outputs) {
            if (!fs.existsSync(safePath(root, outputFile, true))) { output.push(`Missing report: ${outputFile}`); passed = false; break }
            assert(fs.statSync(safePath(root, outputFile, true)).isFile(), '检查报告必须是文件')
            artifacts.push(outputFile)
          }
          if (!passed) break
        }
        const log = `${directory}/${check}.log`
        write(log, output.join('\n\n'))
        run.checks.push({ id: check, passed, durationMs: Date.now() - started, log })
        save(task)
        if (!passed) break
      }
      const ending = fingerprint(task)
      run.passed = run.checks.length === task.checks.length && run.checks.every(check => check.passed) && ending === run.fingerprint
      if (ending !== run.fingerprint) run.error = '检查期间输入文件发生变化，结果失效'
    } catch (error) { run.passed = false; run.error = error.message }
    run.finishedAt = now()
    write(`${directory}/result.json`, json({ ...run, evidence: undefined }))
    const evidence = [`${directory}/input.json`, `${directory}/result.json`, ...run.checks.map(check => check.log), ...new Set(artifacts)]
    run.evidence = proof(evidence)
    task.status = run.passed ? 'verified' : 'executing'; event(task, run.passed ? 'verification-passed' : 'verification-failed', run.error ?? '')
    return save(task)
  }

  function review(id, reviewFile) {
    const task = load(id); requireStatus(task, ['verified']); fresh(task)
    safePath(root, reviewFile, true)
    const document = readJson(reviewFile)
    nonempty(document.reviewer, '复核人/执行方式'); nonempty(document.summary, '复核结论')
    assert(Array.isArray(document.findings) && document.findings.length === 0, '存在未解决问题，请 rework 后修复')
    assert(Array.isArray(document.criteria) && document.criteria.length === task.criteria.length && new Set(document.criteria.map(c => c.id)).size === task.criteria.length, '必须逐项复核全部验收条件')
    const paths = []
    for (const criterion of task.criteria) {
      const item = document.criteria.find(c => c.id === criterion.id)
      assert(item?.result === 'passed' && Array.isArray(item.evidence) && item.evidence.length > 0, `验收条件 ${criterion.id} 缺少通过证据`)
      for (const file of item.evidence) { assert(fs.statSync(safePath(root, file, true)).isFile(), '证据必须是 docs/ 或 .ai-agent/ 内文件'); paths.push(file) }
    }
    const target = `${base(id)}/review.json`
    write(target, json({ ...document, reviewedAt: now(), fingerprint: task.verification.fingerprint }))
    task.review = { file: target, evidence: proof([...new Set([target, ...paths])]) }
    task.status = 'reviewed'; event(task, 'reviewed', document.reviewer); return save(task)
  }

  function deliver(id) {
    const task = load(id); requireStatus(task, ['reviewed']); fresh(task)
    assert(proofValid(task.review.evidence), '复核材料已变化，请重新复核')
    const file = `${base(id)}/delivery.md`
    const link = relative => path.posix.relative(base(id), relative)
    const changed = changedFiles(task)
    write(file, `# ${task.title}：交付包\n\n状态：待用户验收；本次交付不代表发布。\n\n原始需求：${task.request}\n\n## 验收结果\n\n${task.criteria.map(c => `- 已复核：${c.description}`).join('\n')}\n\n## 检查证据\n\n${task.verification.checks.map(c => `- ${c.id}：通过，${c.durationMs} ms；[日志](${link(c.log)})`).join('\n')}\n\n[完整检查结果](${link(task.runs.at(-1).report)}) · [复核记录](review.json) · [实施计划](plan.md)\n\n## 从任务收件后检测到的文件变化\n\n${changed.map(f => `- ${f}`).join('\n') || '无；此前搭建的基础材料以实施计划为准。'}\n\n## 未验证或未执行\n\n${task.manualChecks.map(s => `- ${s}`).join('\n') || '无额外设备验收。'}\n\n## 放行与恢复\n\n请审阅计划中的具体实现和恢复步骤；需要调整时退回当前任务。只有收到用户明确确认，AI 才记录交付已接受。发布、Git 和设备操作另按授权执行。\n\n检查输入指纹：${task.verification.fingerprint}\n\n生成时间：${now()}\n`)
    task.delivery = { file, sha256: hash(read(file)), fingerprint: task.verification.fingerprint }
    task.status = 'awaiting_owner'; event(task, 'delivered'); return save(task)
  }
  function finish(id, reviewFile) {
    const task = load(id); requireStatus(task, ['verified', 'reviewed'])
    safePath(root, reviewFile, true)
    if (task.status === 'verified') review(id, reviewFile)
    else {
      const { reviewedAt, fingerprint: _fingerprint, ...original } = readJson(task.review.file)
      assert(isDeepStrictEqual(readJson(reviewFile), original), '复核输入与已记录结论不同；先恢复材料或 rework，不能覆盖已有复核')
    }
    return deliver(id)
  }

  function rework(id, reason) {
    const task = load(id); requireStatus(task, ['executing', 'verifying', 'verified', 'reviewed', 'awaiting_owner'])
    nonempty(reason, '返工原因'); assert(task.repairRounds < profile.maxRepairRounds, '达到修复轮数上限，请提交新的明确范围或拆分任务')
    task.repairRounds++; task.status = 'executing'; delete task.verification; delete task.review; delete task.delivery
    event(task, 'rework', reason); return save(task)
  }

  function decision(id, decisionFile) {
    const task = load(id)
    safePath(root, decisionFile, true)
    const document = readJson(decisionFile)
    assert(document.source === 'explicit-user-message', '只能记录来自用户明确消息的决定')
    nonempty(document.reference, '用户消息引用'); nonempty(document.note, '用户决定内容')
    assert(['accept', 'return', 'cancel'].includes(document.decision), '无效决定')
    requireStatus(task, document.decision === 'cancel' ? ['received', 'planned', 'executing', 'verifying', 'verified', 'reviewed', 'awaiting_owner'] : ['awaiting_owner'])
    const runtime = inspectLock(root, runtimeDir)
    assert(!runtime.error && !(runtime.alive && runtime.pid !== process.pid), '写锁尚未结束或不可判定；先核实执行状态，不能终止其他进程')
    const previousStatus = task.status
    const decidedFingerprint = task.delivery?.fingerprint ?? task.verification?.fingerprint ?? null
    if (document.decision === 'accept') {
      fresh(task); assert(proofValid(task.review.evidence) && task.delivery.fingerprint === task.verification.fingerprint && hash(read(task.delivery.file)) === task.delivery.sha256, '交付材料已变化，不能沿用原验收')
      task.status = 'accepted'
    } else if (document.decision === 'return') {
      assert(task.repairRounds < profile.maxRepairRounds, '达到修复上限，请拆分新任务')
      task.repairRounds++; task.status = 'executing'; delete task.verification; delete task.review; delete task.delivery
    } else task.status = 'cancelled'
    const record = { ...document, recordedAt: now(), previousStatus, fingerprint: decidedFingerprint }
    task.decisions ??= []; task.decisions.push(record)
    write(`${base(id)}/owner-decision.json`, json(record)); event(task, 'owner-decision', document.note); return save(task)
  }

  function listIds() {
    const directory = safePath(root, taskRoot, true)
    if (!fs.existsSync(directory)) return []
    return fs.readdirSync(directory).sort().filter(id => ID.test(id) && fs.existsSync(safePath(root, `${base(id)}/task.json`, true)))
  }
  function integrity(task, snapshot = filesSnapshot) {
    const reasons = []
    const passed = task.verification?.passed === true
    let inputsCurrent = false
    if (passed) {
      try { inputsCurrent = fingerprint(task, snapshot) === task.verification.fingerprint }
      catch (error) { reasons.push(`检查输入无法读取：${error.message}`) }
      if (!inputsCurrent && !reasons.length) reasons.push('源码、配置、需求、计划或工具已变化')
    } else reasons.push(task.verification ? '本轮检查未通过' : '尚无全部通过的检查')
    const verificationEvidence = passed && proofValid(task.verification.evidence)
    if (passed && !verificationEvidence) reasons.push('检查证据缺失或已变化')
    const resultConsistent = passed && verificationConsistent(task)
    if (passed && !resultConsistent) reasons.push('检查记录与原始结果不一致')
    const revisionsCurrent = (task.revisions ?? []).every(revision => proofValid(revision.evidence))
    if (!revisionsCurrent) reasons.push('需求调整归档缺失或已变化')
    const reviewRequired = ['reviewed', 'awaiting_owner', 'accepted'].includes(task.status)
    const reviewCurrent = Boolean(task.review && proofValid(task.review.evidence))
    if (reviewRequired && !reviewCurrent) reasons.push('复核证据缺失或已变化')
    const deliveryRequired = ['awaiting_owner', 'accepted'].includes(task.status)
    let deliveryCurrent = false
    try { deliveryCurrent = Boolean(task.delivery && task.delivery.fingerprint === task.verification?.fingerprint && hash(read(task.delivery.file)) === task.delivery.sha256) } catch {}
    if (deliveryRequired && !deliveryCurrent) reasons.push('交付文件缺失或已变化')
    const current = passed && inputsCurrent && verificationEvidence && resultConsistent && revisionsCurrent && (!reviewRequired || reviewCurrent) && (!deliveryRequired || deliveryCurrent)
    return { current, verification: { passed, inputsCurrent, evidenceCurrent: verificationEvidence, resultConsistent }, revisionsCurrent, review: { required: reviewRequired, current: reviewCurrent }, delivery: { required: deliveryRequired, current: deliveryCurrent }, reasons }
  }
  function status(id) {
    const snapshot = snapshotReader()
    return (id ? [id] : listIds()).map(taskId => {
      try {
        const task = load(taskId); const state = integrity(task, snapshot)
        return { id: task.id, title: task.title, status: task.status, label: LABELS[task.status], updatedAt: task.updatedAt, repairRounds: task.repairRounds, checks: task.verification?.checks ?? [], lastEvent: task.events.at(-1), evidenceCurrent: state.current, integrity: state, delivery: task.delivery?.file ?? null, acceptedVersion: task.status === 'accepted' ? task.decisions?.at(-1)?.fingerprint ?? null : null }
      } catch (error) {
        if (id) throw error
        return { id: taskId, title: taskId, status: 'invalid', label: '任务记录损坏', evidenceCurrent: false, integrity: { current: false, reasons: [error.message] }, delivery: null }
      }
    })
  }
  function report() {
    const rows = status()
    const pending = next(undefined, rows, true)
    const escape = value => value.replaceAll('|', '\\|').replaceAll('\n', ' ')
    const link = relative => path.posix.relative(path.posix.dirname(statusFile), relative)
    const exists = relative => { try { return fs.existsSync(safePath(root, relative, true)) } catch { return false } }
    const actions = new Map(pending.tasks.map(item => [item.id, item]))
    write(statusFile, `# AI 交付流程状态\n\n工具：ai-delivery ${TOOL_VERSION}；项目：${escape(profile.name ?? path.basename(root))}。更新时间：${new Date().toLocaleString('zh-CN', { timeZone: profile.timezone })}（${profile.timezone}）。重要状态保存时自动刷新。\n\n下一步：${escape(pending.next)}${pending.selected ? `（${pending.selected}）` : ''}。进行中 ${pending.counts.active}；待验收 ${pending.counts.awaitingOwner}；待恢复 ${pending.counts.recovery}；受阻 ${pending.counts.blocked}；已结束 ${pending.counts.closed}。\n\n| 任务 | 阶段 | 当前材料有效性 | 下一步 | 最近事件 | 交付包 |\n| --- | --- | --- | --- | --- | --- |\n${rows.map(r => `| ${exists(`${base(r.id)}/brief.md`) ? `[${escape(r.title)}](${link(`${base(r.id)}/brief.md`)})` : escape(r.title)} | ${r.status === 'accepted' ? '用户已确认（历史交付版本）' : r.label} | ${r.evidenceCurrent ? '证据有效' : escape(r.integrity.reasons.join('；'))} | ${escape(actions.get(r.id)?.next ?? '历史记录保留')} | ${r.lastEvent?.action ?? '无'} | ${r.delivery ? exists(r.delivery) ? `[查看](${link(r.delivery)})` : '交付文件缺失' : '待生成'} |`).join('\n')}\n\n已验收的历史决定保留，后续工作区变化不撤销历史验收。next 是只读待办入口，多个候选由 AI 结合当前需求定位；不会自行运行检查或更改状态。任务由 AI 会话读取状态并推进；没有后台模型执行器。恢复原因和材料路径可用 inspect 查看；复核与设备验收范围请查看各交付包。\n`)
    return rows
  }
  function guidance(task, state, runtime, ignoreOwnLock = false) {
    const attempts = { used: task.runs.length, limit: profile.maxRepairRounds + 1, remaining: Math.max(0, profile.maxRepairRounds + 1 - task.runs.length), repairRounds: task.repairRounds, repairLimit: profile.maxRepairRounds, repairsRemaining: Math.max(0, profile.maxRepairRounds - task.repairRounds) }
    const result = { category: 'active', action: null, next: '', ownerAction: '无需逐步操作', attempts }
    const choose = (category, action, text) => ({ ...result, category, action, next: text })
    if (task.status === 'accepted') return choose('closed', 'closed', state.current ? '当前需求闭环完成' : '历史验收保留；后续变化建立新任务')
    if (task.status === 'cancelled') return choose('closed', 'closed', '已停止；保留记录，后续需求建立新任务')
    if (runtime.error) return choose('blocked', 'inspect_lock', `写锁不可判定：${runtime.error}；核实记录和持有进程，不强制解锁`)
    // Read-only commands never mistake their own process for a running writer; mutations
    // can emit receipts while they hold the current process's lock.
    if (runtime.alive && (task.status === 'verifying' || !ignoreOwnLock || runtime.pid !== process.pid)) return choose(task.status === 'verifying' ? 'running' : 'blocked', 'wait', `等待当前写入或检查结束（PID ${runtime.pid}）`)
    if (task.status === 'verifying') {
      if (!attempts.remaining || !attempts.repairsRemaining) return choose('blocked', 'inspect', '检查中断且尝试或修复上限已用尽；保留结果，明确阻碍后再决定新范围')
      return choose('recovery', 'rework', '检查进程已结束，记录中断原因后 rework 并重新检查')
    }
    for (const name of ['brief.md', 'plan.md']) {
      try { assert(fs.statSync(safePath(root, `${base(task.id)}/${name}`, true)).isFile(), '材料必须是文件') }
      catch { return choose('recovery', 'inspect', `任务材料 ${name} 缺失或不可读取；inspect 后核对可信快照恢复`) }
    }
    if (['verified', 'reviewed', 'awaiting_owner'].includes(task.status) && !state.current) {
      return choose('recovery', 'inspect', '根据失效原因恢复材料；输入变化则 rework，需求变化则 amend，重新检查与复核' + (!attempts.remaining || !attempts.repairsRemaining ? '；尝试或修复上限已用尽，不能继续重试，可核对原快照恢复' : ''))
    }
    if (task.status === 'executing') {
      if (!attempts.remaining) return choose('blocked', 'inspect', '检查尝试上限已用尽；保留失败结果并说明阻碍，不继续重试')
      if (task.verification?.passed === false) {
        if (!attempts.repairsRemaining) return choose('blocked', 'inspect', '修复上限已用尽；保留失败结果并说明阻碍，不继续重试')
        return choose('active', 'rework', '根据失败日志修复，记录 rework 原因后重新检查')
      }
    }
    if (task.status === 'awaiting_owner') return { ...choose('awaiting_owner', 'decision', '等待用户确认或调整'), ownerAction: '确认交付或描述调整' }
    const actions = { received: ['plan', '完善计划'], planned: ['start', '开始实施'], executing: ['verify', '实施后执行检查'], verified: ['review', '逐项复核'], reviewed: ['deliver', '生成交付'] }
    const [action, text] = actions[task.status]
    return choose('active', action, text)
  }
  function receipt(task, state = integrity(task)) {
    return { workflow: 'ai-delivery', version: TOOL_VERSION, project: profile.name ?? path.basename(root), task: task.id, title: task.title, stage: task.status, label: LABELS[task.status], event: task.events.at(-1), checks: task.verification?.checks.map(check => ({ id: check.id, passed: check.passed })) ?? [], evidenceCurrent: state.current, reasons: state.reasons, ...guidance(task, state, inspectLock(root, runtimeDir), true), statusFile }
  }
  function next(id, rows = status(id), ignoreOwnLock = false) {
    const runtime = inspectLock(root, runtimeDir)
    const tasks = rows.filter(row => !['accepted', 'cancelled'].includes(row.status)).map(row => {
      let action
      try { action = guidance(load(row.id), row.integrity, runtime, ignoreOwnLock) }
      catch (error) { action = { category: 'recovery', action: 'inspect', next: `任务记录不可读取：${error.message}；核对可信快照`, ownerAction: '无需逐步操作' } }
      return { id: row.id, title: row.title, stage: row.status, evidenceCurrent: row.evidenceCurrent, reasons: row.integrity.reasons, checks: row.checks ?? [], ...action }
    })
    const counts = { active: 0, awaitingOwner: 0, recovery: 0, blocked: 0, closed: rows.filter(row => ['accepted', 'cancelled'].includes(row.status)).length }
    for (const task of tasks) counts[task.category === 'awaiting_owner' ? 'awaitingOwner' : task.category === 'running' ? 'active' : task.category]++
    // Ongoing work takes precedence over previous deliveries. Multiple candidates are
    // returned without guessing which user request they belong to.
    const ongoing = tasks.filter(task => !['awaiting_owner', 'invalid'].includes(task.stage))
    const awaiting = tasks.filter(task => task.category === 'awaiting_owner')
    const candidates = ongoing.length ? ongoing : awaiting.length ? awaiting : tasks
    const selected = id ?? (candidates.length === 1 ? candidates[0].id : null)
    const item = tasks.find(task => task.id === selected)
    let action = item?.action ?? (id ? 'closed' : candidates.length ? 'select_task' : 'new')
    let text = item?.next ?? (id ? '已结束；保留历史，后续需求建立新任务' : candidates.length ? '结合当前需求选择已有任务 ID，再执行 next ID；不自动切换任务' : '没有待办；用户描述新需求后由 AI 收件')
    if (!id && (runtime.error || runtime.alive && (!ignoreOwnLock || runtime.pid !== process.pid))) { action = runtime.error ? 'inspect_lock' : 'wait'; text = runtime.error ? `写锁不可判定：${runtime.error}；先核实持有进程` : `等待当前写入或检查结束（PID ${runtime.pid}）` }
    return { workflow: 'ai-delivery', version: TOOL_VERSION, project: profile.name ?? path.basename(root), readOnly: true, runtime, counts, selected, candidates: candidates.map(task => task.id), action, next: text, ownerAction: item?.ownerAction ?? '无需逐步操作', tasks, statusFile }
  }
  function inspect(id) {
    const task = load(id)
    const snapshot = snapshotReader()
    const state = integrity(task, snapshot)
    let changes
    try { const watched = changedFiles(task, snapshot); changes = { watched, outsideScope: watched.filter(file => !task.scope.some(prefix => matches(file, prefix))) } }
    catch (error) { changes = { error: error.message } }
    return { ...receipt(task, state), integrity: state, changes, materials: materials(task), runtime: inspectLock(root, runtimeDir) }
  }
  function materials(task) {
    return { task: `${base(task.id)}/task.json`, brief: `${base(task.id)}/brief.md`, plan: `${base(task.id)}/plan.md`, checks: task.runs.at(-1)?.report ?? null, review: task.review?.file ?? null, delivery: task.delivery?.file ?? null, revisions: task.revisions?.map(item => item.directory) ?? [] }
  }
  function context(id) {
    const task = load(id)
    const snapshot = snapshotReader()
    const state = receipt(task, integrity(task, snapshot))
    const paths = materials(task)
    let plan
    try { const text = read(paths.plan); plan = { file: paths.plan, text: text.slice(0, 2400), totalCharacters: text.length, truncated: text.length > 2400 } }
    catch (error) { plan = { file: paths.plan, error: error.message } }
    return { ...state, readOnly: true, request: task.request, scope: task.scope, criteria: task.criteria, manualChecks: task.manualChecks, requiredChecks: task.checks, checkSelection: task.checkSelection ?? { source: 'historical-explicit', checks: task.checks }, rules: profile.ruleFiles ?? [], plan, materials: paths, verification: task.verification ? { id: task.verification.id, checks: task.verification.checks } : null, note: '完整需求、范围和验收条件未截断；长计划仅摘录，必要时读取完整路径。没有历史基线或完整日志；复杂异常用 inspect。' }
  }
  return { create, begin, amend, plan, start, verify, review, deliver, finish, rework, decision, status, report, receipt, next, inspect, context, load, fingerprint, changedFiles, runtimeDir }
}
