#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { TOOL_VERSION } from './workflow.mjs'

const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILES = ['SKILL.md', 'package.json', 'README.md', 'agents/openai.yaml', 'references/project-adapter.md', 'references/recovery.md', 'scripts/workflow.mjs', 'scripts/policy.mjs', 'scripts/ai-delivery.mjs', 'scripts/install.mjs', 'tests/engine.test.mjs', 'tests/cli-install.test.mjs']
const SKILL = '.agents/skills/ai-delivery'
const MANIFEST = `${SKILL}/install-manifest.json`
const BIN = '.local/bin/ai-delivery'
const START = '<!-- ai-delivery:begin -->'
const END = '<!-- ai-delivery:end -->'
const sha = content => crypto.createHash('sha256').update(content).digest('hex')
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const json = value => JSON.stringify(value, null, 2) + '\n'

function localPath(home, relative) {
  assert(!path.isAbsolute(relative) && relative.split('/').every(part => part && part !== '.' && part !== '..'), '安装路径无效')
  let target = home
  for (const part of relative.split('/')) {
    target = path.join(target, part)
    const stat = fs.lstatSync(target, { throwIfNoEntry: false })
    assert(!stat?.isSymbolicLink(), `安装拒绝符号链接：${relative}`)
  }
  return target
}
const contents = file => fs.existsSync(file) ? fs.readFileSync(file) : null
function write(file, data, mode = 0o644) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = file + '.' + crypto.randomUUID() + '.tmp'
  try { fs.writeFileSync(temp, data, { mode, flag: 'wx' }); fs.renameSync(temp, file) }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp) }
}
function transaction(changes) {
  const before = changes.map(change => ({ ...change, old: contents(change.file), oldMode: fs.existsSync(change.file) ? fs.statSync(change.file).mode & 0o777 : null }))
  try {
    for (const change of changes) {
      if (change.data === null) fs.unlinkSync(change.file)
      else write(change.file, change.data, change.mode)
    }
  } catch (error) {
    for (const change of before.reverse()) {
      if (change.old === null) fs.rmSync(change.file, { force: true })
      else write(change.file, change.old, change.oldMode)
    }
    throw error
  }
}
function owned(home, manifest) {
  assert(manifest.owner === 'ai-delivery' && manifest.schemaVersion === 1, '同名目录不是本工具管理的安装')
  assert(manifest.skill === SKILL && manifest.bin === BIN, '安装清单位置异常')
  const files = Object.keys(manifest.files ?? {})
  const required = [BIN, ...['SKILL.md', 'package.json', 'scripts/workflow.mjs', 'scripts/ai-delivery.mjs', 'scripts/install.mjs'].map(file => `${SKILL}/${file}`)]
  assert(required.every(file => files.includes(file)), '安装清单缺少核心拥有文件')
  assert(files.every(file => {
    if (file === BIN) return true
    if (!file.startsWith(SKILL + '/')) return false
    const relative = file.slice(SKILL.length + 1)
    return ['SKILL.md', 'README.md', 'package.json'].includes(relative) || /^(scripts|references|agents|tests)\//.test(relative)
  }), '安装清单文件异常')
  for (const [relative, hash] of Object.entries(manifest.files)) {
    const data = contents(localPath(home, relative))
    assert(data && sha(data) === hash, `安装文件已被修改或缺失，拒绝覆盖/删除：${relative}`)
  }
  assert(['.codex/AGENTS.md', '.codex/AGENTS.override.md'].includes(manifest.routeFile), '全局路由位置异常')
  assert(manifest.routeBlock?.includes(START) && manifest.routeBlock?.includes(END), '全局路由清单无效')
  const route = contents(localPath(home, manifest.routeFile))?.toString() ?? ''
  assert(route.split(manifest.routeBlock).length === 2, '全局路由段已被修改或缺失，拒绝自动处理')
}
function block(home) {
  return `\n\n${START}\n## AI 交付公共工具\n\n当用户提出开发、修复或需求交付任务，且项目存在 .ai-agent/project.json 或 docs/ai-delivery/project.json 时，读取 ${path.join(home, SKILL, 'SKILL.md')} 并使用 ai-delivery 推进真实任务。用户明确要求接入项目时，也使用该技能完成适配。普通咨询或头脑风暴直接回答。使用技能后简短展示实际任务阶段、检查结果和下一步；用户只需描述需求与最终验收。当前用户约定和项目约定优先，此路由不授予 Git、电脑控制、工程启动或发布权限。\n${END}\n`
}

export function manageInstallation({ mode = 'install', home = os.homedir(), dryRun = false, source = SOURCE } = {}) {
  assert(['install', 'uninstall', 'doctor'].includes(mode), '安装命令应为 install、uninstall 或 doctor')
  home = fs.realpathSync(home)
  const manifestFile = localPath(home, MANIFEST)
  const installed = fs.existsSync(manifestFile)
  const old = installed ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null
  if (old) owned(home, old)
  if (mode === 'doctor') {
    assert(old, '尚未安装 ai-delivery')
    const override = localPath(home, '.codex/AGENTS.override.md')
    const routeActive = old.routeFile.endsWith('AGENTS.override.md') || !fs.existsSync(override)
    return { mode, installed: true, version: old.version, skill: localPath(home, SKILL), bin: localPath(home, BIN), route: localPath(home, old.routeFile), routeActive, note: routeActive ? '文件哈希与路由有效；模型自动选择需在新会话实际观察' : '后来出现 AGENTS.override.md；重新运行新版 install 会保留规则并迁移路由' }
  }
  if (mode === 'uninstall') {
    if (!old) return { mode, installed: false, changed: false }
    const routeFile = localPath(home, old.routeFile)
    const route = fs.readFileSync(routeFile, 'utf8').replace(old.routeBlock, '')
    const changes = Object.keys(old.files).map(relative => ({ file: localPath(home, relative), data: null }))
    changes.push({ file: routeFile, data: !old.routeExisted && route === '' ? null : route, mode: fs.statSync(routeFile).mode & 0o777 })
    changes.push({ file: manifestFile, data: null })
    if (!dryRun) {
      transaction(changes)
      for (const relative of [`${SKILL}/scripts`, `${SKILL}/agents`, `${SKILL}/references`, `${SKILL}/tests`, SKILL]) {
        const target = localPath(home, relative)
        if (fs.existsSync(target) && fs.readdirSync(target).length === 0) fs.rmdirSync(target)
      }
    }
    return { mode, dryRun, installed: dryRun, changed: !dryRun, preserved: '项目任务、其他全局规则及非本工具文件' }
  }
  const skillPath = localPath(home, SKILL)
  if (!old) {
    assert(!fs.existsSync(skillPath), '已有同名技能，拒绝覆盖；请先核对归属')
    assert(!fs.existsSync(localPath(home, BIN)), '已有同名命令，拒绝覆盖')
  }
  const routeRelative = fs.existsSync(localPath(home, '.codex/AGENTS.override.md')) ? '.codex/AGENTS.override.md' : '.codex/AGENTS.md'
  const movingRoute = old && old.routeFile !== routeRelative
  const routeFile = localPath(home, routeRelative)
  const routeOld = contents(routeFile)?.toString() ?? ''
  if (!old || movingRoute) assert(!routeOld.includes(START) && !routeOld.includes(END), '目标全局规则已有非拥有路由标记，拒绝覆盖')
  const routeBlock = block(home)
  const route = old && !movingRoute ? routeOld.replace(old.routeBlock, routeBlock) : routeOld + routeBlock
  const data = Object.fromEntries(FILES.map(relative => [`${SKILL}/${relative}`, fs.readFileSync(path.join(source, relative))]))
  data[BIN] = `#!/usr/bin/env node\nimport(${JSON.stringify(path.join(skillPath, 'scripts/ai-delivery.mjs'))}).then(({ main }) => main()).catch(error => { console.error(error.message); process.exitCode = 1 });\n`
  assert(JSON.parse(data[`${SKILL}/package.json`].toString()).version === TOOL_VERSION, '安装源码与执行器版本不一致；请从目标版本包运行安装器')
  for (const relative of Object.keys(data)) {
    const target = localPath(home, relative)
    assert(!fs.existsSync(target) || Boolean(old?.files[relative]), `新增安装路径已有非拥有文件，拒绝覆盖：${relative}`)
  }
  const files = Object.fromEntries(Object.entries(data).map(([relative, content]) => [relative, sha(content)]))
  const unchanged = old && !movingRoute && old.version === TOOL_VERSION && JSON.stringify(old.files) === JSON.stringify(files) && old.routeBlock === routeBlock
  const manifest = { schemaVersion: 1, owner: 'ai-delivery', version: TOOL_VERSION, installedAt: new Date().toISOString(), skill: SKILL, bin: BIN, files, routeFile: routeRelative, routeBlock, routeExisted: old && !movingRoute ? old.routeExisted : fs.existsSync(routeFile) }
  if (!dryRun && !unchanged) {
    const changes = Object.entries(data).map(([relative, content]) => ({ file: localPath(home, relative), data: content, mode: relative === BIN ? 0o755 : 0o644 }))
    if (old) for (const relative of Object.keys(old.files)) {
      if (!(relative in data)) changes.push({ file: localPath(home, relative), data: null })
    }
    if (movingRoute) {
      const previous = localPath(home, old.routeFile)
      const text = fs.readFileSync(previous, 'utf8').replace(old.routeBlock, '')
      changes.push({ file: previous, data: !old.routeExisted && text === '' ? null : text, mode: fs.statSync(previous).mode & 0o777 })
    }
    changes.push({ file: routeFile, data: route, mode: fs.existsSync(routeFile) ? fs.statSync(routeFile).mode & 0o777 : 0o644 }, { file: manifestFile, data: json(manifest) })
    transaction(changes)
  }
  return { mode, dryRun, installed: dryRun ? Boolean(old) : true, changed: !dryRun && !unchanged, version: TOOL_VERSION, skill: skillPath, bin: localPath(home, BIN), route: routeFile, next: '在新会话使用 $ai-delivery；尚未接入的项目请先要求 AI 接入' }
}

function main() {
  const [mode = 'install', ...args] = process.argv.slice(2)
  let home; let dryRun = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--home' && args[i + 1] && !home) home = args[++i]
    else if (args[i] === '--dry-run' && !dryRun) dryRun = true
    else throw new Error('仅接受 --home 目录和 --dry-run')
  }
  process.stdout.write(json(manageInstallation({ mode, home, dryRun })))
}
if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { process.stderr.write(`ai-delivery 安装停止：${error.message}\n`); process.exitCode = 1 }
}
