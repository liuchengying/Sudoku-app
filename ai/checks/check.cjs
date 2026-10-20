#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { readCatalog, verifyEntries } = require('../scripts/install-entrypoints.cjs');
const root = path.resolve(__dirname, '../..');
const ownChecks = ['adapter', 'adapter-tests', 'behavior-tests', 'risk-evidence'];
const matches = (file, prefix) => file === prefix || file.startsWith(prefix + '/');

function localFile(project, relative, allowMissing = false) {
  if (
    typeof relative !== 'string' ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes('\\') ||
    relative.includes('\0') ||
    relative.split('/').some((item) => !item || item === '.' || item === '..') ||
    ['.git', 'node_modules', '.aws'].includes(relative.split('/')[0])
  )
    throw new Error(`无效项目路径：${relative}`);
  let file = project;
  for (const part of relative.split('/')) {
    file = path.join(file, part);
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) throw new Error(`不读取链接输入：${relative}`);
  }
  if (!allowMissing && !fs.statSync(file).isFile()) throw new Error(`不是输入文件：${relative}`);
  return file;
}

function selectFiles(project, task, input) {
  if (!Array.isArray(task.scope) || !task.scope.length || !task.baseline || !input.files)
    throw new Error('缺少任务范围、基线或本轮输入快照');
  task.scope.forEach((file) => localFile(project, file, true));
  const changed = [...new Set([...Object.keys(task.baseline), ...Object.keys(input.files)])].filter(
    (file) => task.baseline[file] !== input.files[file]
  );
  if (changed.some((file) => !task.scope.some((prefix) => matches(file, prefix))))
    throw new Error('输入快照包含任务范围外变化');
  const selected = new Set(changed.filter((file) => input.files[file] !== undefined && input.files[file] !== null));
  // Explicit files are checked even when unchanged; directory scopes select changed files only.
  for (const file of task.scope) {
    const stat = fs.lstatSync(localFile(project, file, true), { throwIfNoEntry: false });
    if (stat?.isFile()) selected.add(file);
  }
  return {
    files: [...selected].sort().filter((file) => fs.statSync(localFile(project, file)).isFile()),
    deleted: changed.filter((file) => input.files[file] === undefined || input.files[file] === null),
  };
}

function command(project, executable, args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(executable, args, {
    cwd: project,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
    env,
  });
  return {
    executable: path.basename(executable),
    args,
    exitCode: result.status,
    passed: result.status === 0 && !result.error,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error?.message || null,
  };
}

// SKILL.md frontmatter 只使用单行标量字段（name、description），无需 YAML 依赖。
function skillFrontmatter(content) {
  const front = content.match(/^---\n([\s\S]*?)\n---/);
  if (!front) return null;
  const data = {};
  for (const line of front[1].split('\n')) {
    const field = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (field) data[field[1]] = field[2].replace(/^['"]|['"]$/g, '');
  }
  return data;
}

async function adapter(project) {
  const entries = verifyEntries(project);
  const profile = JSON.parse(fs.readFileSync(path.join(project, '.ai-agent/project.json'), 'utf8'));
  const { createWorkflow } = await import(
    pathToFileURL(path.join(project, 'ai/skills/ai-delivery/scripts/workflow.mjs'))
  );
  createWorkflow(project, profile);
  for (const file of profile.ruleFiles) localFile(project, file);
  if (!profile.watch.includes('ai') || !profile.watch.includes('.ai-agent'))
    throw new Error('维护源未完整纳入输入跟踪');
  const skills = [];
  for (const { name } of readCatalog(project).active) {
    const relative = `ai/skills/${name}/SKILL.md`;
    const data = skillFrontmatter(fs.readFileSync(localFile(project, relative), 'utf8'));
    if (data?.name !== name || typeof data.description !== 'string' || !data.description.trim())
      throw new Error(`技能元数据无效：${relative}`);
    if (data.description.length > 1024) throw new Error(`技能描述过长：${relative}`);
    skills.push({ name, source: relative });
  }
  return { entries, skills, profileValid: true, note: '文件接入校验；不证明客户端界面已刷新或模型自动触发。' };
}

async function runCheck(project, mode, taskDir, evidenceDir) {
  if (!ownChecks.includes(mode)) throw new Error(`未注册的检查模式：${mode}`);
  if (!matches(taskDir, 'docs/tasks') || !matches(evidenceDir, `${taskDir}/evidence`))
    throw new Error('报告必须位于当前任务 evidence 目录');
  const task = JSON.parse(fs.readFileSync(localFile(project, `${taskDir}/task.json`), 'utf8'));
  const input = JSON.parse(fs.readFileSync(localFile(project, `${evidenceDir}/input.json`), 'utf8'));
  const selected = selectFiles(project, task, input);
  const report = { mode, status: 'passed', files: [], deleted: selected.deleted, commands: [] };
  const runNode = (args) => {
    const outcome = command(project, process.execPath, args);
    report.commands.push(outcome);
    if (!outcome.passed) report.status = 'failed';
  };
  if (mode === 'adapter') report.adapter = await adapter(project);
  else if (mode === 'adapter-tests')
    runNode([
      '--test',
      'ai/checks/adapter.test.cjs',
      'ai/checks/entrypoints.test.cjs',
      'ai/checks/acceptance.test.cjs',
    ]);
  else if (mode === 'risk-evidence') {
    const { checkGate } = require('./acceptance.cjs');
    Object.assign(report, checkGate(project, task, input, evidenceDir));
  } else {
    const extensions = { 'behavior-tests': /\.test\.(?:js|cjs|mjs)$/ };
    report.files = selected.files.filter((file) => extensions[mode].test(file));
    if (!report.files.length) {
      report.status = 'failed';
      report.reason = '请求了行为测试，但任务范围内没有测试文件';
    } else runNode(['--test', ...report.files]);
  }
  const reportFile = localFile(project, `${evidenceDir}/${mode}.json`, true);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  return report;
}

module.exports = { localFile, selectFiles, command, adapter, runCheck };
if (require.main === module) {
  const [mode, taskDir, evidenceDir, ...rest] = process.argv.slice(2);
  (async () => {
    if (rest.length) throw new Error('检查入口不接受额外参数');
    const report = await runCheck(root, mode, taskDir, evidenceDir);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.exitCode = report.status === 'failed' ? 1 : 0;
  })().catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
}
