import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createWorkflow, safePath, withLock, inspectLock, TOOL_VERSION } from '../scripts/workflow.mjs'

const bundleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureBase = path.join(bundleRoot, 'runtime/test-fixtures')

function fixture(t, execute) {
  const root = path.join(fixtureBase, crypto.randomUUID())
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(path.join(root, 'src/state.txt'), 'original')
  fs.writeFileSync(path.join(root, 'src/other.txt'), 'other')
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const profile = { schemaVersion: 2, commands: { types: [{ executable: 'node', args: ['--version'] }] }, timezone: 'Asia/Shanghai', watch: ['src'], exclude: [], checks: ['types'], maxRepairRounds: 3, checkTimeoutMs: 1000 }
  const workflow = createWorkflow(root, profile, execute ?? (() => ({ status: 0, stdout: 'fixture check passed', stderr: '' })))
  const spec = { id: 'fixture-task', title: '测试任务', request: '验证任务状态和验收证据的约束', scope: ['src/state.txt'], checks: ['types'], criteria: [{ id: 'criteria-one', description: '必须有可追溯的检查记录' }], manualChecks: ['未启动设备'] }
  const write = (relative, value) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); return relative }
  const prepare = () => {
    workflow.create(spec)
    write('docs/tasks/fixture-task/plan.md', '# 实施计划\n\n' + '确认原始需求、文件范围、实现方法、相关检查与失败后的恢复办法。'.repeat(4))
    workflow.plan(spec.id); workflow.start(spec.id)
  }
  const review = () => {
    const task = workflow.load(spec.id)
    const file = write('docs/tasks/fixture-task/review-input.json', { reviewer: '测试复核阶段', summary: '逐项核对夹具证据', findings: [], criteria: [{ id: 'criteria-one', result: 'passed', evidence: [task.runs.at(-1).report] }] })
    return workflow.review(spec.id, file)
  }
  return { root, profile, workflow, spec, write, prepare, review }
}

test('未完成计划或未检查时不能跳过阶段交付', t => {
  const f = fixture(t); f.workflow.create(f.spec)
  assert.throws(() => f.workflow.plan(f.spec.id), /具体计划/)
  assert.throws(() => f.workflow.start(f.spec.id), /不允许/)
  assert.throws(() => f.workflow.deliver(f.spec.id), /不允许/)
})

test('重建执行器后从文件状态继续，并生成待用户验收交付包', t => {
  const f = fixture(t); f.prepare()
  const resumed = createWorkflow(f.root, f.profile, () => ({ status: 0, stdout: 'resumed', stderr: '' }))
  assert.equal(resumed.load(f.spec.id).status, 'executing')
  resumed.verify(f.spec.id); f.review()
  const task = resumed.deliver(f.spec.id)
  assert.equal(task.status, 'awaiting_owner')
  assert.match(fs.readFileSync(path.join(f.root, task.delivery.file), 'utf8'), /本次交付不代表发布/)
  assert.equal(resumed.status(f.spec.id)[0].evidenceCurrent, true)
})

test('失败检查被保存，不能宣称通过', t => {
  const f = fixture(t, () => ({ status: 1, stdout: '', stderr: 'real failure in fixture' })); f.prepare()
  const task = f.workflow.verify(f.spec.id)
  assert.equal(task.status, 'executing'); assert.equal(task.verification.passed, false)
  assert.match(fs.readFileSync(path.join(f.root, task.verification.checks[0].log), 'utf8'), /real failure/)
  assert.throws(() => f.review(), /不允许/)
})

test('超时失败被保存', t => {
  const f = fixture(t, () => ({ status: null, stdout: '', error: new Error('ETIMEDOUT') })); f.prepare()
  assert.equal(f.workflow.verify(f.spec.id).verification.passed, false)
})

test('未知命令、越界和符号链接不能进入任务', t => {
  const f = fixture(t)
  assert.throws(() => f.workflow.create({ ...f.spec, checks: ['dev:h5'] }), /白名单/)
  assert.throws(() => f.workflow.create({ ...f.spec, id: '../escape' }), /ID/)
  assert.throws(() => f.workflow.create({ ...f.spec, scope: ['.git/config'] }), /禁止/)
  assert.throws(() => safePath(f.root, '../outside'), /越界/)
  assert.throws(() => safePath(f.root, 'README.md', true), /docs/)
  fs.symlinkSync(path.join(f.root, 'src'), path.join(f.root, 'linked'))
  assert.throws(() => safePath(f.root, 'linked/state.txt'), /符号链接/)
  fs.symlinkSync(path.join(f.root, 'missing-target'), path.join(f.root, 'broken-link'))
  assert.throws(() => safePath(f.root, 'broken-link/new.txt'), /符号链接/)
})

test('出现声明范围外的修改时停止验收', t => {
  const f = fixture(t); f.prepare(); f.write('src/other.txt', 'unexpected')
  assert.throws(() => f.workflow.verify(f.spec.id), /范围外/)
})

test('检查期间源文件变化导致结果失效', t => {
  let f
  f = fixture(t, () => { f.write('src/state.txt', 'changed during check'); return { status: 0, stdout: '' } })
  f.prepare(); const task = f.workflow.verify(f.spec.id)
  assert.equal(task.verification.passed, false); assert.match(task.verification.error, /输入文件/)
})

test('验收后代码、计划或验收条件变化不能沿用旧结果', t => {
  for (const input of ['source', 'plan', 'criteria']) {
    const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id)
    if (input === 'source') f.write('src/state.txt', 'changed source')
    if (input === 'plan') f.write('docs/tasks/fixture-task/plan.md', 'changed plan')
    if (input === 'criteria') {
      const task = f.workflow.load(f.spec.id); task.criteria[0].description = 'changed acceptance'
      f.write('docs/tasks/fixture-task/task.json', task)
    }
    assert.throws(() => f.review(), /已变化/)
    assert.equal(f.workflow.status(f.spec.id)[0].evidenceCurrent, false)
  }
})

test('检查日志被修改后不能交付', t => {
  const f = fixture(t); f.prepare(); const task = f.workflow.verify(f.spec.id); f.review()
  f.write(task.verification.checks[0].log, 'modified log')
  assert.throws(() => f.workflow.deliver(f.spec.id), /证据已变化/)
})

test('复核必须覆盖全部验收条件并使用存在的证据', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id)
  const file = f.write('docs/tasks/fixture-task/bad-review.json', { reviewer: 'review', summary: 'summary', findings: [], criteria: [] })
  assert.throws(() => f.workflow.review(f.spec.id, file), /全部验收条件/)
  f.write(file, { reviewer: 'review', summary: 'summary', findings: [], criteria: [{ id: 'criteria-one', result: 'passed', evidence: ['docs/missing.json'] }] })
  assert.throws(() => f.workflow.review(f.spec.id, file), /ENOENT/)
})

test('未解决问题阻止交付，返工必须重新检查', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id)
  const file = f.write('docs/tasks/fixture-task/bad-review.json', { reviewer: 'review', summary: 'summary', findings: [{ description: 'unresolved' }], criteria: [] })
  assert.throws(() => f.workflow.review(f.spec.id, file), /未解决/)
  f.workflow.rework(f.spec.id, '修复发现的问题')
  assert.throws(() => f.workflow.deliver(f.spec.id), /不允许/)
  assert.equal(f.workflow.load(f.spec.id).repairRounds, 1)
})

test('连续失败无法无限重试', t => {
  const f = fixture(t, () => ({ status: 1, stdout: '' })); f.prepare()
  for (let i = 0; i < 4; i++) f.workflow.verify(f.spec.id)
  assert.throws(() => f.workflow.verify(f.spec.id), /尝试上限/)
})

test('复核证据变化不能交付；交付文件变化不能确认', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); const task = f.review()
  f.write(task.review.file, '{}')
  assert.throws(() => f.workflow.deliver(f.spec.id), /复核材料/)
  f.workflow.rework(f.spec.id, '重新复核'); f.workflow.verify(f.spec.id); f.review()
  const delivery = f.workflow.deliver(f.spec.id)
  f.write(delivery.delivery.file, 'changed')
  const decision = f.write('docs/tasks/fixture-task/decision-input.json', { source: 'explicit-user-message', reference: '测试消息', note: '测试确认', decision: 'accept' })
  assert.throws(() => f.workflow.decision(f.spec.id, decision), /交付材料/)
})

test('明确确认只改变交付状态，不执行发布', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review(); f.workflow.deliver(f.spec.id)
  const file = f.write('docs/tasks/fixture-task/decision-input.json', { source: 'explicit-user-message', reference: '测试中的用户消息', note: '用户确认本次交付', decision: 'accept' })
  assert.equal(f.workflow.decision(f.spec.id, file).status, 'accepted')
})

test('退回与再次接受保留每次用户决定和关联的交付版本', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review(); const first = f.workflow.deliver(f.spec.id)
  const file = f.write('docs/tasks/fixture-task/decision-input.json', { source: 'explicit-user-message', reference: '测试退回消息', note: '用户要求调整', decision: 'return' })
  f.workflow.decision(f.spec.id, file)
  f.write('src/state.txt', 'reworked source')
  f.workflow.verify(f.spec.id); f.review(); const second = f.workflow.deliver(f.spec.id)
  f.write(file, { source: 'explicit-user-message', reference: '测试确认消息', note: '用户确认新版本', decision: 'accept' })
  const task = f.workflow.decision(f.spec.id, file)
  assert.equal(task.decisions.length, 2)
  assert.equal(task.decisions[0].fingerprint, first.delivery.fingerprint)
  assert.equal(task.decisions[1].fingerprint, second.delivery.fingerprint)
  assert.notEqual(task.decisions[0].fingerprint, task.decisions[1].fingerprint)
})

test('写入锁拒绝并发，异常后释放', t => {
  const f = fixture(t)
  withLock(f.root, () => assert.throws(() => withLock(f.root, () => {}), /已有写入任务/))
  assert.throws(() => withLock(f.root, () => { throw new Error('fixture failure') }), /fixture failure/)
  assert.equal(fs.existsSync(path.join(f.root, 'docs/workflow/runtime/writer.lock')), false)
})

test('规则目录可作为工作材料与复核证据，项目记录仍写入 docs', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id)
  f.write('.ai-agent/CHARTER.md', 'fixture rules')
  assert.equal(safePath(f.root, '.ai-agent/CHARTER.md', true), path.join(f.root, '.ai-agent/CHARTER.md'))
  const review = f.write('docs/tasks/fixture-task/review-input.json', { reviewer: '复核阶段', summary: '确认目录边界', findings: [], criteria: [{ id: 'criteria-one', result: 'passed', evidence: ['.ai-agent/CHARTER.md'] }] })
  f.workflow.review(f.spec.id, review); f.workflow.deliver(f.spec.id)
  f.workflow.report()
  assert.equal(fs.existsSync(path.join(f.root, 'docs/workflow/STATUS.md')), true)
  assert.equal(fs.existsSync(path.join(f.root, '.ai-agent/STATUS.md')), false)
  assert.match(fs.readFileSync(path.join(f.root, 'docs/workflow/STATUS.md'), 'utf8'), /重要状态保存时自动刷新/)
})

test('旧布局任务保持可读取，旧输入变化后不会显示为当前验收', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review(); f.workflow.deliver(f.spec.id)
  const resumed = createWorkflow(f.root, { ...f.profile, watch: ['src', '.ai-agent/project.json'] }, () => ({ status: 0, stdout: '' }))
  assert.equal(resumed.load(f.spec.id).status, 'awaiting_owner')
  assert.equal(resumed.status(f.spec.id)[0].evidenceCurrent, false)
})

test('任意检查 ID 和参数数组适配真实 Node，报告绑定交付证据', t => {
  const f = fixture(t)
  const literal = '空 格; $(not-a-command) `literal`'
  f.write('docs/check.mjs', "import fs from 'node:fs'; if (process.argv[3] !== " + JSON.stringify(literal) + ") process.exit(2); fs.writeFileSync(process.argv[2], JSON.stringify({checked:true}));")
  const profile = { ...f.profile, checks: ['custom-unit'], commands: { 'custom-unit': [{ executable: 'node', args: ['docs/check.mjs', '{evidenceDir}/report.json', literal], outputs: ['{evidenceDir}/report.json'] }] } }
  const workflow = createWorkflow(f.root, profile)
  workflow.create({ ...f.spec, checks: ['custom-unit'] })
  f.write('docs/tasks/fixture-task/plan.md', '# 计划\n' + '检查参数按字面值传递，报告在当前证据目录生成并绑定到检查输入，复核后交付。'.repeat(4))
  workflow.plan(f.spec.id); workflow.start(f.spec.id)
  const task = workflow.verify(f.spec.id)
  assert.equal(task.verification.passed, true)
  assert.ok(task.verification.evidence.some(item => item.path.endsWith('/report.json')))
  f.write(task.verification.evidence.find(item => item.path.endsWith('/report.json')).path, 'tampered')
  assert.equal(workflow.status(f.spec.id)[0].evidenceCurrent, false)
})

test('未生成注册报告或将报告写到本轮之外均失败', t => {
  for (const output of ['{evidenceDir}/missing.json', 'docs/escape.json']) {
    const f = fixture(t)
    const w = createWorkflow(f.root, { ...f.profile, commands: { types: [{ executable: 'node', args: ['--version'], outputs: [output] }] } })
    w.create(f.spec); f.write('docs/tasks/fixture-task/plan.md', '计划与相关检查和恢复步骤。'.repeat(10)); w.plan(f.spec.id); w.start(f.spec.id)
    assert.equal(w.verify(f.spec.id).verification.passed, false)
  }
})

test('真实 Python 适配从收件走到用户验收，后续变化只影响当前证据', t => {
  assert.equal(spawnSync('python3', ['--version']).status, 0, '跨栈回归需要 Python 3')
  const f = fixture(t)
  f.write('src/service.py', 'def total(values):\n    return sum(values)\n')
  f.write('docs/check.py', 'import runpy\nservice = runpy.run_path("src/service.py")\nassert service["total"]([1, 2, 3]) == 6\nprint("Python service passed")\n')
  const profile = { ...f.profile, checks: ['python-unit'], commands: { 'python-unit': [{ executable: 'python3', args: ['docs/check.py'] }] } }
  const w = createWorkflow(f.root, profile)
  w.create({ ...f.spec, checks: ['python-unit'] }); f.write('docs/tasks/fixture-task/plan.md', '阅读 Python 源码，以真实脚本核对需求，然后复核证据并等待用户明确决定，失败保留记录。'.repeat(4))
  w.plan(f.spec.id); w.start(f.spec.id)
  assert.equal(w.verify(f.spec.id).verification.passed, true)
  const report = w.load(f.spec.id).runs.at(-1).report
  w.review(f.spec.id, f.write('docs/tasks/fixture-task/review-input.json', { reviewer: '真实 Python 复核', summary: '加总行为已检查', findings: [], criteria: [{ id: 'criteria-one', result: 'passed', evidence: [report] }] }))
  w.deliver(f.spec.id)
  const task = w.decision(f.spec.id, f.write('docs/tasks/fixture-task/owner-input.json', { source: 'explicit-user-message', reference: '夹具用户确认', note: '验收通过', decision: 'accept' }))
  const original = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'))
  f.write('src/service.py', 'def total(values):\n    return 0\n')
  w.report()
  assert.equal(w.load(f.spec.id).status, 'accepted')
  assert.equal(w.status(f.spec.id)[0].evidenceCurrent, false)
  assert.equal(w.status(f.spec.id)[0].acceptedVersion, task.delivery.fingerprint)
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json')), original)
  assert.match(fs.readFileSync(path.join(f.root, 'docs/workflow/STATUS.md'), 'utf8'), /历史交付版本/)
})

test('适配器拒绝未注册检查、shell、Git 和生成状态循环', t => {
  const f = fixture(t)
  assert.throws(() => createWorkflow(f.root, { ...f.profile, commands: {} }), /未注册/)
  for (const executable of ['git', '/bin/sh', 'bash', 'powershell']) {
    assert.throws(() => createWorkflow(f.root, { ...f.profile, commands: { types: [{ executable, args: [] }] } }), /禁止/)
  }
  assert.throws(() => createWorkflow(f.root, { ...f.profile, watch: ['docs'] }), /生成状态/)
  assert.throws(() => createWorkflow(f.root, { ...f.profile, taskRoot: 'docs/tasks', runtimeDir: 'docs/tasks' }), /嵌套/)
})

test('回执来自真实状态，每次状态变更自动刷新状态页', t => {
  const f = fixture(t); f.prepare()
  const receipt = f.workflow.receipt(f.workflow.load(f.spec.id))
  assert.equal(receipt.stage, 'executing'); assert.equal(receipt.version, TOOL_VERSION)
  assert.equal(receipt.event.action, 'started'); assert.equal(receipt.evidenceCurrent, false)
  assert.match(fs.readFileSync(path.join(f.root, 'docs/workflow/STATUS.md'), 'utf8'), /执行中/)
  f.workflow.verify(f.spec.id)
  const checked = f.workflow.receipt(f.workflow.load(f.spec.id))
  assert.equal(checked.stage, 'verified'); assert.equal(checked.checks[0].passed, true); assert.equal(checked.evidenceCurrent, true)
  assert.match(fs.readFileSync(path.join(f.root, 'docs/workflow/STATUS.md'), 'utf8'), /检查通过/)
})

test('真实超时退出会写失败证据并释放写锁', t => {
  const f = fixture(t)
  const w = createWorkflow(f.root, { ...f.profile, checkTimeoutMs: 80, commands: { types: [{ executable: 'node', args: ['-e', 'setTimeout(() => {}, 5000)'] }] } })
  w.create(f.spec); f.write('docs/tasks/fixture-task/plan.md', '测试真实进程超时后保留失败证据和状态，之后按记录进行有限返工。'.repeat(4)); w.plan(f.spec.id); w.start(f.spec.id)
  const task = withLock(f.root, () => w.verify(f.spec.id))
  assert.equal(task.verification.passed, false)
  assert.match(fs.readFileSync(path.join(f.root, task.verification.checks[0].log), 'utf8'), /ETIMEDOUT/)
  assert.equal(fs.existsSync(path.join(f.root, 'docs/workflow/runtime/writer.lock')), false)
})

test('状态与回执同时识别复核和交付被修改，不能请求用户确认失效版本', t => {
  for (const material of ['review', 'delivery']) {
    const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review()
    const task = f.workflow.deliver(f.spec.id)
    f.write(task[material].file, 'changed material')
    const state = f.workflow.status(f.spec.id)[0]
    assert.equal(state.integrity.verification.evidenceCurrent, true)
    assert.equal(state.evidenceCurrent, false)
    assert.ok(state.integrity.reasons.some(reason => reason.includes(material === 'review' ? '复核' : '交付')))
    const receipt = f.workflow.receipt(f.workflow.load(f.spec.id))
    assert.equal(receipt.ownerAction, '无需逐步操作'); assert.match(receipt.next, /恢复材料/)
    const decision = f.write('docs/decision.json', { source: 'explicit-user-message', reference: '夹具用户消息', note: '确认', decision: 'accept' })
    assert.throws(() => f.workflow.decision(f.spec.id, decision), /交付材料/)
  }
})

test('交付缺失与旧任务计划缺失提供原因，状态页不生成无效交付链接', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review()
  const task = f.workflow.deliver(f.spec.id)
  fs.unlinkSync(path.join(f.root, task.delivery.file))
  assert.match(f.workflow.inspect(f.spec.id).reasons.join(' '), /交付文件缺失/)
  f.workflow.report()
  assert.match(fs.readFileSync(path.join(f.root, 'docs/workflow/STATUS.md'), 'utf8'), /交付文件缺失/)
  assert.doesNotMatch(fs.readFileSync(path.join(f.root, 'docs/workflow/STATUS.md'), 'utf8'), /\[查看\]/)
  fs.unlinkSync(path.join(f.root, 'docs/tasks/fixture-task/plan.md'))
  assert.equal(f.workflow.status()[0].evidenceCurrent, false)
  assert.match(f.workflow.status()[0].integrity.reasons.join(' '), /输入无法读取/)
  assert.doesNotThrow(() => f.workflow.report())
})

test('损坏任务明确标记且不阻止其他任务的正常状态与保存', t => {
  const f = fixture(t); f.prepare()
  f.write('docs/tasks/broken-task/task.json', '{bad json')
  assert.equal(f.workflow.status().find(task => task.id === 'broken-task').status, 'invalid')
  assert.equal(f.workflow.verify(f.spec.id).status, 'verified')
  assert.match(fs.readFileSync(path.join(f.root, 'docs/workflow/STATUS.md'), 'utf8'), /任务记录损坏/)
  assert.throws(() => f.workflow.inspect('broken-task'), /JSON/)
})

test('inspect 只读，显示真实材料、范围外变化和写锁，不改变任务或释放他人锁', t => {
  const f = fixture(t); f.prepare(); f.write('src/other.txt', 'changed')
  const before = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'))
  withLock(f.root, () => {
    const state = f.workflow.inspect(f.spec.id)
    assert.equal(state.runtime.alive, true); assert.equal(state.runtime.pid, process.pid)
    assert.deepEqual(state.changes.outsideScope, ['src/other.txt'])
    assert.equal(state.attempts.used, 0)
    assert.equal(state.materials.plan, 'docs/tasks/fixture-task/plan.md')
    assert.equal(fs.existsSync(path.join(f.root, 'docs/workflow/runtime/writer.lock')), true)
  })
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json')), before)
})

test('需求调整归档已有交付与定义，重新计划且保留检查次数', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review()
  const previous = f.workflow.deliver(f.spec.id)
  const oldTask = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'), 'utf8')
  const delivery = fs.readFileSync(path.join(f.root, previous.delivery.file), 'utf8')
  f.write('src/other.txt', 'within expanded scope')
  const task = f.workflow.amend(f.spec.id, { ...f.spec, request: '用户追加另一处状态行为', scope: ['src'] }, '用户补充需求，需要同时调整第二处状态')
  assert.equal(task.status, 'received'); assert.equal(task.repairRounds, 1); assert.equal(task.runs.length, 1)
  assert.equal(task.verification, undefined); assert.equal(task.delivery, undefined)
  assert.equal(fs.readFileSync(path.join(f.root, task.revisions[0].directory, 'task.json'), 'utf8'), oldTask)
  assert.equal(fs.readFileSync(path.join(f.root, task.revisions[0].directory, 'delivery.md'), 'utf8'), delivery)
  assert.throws(() => f.workflow.plan(f.spec.id), /具体计划/)
  f.write('docs/tasks/fixture-task/plan.md', '依据补充需求更新第二处状态，检查两处行为，保留之前的运行证据和交付归档后再次复核。'.repeat(4))
  f.workflow.plan(f.spec.id); f.workflow.start(f.spec.id)
  assert.equal(f.workflow.verify(f.spec.id).verification.passed, true); f.review()
  assert.equal(f.workflow.deliver(f.spec.id).runs.length, 2)
})

test('无效调整、减少检查与任务 ID 变化不会留下归档或修改任务', t => {
  const f = fixture(t)
  f.profile.checks.push('second'); f.profile.commands.second = [{ executable: 'node', args: ['--version'] }]
  f.spec.checks.push('second'); f.prepare()
  const before = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'))
  assert.throws(() => f.workflow.amend(f.spec.id, { ...f.spec, checks: ['types'] }, '减少检查'), /不能减少/)
  assert.throws(() => f.workflow.amend(f.spec.id, { ...f.spec, id: 'another-task' }, '错目标'), /必须一致/)
  assert.throws(() => f.workflow.amend(f.spec.id, { ...f.spec, scope: ['../escape'] }, '越界'), /越界/)
  assert.throws(() => f.workflow.amend(f.spec.id, f.spec, ''), /调整原因/)
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json')), before)
  assert.equal(fs.existsSync(path.join(f.root, 'docs/tasks/fixture-task/revisions')), false)
})

test('需求归档被修改时不能复核或沿用通过状态', t => {
  const f = fixture(t); f.prepare()
  const amended = f.workflow.amend(f.spec.id, f.spec, '用户澄清需求')
  f.write('docs/tasks/fixture-task/plan.md', '根据需求澄清完善实现与检查，验证后按真实证据逐项复核，原需求归档必须保持完整。'.repeat(4))
  f.workflow.plan(f.spec.id); f.workflow.start(f.spec.id); f.workflow.verify(f.spec.id)
  f.write(amended.revisions[0].directory + '/brief.md', '改写历史')
  assert.equal(f.workflow.status(f.spec.id)[0].evidenceCurrent, false)
  assert.throws(() => f.review(), /调整历史已变化/)
})

test('已接受或取消的任务不能改写，后续需求必须另建任务', t => {
  for (const decision of ['accept', 'cancel']) {
    const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review(); f.workflow.deliver(f.spec.id)
    f.workflow.decision(f.spec.id, f.write('docs/owner.json', { source: 'explicit-user-message', reference: '夹具用户', note: decision, decision }))
    const before = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'))
    assert.throws(() => f.workflow.amend(f.spec.id, f.spec, '后续需求'), /不允许/)
    assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json')), before)
  }
})

test('需求调整不重置失败尝试，不能绕过修复上限', t => {
  const f = fixture(t, () => ({ status: 1, stdout: 'failed' }))
  f.profile.maxRepairRounds = 1; f.prepare(); f.workflow.verify(f.spec.id)
  f.workflow.amend(f.spec.id, f.spec, '明确补充范围')
  f.write('docs/tasks/fixture-task/plan.md', '更新后的需求需要明确实现、检查和恢复，保留原有失败结果及计数，不允许无限重试。'.repeat(4))
  f.workflow.plan(f.spec.id); f.workflow.start(f.spec.id); f.workflow.verify(f.spec.id)
  assert.equal(f.workflow.inspect(f.spec.id).attempts.used, 2)
  assert.throws(() => f.workflow.amend(f.spec.id, f.spec, '再尝试'), /修复轮数上限/)
  assert.throws(() => f.workflow.verify(f.spec.id), /尝试上限/)
})

test('不可判定的写锁只读报告并拒绝覆盖，陈旧锁归档后恢复写入', t => {
  const f = fixture(t)
  f.write('docs/workflow/runtime/writer.lock', '{"pid":0}')
  assert.match(inspectLock(f.root).error, /PID 无效/)
  assert.throws(() => withLock(f.root, () => {}), /锁记录不可判定/)
  assert.equal(fs.readFileSync(path.join(f.root, 'docs/workflow/runtime/writer.lock'), 'utf8'), '{"pid":0}')
  f.write('docs/workflow/runtime/writer.lock', { pid: 2147483647, startedAt: 'old fixture' })
  assert.equal(inspectLock(f.root).alive, false)
  withLock(f.root, () => assert.equal(inspectLock(f.root).pid, process.pid))
  assert.equal(fs.readdirSync(path.join(f.root, 'docs/workflow/runtime')).filter(name => name.includes('.interrupted-')).length, 1)
})

test('next 无待办时提示新需求且不创建任务或状态文件', t => {
  const f = fixture(t)
  const pending = f.workflow.next()
  assert.equal(pending.action, 'new'); assert.equal(pending.selected, null)
  assert.deepEqual(pending.tasks, []); assert.equal(pending.readOnly, true)
  assert.equal(fs.existsSync(path.join(f.root, 'docs')), false)
})

test('next 优先唯一进行中需求，多项进行中要求定位而非猜测最新任务', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review(); f.workflow.deliver(f.spec.id)
  const create = id => f.workflow.create({ ...f.spec, id })
  create('second-task')
  assert.equal(f.workflow.next().selected, 'second-task')
  assert.equal(f.workflow.next().action, 'plan')
  assert.equal(f.workflow.next().counts.awaitingOwner, 1)
  create('third-task')
  const pending = f.workflow.next()
  assert.equal(pending.action, 'select_task'); assert.equal(pending.selected, null)
  assert.deepEqual(pending.candidates, ['second-task', 'third-task'])
  assert.equal(f.workflow.next('third-task').selected, 'third-task')
  assert.equal(f.workflow.next('third-task').action, 'plan')
})

test('next 与真实检查复核阶段一致，仅有效交付要求用户验收', t => {
  const f = fixture(t); f.prepare()
  assert.equal(f.workflow.next().action, 'verify')
  f.workflow.verify(f.spec.id)
  assert.equal(f.workflow.next().action, 'review')
  f.review(); assert.equal(f.workflow.next().action, 'deliver')
  const task = f.workflow.deliver(f.spec.id)
  assert.equal(f.workflow.next().action, 'decision')
  assert.equal(f.workflow.next().ownerAction, '确认交付或描述调整')
  f.write(task.delivery.file, 'changed')
  const stale = f.workflow.next()
  assert.equal(stale.action, 'inspect'); assert.equal(stale.counts.recovery, 1)
  assert.equal(stale.ownerAction, '无需逐步操作')
  assert.match(stale.tasks[0].reasons.join(' '), /交付文件/)
  f.workflow.report()
  assert.match(fs.readFileSync(path.join(f.root, 'docs/workflow/STATUS.md'), 'utf8'), /下一步.*恢复材料/s)
})

test('有效待验收交付优先历史失效交付，多份有效交付不擅自选目标', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review()
  const first = f.workflow.deliver(f.spec.id)
  f.write(first.delivery.file, 'stale delivery')
  const complete = id => {
    f.workflow.create({ ...f.spec, id })
    f.write(`docs/tasks/${id}/plan.md`, '按需求明确实现与检查，然后逐项复核证据并等待用户确认，出错保留记录。'.repeat(4))
    f.workflow.plan(id); f.workflow.start(id); const checked = f.workflow.verify(id)
    f.workflow.review(id, f.write(`docs/tasks/${id}/review-input.json`, { reviewer: '夹具复核', summary: '确认检查证据', findings: [], criteria: [{ id: 'criteria-one', result: 'passed', evidence: [checked.runs.at(-1).report] }] }))
    f.workflow.deliver(id)
  }
  complete('second-task')
  assert.equal(f.workflow.next().selected, 'second-task')
  complete('third-task')
  assert.equal(f.workflow.next().selected, null)
  assert.equal(f.workflow.next().action, 'select_task')
  assert.deepEqual(f.workflow.next().candidates, ['second-task', 'third-task'])
})

test('已接受和取消的历史排除待办，next 不撤销历史决定', t => {
  for (const decision of ['accept', 'cancel']) {
    const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review(); f.workflow.deliver(f.spec.id)
    f.workflow.decision(f.spec.id, f.write('docs/owner.json', { source: 'explicit-user-message', reference: '夹具决定', note: decision, decision }))
    const before = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'))
    f.write('src/state.txt', 'later changes')
    assert.equal(f.workflow.next().counts.closed, 1)
    assert.deepEqual(f.workflow.next().tasks, [])
    assert.equal(f.workflow.next().action, 'new')
    assert.equal(f.workflow.next(f.spec.id).action, 'closed')
    assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json')), before)
  }
})

test('失败日志和上限决定接续动作，最后一次成功仍能复核交付', t => {
  const f = fixture(t, () => ({ status: 1, stdout: 'failed check' })); f.prepare(); f.workflow.verify(f.spec.id)
  assert.equal(f.workflow.next().action, 'rework')
  assert.equal(f.workflow.next().tasks[0].checks[0].passed, false)
  assert.equal(f.workflow.next().tasks[0].attempts.remaining, 3)
  for (let i = 0; i < 3; i++) f.workflow.verify(f.spec.id)
  assert.equal(f.workflow.next().counts.blocked, 1)
  assert.equal(f.workflow.next().action, 'inspect')
  assert.match(f.workflow.receipt(f.workflow.load(f.spec.id)).next, /上限已用尽/)
  const g = fixture(t); g.profile.maxRepairRounds = 0; g.prepare(); g.workflow.verify(g.spec.id)
  assert.equal(g.workflow.next().tasks[0].attempts.remaining, 0)
  assert.equal(g.workflow.next().action, 'review')
  g.review(); assert.equal(g.workflow.next().action, 'deliver')
})

test('next 区分进行中的检查、中断检查和不可判定的锁且保持只读', t => {
  const f = fixture(t); f.prepare()
  const task = f.workflow.load(f.spec.id); task.status = 'verifying'
  f.write('docs/tasks/fixture-task/task.json', task)
  const before = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'))
  assert.equal(f.workflow.next().action, 'rework')
  withLock(f.root, () => {
    assert.equal(f.workflow.next().action, 'wait')
    assert.equal(f.workflow.next(f.spec.id).action, 'wait')
    assert.equal(f.workflow.receipt(f.workflow.load(f.spec.id)).action, 'wait')
    assert.equal(inspectLock(f.root).alive, true)
  })
  f.write('docs/workflow/runtime/writer.lock', '{bad lock')
  assert.equal(f.workflow.next().action, 'inspect_lock')
  assert.equal(f.workflow.next().counts.blocked, 1)
  assert.equal(fs.readFileSync(path.join(f.root, 'docs/workflow/runtime/writer.lock'), 'utf8'), '{bad lock')
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json')), before)
})

test('next 报告损坏记录和缺失材料，同时仍能定位正常任务', t => {
  const f = fixture(t); f.prepare()
  f.write('docs/tasks/broken-task/task.json', '{bad task')
  assert.equal(f.workflow.next().selected, f.spec.id)
  assert.equal(f.workflow.next().counts.recovery, 1)
  fs.unlinkSync(path.join(f.root, 'docs/tasks/fixture-task/plan.md'))
  const pending = f.workflow.next(f.spec.id)
  assert.equal(pending.action, 'inspect')
  assert.match(pending.next, /plan.md 缺失/)
})

test('明确取消在所有未结束阶段可记录，保留检查历史和取消前阶段', t => {
  for (const stage of ['received', 'planned', 'executing', 'verifying', 'verified', 'reviewed', 'awaiting_owner']) {
    const f = fixture(t)
    if (stage === 'received') f.workflow.create(f.spec)
    else if (stage === 'planned') {
      f.workflow.create(f.spec)
      f.write('docs/tasks/fixture-task/plan.md', '按照具体需求规划实现、脚本检查与恢复方式；用户取消时保留收件和计划。'.repeat(4))
      f.workflow.plan(f.spec.id)
    }
    else {
      f.prepare()
      if (stage === 'verifying') {
        const task = f.workflow.load(f.spec.id); task.status = stage
        f.write('docs/tasks/fixture-task/task.json', task)
      }
      if (['verified', 'reviewed', 'awaiting_owner'].includes(stage)) f.workflow.verify(f.spec.id)
      if (['reviewed', 'awaiting_owner'].includes(stage)) f.review()
      if (stage === 'awaiting_owner') f.workflow.deliver(f.spec.id)
    }
    const before = f.workflow.load(f.spec.id)
    const runs = JSON.stringify(before.runs)
    const task = f.workflow.decision(f.spec.id, f.write('docs/owner.json', { source: 'explicit-user-message', reference: '夹具用户取消消息', note: '取消这个需求', decision: 'cancel' }))
    assert.equal(task.status, 'cancelled'); assert.equal(task.decisions[0].previousStatus, stage)
    assert.equal(task.decisions[0].fingerprint, before.delivery?.fingerprint ?? before.verification?.fingerprint ?? null)
    assert.equal(JSON.stringify(task.runs), runs); assert.equal(task.repairRounds, before.repairRounds)
    assert.equal(f.workflow.next().tasks.length, 0)
    assert.throws(() => f.workflow.verify(f.spec.id), /不允许/)
    assert.throws(() => f.workflow.decision(f.spec.id, 'docs/owner.json'), /不允许/)
  }
})

test('提前验收、无用户消息和运行中的他人写锁不能改变任务', t => {
  const f = fixture(t); f.prepare()
  const before = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'))
  for (const decision of ['accept', 'return']) {
    const file = f.write('docs/owner.json', { source: 'explicit-user-message', reference: '夹具用户', note: decision, decision })
    assert.throws(() => f.workflow.decision(f.spec.id, file), /不允许/)
  }
  const file = f.write('docs/owner.json', { source: 'ai-inferred', reference: '没有用户取消', note: '取消', decision: 'cancel' })
  assert.throws(() => f.workflow.decision(f.spec.id, file), /明确消息/)
  f.write(file, { source: 'explicit-user-message', reference: '夹具用户', note: '取消', decision: 'cancel' })
  f.write('docs/workflow/runtime/writer.lock', { pid: process.ppid, startedAt: 'other live process' })
  assert.equal(inspectLock(f.root).alive, true)
  assert.throws(() => f.workflow.decision(f.spec.id, file), /不能终止其他进程/)
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json')), before)
  assert.equal(inspectLock(f.root).pid, process.ppid)
})

test('继承 Node 测试上下文不能跳过项目测试造成假成功', t => {
  const f = fixture(t)
  f.write('docs/failing.test.mjs', "import assert from 'node:assert/strict'; assert.equal(0, 6, 'project behavior failed');")
  const profile = { ...f.profile, commands: { types: [{ executable: 'node', args: ['--test', 'docs/failing.test.mjs'] }] } }
  const original = process.env.NODE_TEST_CONTEXT
  process.env.NODE_TEST_CONTEXT = 'child-v8'
  try {
    const workflow = createWorkflow(f.root, profile)
    workflow.create(f.spec)
    f.write('docs/tasks/fixture-task/plan.md', '真实测试必须执行失败行为断言，不能因继承上一级测试运行器内部环境而跳过；失败应保留日志。'.repeat(4))
    workflow.plan(f.spec.id); workflow.start(f.spec.id)
    const checked = workflow.verify(f.spec.id)
    assert.equal(checked.verification.passed, false)
    const log = fs.readFileSync(path.join(f.root, checked.verification.checks[0].log), 'utf8')
    assert.match(log, /project behavior failed/)
    assert.doesNotMatch(log, /skipping running files/)
    assert.equal(process.env.NODE_TEST_CONTEXT, 'child-v8')
  } finally {
    if (original === undefined) delete process.env.NODE_TEST_CONTEXT
    else process.env.NODE_TEST_CONTEXT = original
  }
})

const completePlan = '先明确需求、修改范围和验收条件，在范围内实施；执行对应脚本检查，失败保留日志并有限返工；依据真实证据逐项复核，交付后等待用户确认，必要时按原文件与记录恢复。'.repeat(2)

test('begin 合并收件计划开工且保留事件，没有计划时不创建任务', t => {
  const f = fixture(t)
  assert.throws(() => f.workflow.begin(f.spec), /具体计划/)
  assert.equal(fs.existsSync(path.join(f.root, 'docs/tasks')), false)
  const task = f.workflow.begin({ ...f.spec, plan: completePlan })
  assert.equal(task.status, 'executing')
  assert.deepEqual(task.events.map(event => event.action), ['created', 'planned', 'started'])
  assert.equal(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/plan.md'), 'utf8'), completePlan)
  const before = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'))
  assert.throws(() => f.workflow.begin({ ...f.spec, plan: completePlan }), /不能覆盖/)
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json')), before)
})

test('finish 仍需检查与逐项复核，只到待验收阶段', t => {
  const f = fixture(t); f.workflow.begin({ ...f.spec, plan: completePlan })
  const input = f.write('docs/review.json', { reviewer: '当前会话', summary: '逐项复核', findings: [], criteria: [] })
  assert.throws(() => f.workflow.finish(f.spec.id, input), /不允许/)
  f.workflow.verify(f.spec.id)
  assert.throws(() => f.workflow.finish(f.spec.id, input), /全部验收条件/)
  f.write(input, { reviewer: '当前会话', summary: '逐项复核', findings: [], criteria: [{ id: 'criteria-one', result: 'passed', evidence: [f.workflow.load(f.spec.id).runs.at(-1).report] }] })
  const task = f.workflow.finish(f.spec.id, input)
  assert.equal(task.status, 'awaiting_owner'); assert.equal(task.decisions, undefined)
  assert.deepEqual(task.events.slice(-2).map(event => event.action), ['reviewed', 'delivered'])
})

test('finish 恢复已复核阶段时核对原结论，不接受修改后的输入', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id); f.review()
  const file = 'docs/tasks/fixture-task/review-input.json'
  const original = fs.readFileSync(path.join(f.root, file), 'utf8')
  const changed = JSON.parse(original); changed.summary = '变更复核结论'; f.write(file, changed)
  assert.throws(() => f.workflow.finish(f.spec.id, file), /与已记录结论不同/)
  assert.equal(f.workflow.load(f.spec.id).status, 'reviewed')
  f.write(file, original)
  assert.equal(f.workflow.finish(f.spec.id, file).status, 'awaiting_owner')
})

test('finish 在检查后的源文件变化或未解决问题下拒绝交付', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id)
  const file = f.write('docs/review.json', { reviewer: '当前会话', summary: '发现问题', findings: ['实际未解决问题'], criteria: [] })
  assert.throws(() => f.workflow.finish(f.spec.id, file), /未解决问题/)
  f.write('src/state.txt', 'changed')
  assert.throws(() => f.workflow.finish(f.spec.id, file), /已变化/)
  assert.equal(f.workflow.load(f.spec.id).delivery, undefined)
})

test('项目政策按父子路径交集合并必要检查，可省略选择并记录原因', t => {
  const f = fixture(t)
  const profile = { ...f.profile, checks: ['types', 'unit', 'puzzles'], commands: Object.fromEntries(['types', 'unit', 'puzzles'].map(id => [id, [{ executable: 'node', args: ['--version'] }]])), checkPolicy: { always: ['types'], rules: [{ paths: ['src/core'], checks: ['unit', 'puzzles'], reason: '核心算法行为' }] } }
  const w = createWorkflow(f.root, profile, () => ({ status: 0, stdout: 'fixture' }))
  const { checks, ...spec } = f.spec
  const task = w.begin({ ...spec, scope: ['src'], plan: completePlan })
  assert.deepEqual(task.checks, ['types', 'unit', 'puzzles'])
  assert.equal(task.checkSelection.source, 'project-policy')
  assert.equal(task.checkSelection.reasons[1].reason, '核心算法行为')
  assert.equal(w.verify(f.spec.id).verification.passed, true)
})

test('显式省略必要检查、空选择或未注册规则在写入前被拒绝', t => {
  const f = fixture(t)
  const profile = { ...f.profile, checks: ['types', 'unit'], commands: { ...f.profile.commands, unit: [{ executable: 'node', args: ['--version'] }] }, checkPolicy: { always: ['types'], rules: [{ paths: ['src'], checks: ['unit'], reason: '业务行为' }] } }
  const w = createWorkflow(f.root, profile)
  assert.throws(() => w.create(f.spec), /缺少项目必要检查：unit/)
  for (const checks of [[], null, 'types']) assert.throws(() => w.create({ ...f.spec, checks }), /白名单/)
  assert.equal(fs.existsSync(path.join(f.root, 'docs/tasks')), false)
  assert.throws(() => createWorkflow(f.root, { ...profile, checkPolicy: { always: ['missing'], rules: [] } }), /已注册/)
  assert.throws(() => createWorkflow(f.root, { ...profile, checkPolicy: { always: [], rules: [{ paths: ['../escape'], checks: ['unit'], reason: '越界' }] } }), /越界/)
})

test('政策只命中相应范围，文档和父目录无关名称不误命中源码规则', t => {
  const f = fixture(t)
  const profile = { ...f.profile, checks: ['types', 'unit'], commands: { ...f.profile.commands, unit: [{ executable: 'node', args: ['--version'] }] }, checkPolicy: { always: ['types'], rules: [{ paths: ['src/core'], checks: ['unit'], reason: '核心' }] } }
  const w = createWorkflow(f.root, profile)
  const { checks, ...spec } = f.spec
  assert.deepEqual(w.create({ ...spec, scope: ['src/state.txt'] }).checks, ['types'])
  assert.deepEqual(w.create({ ...spec, id: 'records-task', scope: ['docs/tasks/records-task'] }).checks, ['types'])
})

test('调整扩大范围后加入规则检查但不能减掉已有检查', t => {
  const f = fixture(t)
  const profile = { ...f.profile, checks: ['types', 'unit'], commands: { ...f.profile.commands, unit: [{ executable: 'node', args: ['--version'] }] }, checkPolicy: { always: ['types'], rules: [{ paths: ['src/other.txt'], checks: ['unit'], reason: '另一处行为' }] } }
  const w = createWorkflow(f.root, profile)
  const { checks, ...spec } = f.spec
  w.begin({ ...spec, plan: completePlan })
  const amended = w.amend(f.spec.id, { ...spec, scope: ['src'] }, '用户扩大到第二处状态')
  assert.deepEqual(amended.checks, ['types', 'unit'])
  assert.equal(amended.repairRounds, 1)
  assert.throws(() => w.amend(f.spec.id, spec, '缩回范围'), /不能减少已有检查/)
})

test('验证前重查项目必要检查，旧选择不能绕过新增政策', t => {
  const f = fixture(t); f.prepare()
  const profile = { ...f.profile, checks: ['types', 'unit'], commands: { ...f.profile.commands, unit: [{ executable: 'node', args: ['--version'] }] }, checkPolicy: { always: ['types', 'unit'], rules: [] } }
  const resumed = createWorkflow(f.root, profile)
  assert.throws(() => resumed.verify(f.spec.id), /缺少项目必要检查/)
  assert.equal(f.workflow.load(f.spec.id).runs.length, 0)
})

test('未跟踪和排除范围拒绝收件，完善跟踪后变更会使结果失效', t => {
  const f = fixture(t); f.write('README.md', 'original')
  assert.throws(() => f.workflow.create({ ...f.spec, scope: ['README.md'] }), /纳入 watch/)
  assert.throws(() => createWorkflow(f.root, { ...f.profile, exclude: ['src/state.txt'] }).create(f.spec), /已被排除/)
  const w = createWorkflow(f.root, { ...f.profile, watch: ['src', 'README.md'] }, () => ({ status: 0, stdout: 'fixture' }))
  w.begin({ ...f.spec, scope: ['README.md'], plan: completePlan }); w.verify(f.spec.id)
  f.write('README.md', 'changed after checks')
  assert.equal(w.status(f.spec.id)[0].evidenceCurrent, false)
})

test('空证据、检查摘要损坏和必要报告缺少证明均使当前检查失效', t => {
  for (const change of ['empty', 'checks', 'report', 'input']) {
    const f = fixture(t); f.prepare(); const task = f.workflow.verify(f.spec.id)
    if (change === 'empty') task.verification.evidence = []
    if (change === 'checks') task.verification.checks[0].passed = false
    if (change === 'report') task.verification.evidence = task.verification.evidence.filter(item => item.path !== task.runs.at(-1).report)
    if (change === 'input') task.verification.evidence = task.verification.evidence.filter(item => !item.path.endsWith('/input.json'))
    f.write('docs/tasks/fixture-task/task.json', task)
    assert.equal(f.workflow.status(f.spec.id)[0].evidenceCurrent, false, change)
    assert.throws(() => f.review(), /证据已变化|原始结果不一致/)
  }
})

test('context 完整保留需求与约束，长计划只摘录且不会写回', t => {
  const f = fixture(t)
  const spec = { ...f.spec, request: '完整需求不能静默丢失。'.repeat(500), criteria: [{ id: 'criteria-one', description: '完整验收条件。'.repeat(300) }], plan: completePlan.repeat(40) }
  f.workflow.begin(spec)
  const before = fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json'))
  const context = f.workflow.context(f.spec.id)
  assert.equal(context.request, spec.request); assert.deepEqual(context.criteria, spec.criteria)
  assert.deepEqual(context.scope, spec.scope); assert.deepEqual(context.manualChecks, spec.manualChecks)
  assert.equal(context.plan.text.length, 2400); assert.equal(context.plan.truncated, true)
  assert.equal(context.plan.totalCharacters, spec.plan.length)
  assert.equal(context.baseline, undefined); assert.equal(context.runs, undefined)
  assert.equal(context.readOnly, true)
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'docs/tasks/fixture-task/task.json')), before)
})

test('context 返回失效和缺失计划原因，不沿用成功或伪造摘录', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id)
  f.write('src/state.txt', 'changed')
  const stale = f.workflow.context(f.spec.id)
  assert.equal(stale.evidenceCurrent, false); assert.equal(stale.action, 'inspect')
  fs.unlinkSync(path.join(f.root, 'docs/tasks/fixture-task/plan.md'))
  const missing = f.workflow.context(f.spec.id)
  assert.ok(missing.plan.error); assert.equal(missing.plan.text, undefined)
})

test('一次多任务 status 和 inspect 只扫描一次，下次查询重新检测变化', t => {
  const f = fixture(t)
  f.profile.watch.push('src/state.txt')
  for (let i = 0; i < 6; i++) {
    const id = `scan-task-${i}`
    f.workflow.begin({ ...f.spec, id, plan: completePlan }); f.workflow.verify(id)
  }
  const original = fs.readFileSync
  let reads = 0
  fs.readFileSync = function (file, ...args) { if (file === path.join(f.root, 'src/state.txt')) reads++; return original.call(this, file, ...args) }
  try {
    assert.ok(f.workflow.status().every(task => task.evidenceCurrent)); assert.equal(reads, 1)
    reads = 0; assert.equal(f.workflow.inspect('scan-task-0').evidenceCurrent, true); assert.equal(reads, 1)
    f.write('src/state.txt', 'changed between queries')
    reads = 0; assert.ok(f.workflow.status().every(task => !task.evidenceCurrent)); assert.equal(reads, 1)
  } finally { fs.readFileSync = original }
})

test('finish 两个阶段之间输入变化会留下真实 reviewed 状态并停止交付', t => {
  const f = fixture(t); f.prepare(); f.workflow.verify(f.spec.id)
  const file = f.write('docs/review.json', { reviewer: '当前会话', summary: '初次复核', findings: [], criteria: [{ id: 'criteria-one', result: 'passed', evidence: [f.workflow.load(f.spec.id).runs.at(-1).report] }] })
  const original = fs.renameSync
  fs.renameSync = function (from, to) {
    const result = original.call(this, from, to)
    if (to === path.join(f.root, 'docs/tasks/fixture-task/review.json')) f.write('src/state.txt', 'changed between review and deliver')
    return result
  }
  try { assert.throws(() => f.workflow.finish(f.spec.id, file), /已变化/) }
  finally { fs.renameSync = original }
  const task = f.workflow.load(f.spec.id)
  assert.equal(task.status, 'reviewed'); assert.equal(task.delivery, undefined)
  assert.equal(f.workflow.receipt(task).action, 'inspect')
})

test('声明的检查报告不能从证明清单中移除后沿用成功', t => {
  const f = fixture(t)
  f.write('docs/check.mjs', "import fs from 'node:fs'; fs.writeFileSync(process.argv[2], JSON.stringify({passed:true}));")
  const profile = { ...f.profile, watch: ['src', 'docs/check.mjs'], commands: { types: [{ executable: 'node', args: ['docs/check.mjs', '{evidenceDir}/report.json'], outputs: ['{evidenceDir}/report.json'] }] } }
  const w = createWorkflow(f.root, profile)
  w.begin({ ...f.spec, plan: completePlan }); const task = w.verify(f.spec.id)
  assert.equal(task.verification.passed, true)
  task.verification.evidence = task.verification.evidence.filter(item => !item.path.endsWith('/report.json'))
  f.write('docs/tasks/fixture-task/task.json', task)
  const state = w.status(f.spec.id)[0]
  assert.equal(state.evidenceCurrent, false)
  assert.equal(state.integrity.verification.resultConsistent, false)
})
