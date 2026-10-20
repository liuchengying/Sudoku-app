#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorkflow, safePath, withLock, inspectLock, TOOL_VERSION } from './workflow.mjs'

const json = value => JSON.stringify(value, null, 2) + '\n'
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const read = (root, relative) => JSON.parse(fs.readFileSync(safePath(root, relative, true), 'utf8'))
function options(argv) {
  const global = {}; const args = []
  for (let i = 0; i < argv.length; i++) {
    if (['--project', '--config'].includes(argv[i])) {
      const key = argv[i].slice(2)
      assert(!global[key] && argv[i + 1] && !argv[i + 1].startsWith('--'), `需要唯一 ${argv[i]} 参数`)
      global[key] = argv[++i]
    } else args.push(argv[i])
  }
  return { ...global, args }
}
const HELP = `ai-delivery ${TOOL_VERSION}
用户描述需求，AI 使用这些命令。Node >= 20，无需启动项目。
ai-delivery [--project 项目绝对路径] [--config 相对配置路径] <命令>
init [--adapter docs/...json]  不覆盖接入；无适配器时生成待配置草稿
doctor                       核查接入与脚本注册
new --spec docs/...json       创建需求
begin --spec docs/...json     收件含 plan 时合并创建、计划、开工
finish ID --file docs/...json 合并复核与交付，保持全部门槛
amend ID --spec docs/...json --reason 原因  归档旧定义，更新需求并重新计划
plan ID | start ID | verify ID | deliver ID
review ID --file docs/...json | decision ID --file docs/...json
rework ID --reason 原因
next [ID]                    只读待办；不自动选择多个候选或执行任务
context ID                   只读精简接续包，完整保留需求与验收条件
status [ID] | receipt ID | inspect ID | report | --version
默认查找 .ai-agent/project.json 或 docs/ai-delivery/project.json。
`

export function runCLI(argv = process.argv.slice(2), cwd = process.cwd()) {
  const opts = options(argv)
  const [command = 'help', first, ...rest] = opts.args
  if (['help', '--help', '-h'].includes(command)) return { output: HELP, exitCode: 0 }
  if (command === '--version') return { output: TOOL_VERSION + '\n', exitCode: 0 }
  const root = fs.realpathSync(path.resolve(cwd, opts.project ?? '.'))
  assert(fs.statSync(root).isDirectory(), '项目路径必须是目录')
  const config = opts.config ?? (fs.existsSync(safePath(root, '.ai-agent/project.json', true)) ? '.ai-agent/project.json' : 'docs/ai-delivery/project.json')
  const configFile = safePath(root, config, true)
  const option = (args, flag) => { assert(args.length === 2 && args[0] === flag && args[1]?.trim(), `需要 ${flag}，不接受额外参数`); return args[1] }
  if (command === 'init') {
    assert(!first || (first === '--adapter' && rest.length === 1), 'init 仅接受 --adapter docs/...json')
    if (fs.existsSync(configFile)) return { output: json({ workflow: 'ai-delivery', version: TOOL_VERSION, project: root, config, initialized: false, reason: '已有配置，保留原文件；运行 doctor 查看接入状态' }), exitCode: 0 }
    const draft = !first
    const profile = draft ? { schemaVersion: 2, name: path.basename(root), timezone: 'UTC', maxRepairRounds: 3, checkTimeoutMs: 120000, watch: ['src'], exclude: [], checks: [], commands: {}, ruleFiles: ['docs/workflow/RULES.md'] } : read(root, rest[0])
    profile.watch ??= []
    profile.ruleFiles ??= ['docs/workflow/RULES.md']
    for (const file of [config, ...profile.ruleFiles]) {
      safePath(root, file, true)
      if (!profile.watch.some(prefix => file === prefix || file.startsWith(prefix + '/'))) profile.watch.push(file)
    }
    if (!draft) createWorkflow(root, profile)
    fs.mkdirSync(path.dirname(configFile), { recursive: true })
    fs.writeFileSync(configFile, json(profile), { flag: 'wx' })
    const rules = safePath(root, 'docs/workflow/RULES.md', true)
    if (!fs.existsSync(rules)) {
      fs.mkdirSync(path.dirname(rules), { recursive: true })
      fs.writeFileSync(rules, '# 项目交付规则\n\n权限以当前用户授权和本项目 AGENTS.md 为准。AI 先读取配置中的 ruleFiles、项目说明和相关源码；有未完任务时优先恢复。任务材料位于 docs/tasks，状态摘要位于 docs/workflow/STATUS.md。检查命令由项目适配器明确注册；不要注册应用启动或发布命令。用户明确验收后再记录 accepted。\n', { flag: 'wx' })
    }
    return { output: json({ workflow: 'ai-delivery', version: TOOL_VERSION, project: root, config, initialized: true, ready: !draft, next: draft ? 'AI 核实本项目脚本后填写 watch/checks/commands，再运行 doctor；没有检查不会假装完成接入' : '运行 doctor 后建立第一个需求' }), exitCode: 0 }
  }
  if (command === 'doctor') {
    assert(!first, 'doctor 不接受额外参数')
    const warnings = []; let profile
    try {
      profile = read(root, config)
      const workflow = createWorkflow(root, profile)
      for (const file of profile.ruleFiles ?? []) {
        assert(fs.statSync(safePath(root, file, true)).isFile(), `规则文件不存在：${file}`)
        if (!profile.watch.some(prefix => file === prefix || file.startsWith(prefix + '/'))) warnings.push(`规则文件未纳入 watch：${file}`)
      }
      if (!profile.watch.some(prefix => config === prefix || config.startsWith(prefix + '/'))) warnings.push('配置文件未纳入 watch；配置内容仍参与验收指纹，建议纳入范围检查')
      const runtime = inspectLock(root, workflow.runtimeDir)
      return { output: json({ workflow: 'ai-delivery', version: TOOL_VERSION, project: root, config, ready: true, checks: profile.checks, warnings, runtime, writeAvailable: !runtime.alive && !runtime.error, note: '配置可用；未运行检查，也未证明模型自动选择技能' }), exitCode: 0 }
    } catch (error) {
      return { output: json({ workflow: 'ai-delivery', version: TOOL_VERSION, project: root, config, ready: false, error: error.message, next: 'AI 完善项目适配后重试；缺配置可先 init' }), exitCode: 1 }
    }
  }
  const workflow = createWorkflow(root, read(root, config))
  const run = () => {
    let result
    if (['new', 'begin'].includes(command)) result = workflow[command === 'new' ? 'create' : 'begin'](read(root, option([first, ...rest], '--spec')))
    else if (command === 'amend') {
      assert(first && rest.length === 4 && rest[0] === '--spec' && rest[2] === '--reason', '需要 amend ID --spec docs/...json --reason 原因')
      result = workflow.amend(first, read(root, rest[1]), rest[3])
    }
    else if (['plan', 'start', 'verify', 'deliver'].includes(command)) { assert(first && rest.length === 0, '需要任务 ID，不接受额外参数'); result = workflow[command](first) }
    else if (['review', 'decision', 'finish'].includes(command)) result = workflow[command](first, option(rest, '--file'))
    else if (command === 'rework') result = workflow.rework(first, option(rest, '--reason'))
    else if (command === 'receipt') { assert(first && !rest.length, '需要任务 ID'); result = workflow.receipt(workflow.load(first)) }
    else if (command === 'inspect') { assert(first && !rest.length, '需要任务 ID'); result = workflow.inspect(first) }
    else if (command === 'context') { assert(first && !rest.length, '需要任务 ID'); result = workflow.context(first) }
    else if (command === 'next') { assert(rest.length === 0, '不接受额外参数'); result = workflow.next(first) }
    else if (command === 'status') { assert(rest.length === 0, '不接受额外参数'); result = workflow.status(first) }
    else if (command === 'report') { assert(!first, 'report 不接受参数'); result = workflow.report() }
    else throw new Error('未知命令；使用 help 查看操作')
    return { output: json(result?.id ? workflow.receipt(result) : result), exitCode: command === 'verify' && !result.verification.passed ? 1 : 0 }
  }
  return ['status', 'receipt', 'inspect', 'next', 'context'].includes(command) ? run() : withLock(root, run, workflow.runtimeDir)
}

export function main(argv = process.argv.slice(2)) {
  try { const result = runCLI(argv); process.stdout.write(result.output); process.exitCode = result.exitCode }
  catch (error) { process.stderr.write(`ai-delivery 停止：${error.message}\n`); process.exitCode = 1 }
}
if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main()
