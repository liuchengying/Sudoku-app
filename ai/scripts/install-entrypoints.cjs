#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '../..');
const statePath = 'docs/ai-delivery/local/entrypoints.json';
const begin = '<!-- sudoku:rules:begin -->';
const end = '<!-- sudoku:rules:end -->';
const header =
  '<!-- Generated from .ai-agent/RULES.md; edit the source and run ai/scripts/install-entrypoints.cjs --install. -->\n\n';
const profiles = {
  codex: '.agents',
  cursor: '.agents',
  copilot: '.agents',
  windsurf: '.agents',
  claude: '.claude',
  zcode: '.zcode',
  'windsurf-legacy': '.windsurf',
  generic: '.agents',
};
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function local(project, relative, allowEntryLink = false) {
  assert(
    typeof relative === 'string' &&
      !path.isAbsolute(relative) &&
      !relative.includes('\\') &&
      !relative.includes('\0') &&
      relative.split('/').every((part) => part && part !== '.' && part !== '..'),
    `无效本地路径：${relative}`
  );
  let file = project;
  const parts = relative.split('/');
  parts.forEach((part, index) => {
    file = path.join(file, part);
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (stat) {
      assert(!stat.isSymbolicLink() || (allowEntryLink && index === parts.length - 1), `保留链接父目录：${relative}`);
      if (index < parts.length - 1) assert(stat.isDirectory() && !stat.isSymbolicLink(), `异常父目录：${relative}`);
    }
  });
  return file;
}

function tree(folder) {
  const files = {};
  function walk(dir, prefix = '') {
    for (const name of fs.readdirSync(dir).sort()) {
      if (name === '.DS_Store') continue;
      const file = path.join(dir, name);
      const relative = prefix + name;
      const stat = fs.lstatSync(file);
      assert(!stat.isSymbolicLink(), `技能包内不允许链接：${relative}`);
      if (stat.isDirectory()) walk(file, relative + '/');
      else {
        assert(stat.isFile(), `异常技能文件：${relative}`);
        files[relative] = sha(fs.readFileSync(file));
      }
    }
  }
  walk(folder);
  return files;
}

function readCatalog(project = root) {
  const catalog = JSON.parse(fs.readFileSync(local(project, '.ai-agent/skills.json'), 'utf8'));
  assert(catalog.schemaVersion === 1 && Array.isArray(catalog.active) && catalog.active.length, '技能清单缺少活动技能');
  const names = new Set();
  for (const item of catalog.active) {
    assert(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.name) && !names.has(item.name) && item.source === `ai/skills/${item.name}`,
      '技能清单存在重名或无效来源'
    );
    names.add(item.name);
  }
  return catalog;
}

function verifySources(project = root) {
  const catalog = readCatalog(project);
  assert(fs.statSync(local(project, '.ai-agent/RULES.md')).isFile(), '共同规则不存在');
  const skills = catalog.active.map((item) => {
    const source = local(project, item.source);
    assert(fs.statSync(local(project, `${item.source}/SKILL.md`)).isFile(), `技能源不存在：${item.source}`);
    const packageFile = local(project, `${item.source}/package.json`);
    if (item.version && fs.existsSync(packageFile))
      assert(
        JSON.parse(fs.readFileSync(packageFile, 'utf8')).version === item.version,
        `包版本与清单不符：${item.name}`
      );
    return { ...item, files: tree(source) };
  });
  const provenance = local(project, '.ai-agent/skill-sources.json');
  if (fs.existsSync(provenance)) {
    const pinned = JSON.parse(fs.readFileSync(provenance, 'utf8'));
    assert(
      catalog.active.some((item) => item.name === pinned.name),
      '固定公共包不在技能清单中'
    );
    const actualFiles = Object.keys(skills.find((item) => item.name === pinned.name).files).sort();
    assert(
      equal(
        actualFiles,
        Object.keys(pinned.files)
          .filter((file) => file !== '.DS_Store')
          .sort()
      ),
      '固定公共包文件清单已变化'
    );
    for (const [file, hash] of Object.entries(pinned.files)) {
      if (file === '.DS_Store') continue;
      assert(
        sha(fs.readFileSync(local(project, `ai/skills/${pinned.name}/${file}`))) === hash,
        `固定公共包已变化：${pinned.name}/${file}`
      );
    }
  }
  return { rulesSource: '.ai-agent/RULES.md', catalog: '.ai-agent/skills.json', skillCount: skills.length, skills };
}

function readState(project) {
  const file = local(project, statePath);
  if (!fs.existsSync(file)) return null;
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(
    state.schemaVersion === 1 &&
      Array.isArray(state.clients) &&
      state.clients.every((name) => Object.hasOwn(profiles, name)) &&
      state.entries &&
      state.documents,
    '本地接入清单损坏，保留现有文件'
  );
  return state;
}

function resolvedLink(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(path.dirname(file), fs.readlinkSync(file));
  }
}

function selectClients(project, requested, state = readState(project)) {
  const clients = requested || state?.clients || ['codex'];
  assert(
    Array.isArray(clients) && clients.length && clients.every((name) => Object.hasOwn(profiles, name)),
    `客户端必须来自：${Object.keys(profiles).join(', ')}`
  );
  const selected = [...new Set(clients)];
  if (!requested && !state) {
    for (const name of ['claude', 'zcode']) {
      const file = local(project, `${profiles[name]}/skills/ai-delivery`, true);
      const stat = fs.lstatSync(file, { throwIfNoEntry: false });
      if (stat?.isSymbolicLink() && resolvedLink(file) === fs.realpathSync(path.join(project, 'ai/skills/ai-delivery')))
        selected.push(name);
    }
  }
  return selected;
}

function generatedRules(project = root) {
  return `${begin}\n${header}${fs.readFileSync(local(project, '.ai-agent/RULES.md'), 'utf8').trimEnd()}\n\n${end}\n`;
}

function blockOf(text) {
  const first = text.indexOf(begin);
  const last = text.indexOf(end);
  if (first < 0 && last < 0) return null;
  assert(
    first >= 0 &&
      last > first &&
      text.indexOf(begin, first + begin.length) < 0 &&
      text.indexOf(end, last + end.length) < 0,
    '规则管理标记不完整或重复'
  );
  return { start: first, stop: last + end.length, text: text.slice(first, last + end.length) };
}

function documentPlan(project, name, content, state) {
  const file = local(project, name);
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const desired = blockOf(content).text;
  const block = previous === null ? null : blockOf(previous);
  let next;
  if (block) {
    const owned = state?.documents[name];
    assert(block.text === desired || (owned && sha(block.text) === owned), `保留被修改的管理区块：${name}`);
    next = previous.slice(0, block.start) + desired + previous.slice(block.stop);
  } else {
    assert(!state?.documents[name], `保留管理标记已被移除的规则：${name}`);
    const legacy =
      name === 'AGENTS.md' ? header + fs.readFileSync(local(project, '.ai-agent/RULES.md'), 'utf8') : '@AGENTS.md\n';
    next =
      previous === null || previous === legacy
        ? content
        : previous + (previous.endsWith('\n') ? '\n' : '\n\n') + content;
  }
  return { name, previous, next, blockHash: sha(desired), action: next === previous ? 'unchanged' : 'update' };
}

function buildPlan(project = root, options = {}) {
  const sources = verifySources(project);
  const state = readState(project);
  const clients = selectClients(project, options.clients, state);
  const folders = [...new Set(clients.map((name) => profiles[name]))];
  const entries = folders.flatMap((folder) =>
    sources.skills.map(({ name, source, version, files }) => {
      const entry = `${folder}/skills/${name}`;
      const file = local(project, entry, true);
      const target = local(project, source);
      const stat = fs.lstatSync(file, { throwIfNoEntry: false });
      const owned = state?.entries[entry];
      if (!stat) return { entry, source, version, files, action: 'create' };
      if (stat.isSymbolicLink()) {
        const actual = resolvedLink(file);
        assert(actual === fs.realpathSync(target), `保留指向其他来源的入口：${entry}`);
        return {
          entry,
          source,
          version,
          files,
          mode: owned?.mode || 'symlink',
          action: actual === fs.realpathSync(target) ? 'unchanged' : 'migrate',
        };
      }
      assert(stat.isDirectory() && owned?.mode === 'copy' && owned.source === source, `保留已有非管理副本：${entry}`);
      const actualFiles = tree(file);
      assert(equal(actualFiles, owned.files), `保留被修改的技能副本：${entry}`);
      return {
        entry,
        source,
        version,
        files,
        mode: 'copy',
        action: equal(actualFiles, files) ? 'unchanged' : 'update-copy',
      };
    })
  );
  const documents = [documentPlan(project, 'AGENTS.md', generatedRules(project), state)];
  if (clients.includes('claude'))
    documents.push(documentPlan(project, 'CLAUDE.md', `${begin}\n\n@AGENTS.md\n\n${end}\n`, state));
  return { sources, state, clients, entries, documents };
}

function plannedEntries(project = root, options = {}) {
  return buildPlan(project, options).entries;
}

function verifyEntries(project = root, options = {}) {
  const plan = buildPlan(project, options);
  assert(
    plan.documents.every((item) => item.action === 'unchanged'),
    '共同规则入口未同步，重新生成入口'
  );
  assert(
    plan.entries.every((item) => item.action === 'unchanged'),
    '技能入口未同步维护源，重新生成入口'
  );
  return {
    rulesSource: plan.sources.rulesSource,
    catalog: plan.sources.catalog,
    skillCount: plan.sources.skillCount,
    clients: plan.clients,
    entries: plan.entries.map(({ entry, source, mode, version }) => ({ entry, source, mode, version })),
    uiActivationVerified: false,
  };
}

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const file of Object.keys(tree(source))) {
    const out = path.join(target, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(path.join(source, file), out);
  }
}

function install(project = root, options = {}) {
  const strategy = options.strategy || 'auto';
  assert(['auto', 'symlink', 'copy'].includes(strategy), '链接策略只能是 auto、symlink、copy');
  const plan = buildPlan(project, options);
  const platform = options.platform || process.platform;
  const link = options.link || fs.symlinkSync;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  const backup = local(project, `docs/ai-delivery/backups/install-${stamp}`);
  const undo = [];
  const operations = [];
  const stateFile = local(project, statePath);
  const priorState = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
  const state = plan.state || { schemaVersion: 1, clients: [], entries: {}, documents: {} };
  try {
    for (const item of plan.entries) {
      const file = local(project, item.entry, true);
      if (item.action === 'update-copy') {
        const saved = path.join(backup, item.entry);
        copyTree(file, saved);
        undo.push(() => {
          fs.rmSync(file, { recursive: true, force: true });
          copyTree(saved, file);
        });
        fs.rmSync(file, { recursive: true });
        copyTree(local(project, item.source), file);
      } else if (item.action !== 'unchanged') {
        const oldLink = item.action === 'migrate' ? fs.readlinkSync(file) : null;
        undo.push(() => {
          const stat = fs.lstatSync(file, { throwIfNoEntry: false });
          if (stat) fs.rmSync(file, { recursive: !stat.isSymbolicLink(), force: true });
          if (oldLink) fs.symlinkSync(oldLink, file, 'dir');
        });
        if (oldLink) fs.unlinkSync(file);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        item.mode = strategy === 'copy' ? 'copy' : platform === 'win32' ? 'junction' : 'symlink';
        if (item.mode !== 'copy') {
          try {
            const target =
              item.mode === 'junction'
                ? local(project, item.source)
                : path.relative(path.dirname(file), local(project, item.source));
            link(target, file, item.mode === 'junction' ? 'junction' : 'dir');
          } catch (error) {
            if (strategy !== 'auto' || !['EPERM', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes(error.code)) throw error;
            item.mode = 'copy';
          }
        }
        if (item.mode === 'copy') copyTree(local(project, item.source), file);
      }
      state.entries[item.entry] = {
        source: item.source,
        version: item.version || null,
        mode: item.mode,
        files: item.files,
      };
      operations.push({ entry: item.entry, action: item.action, mode: item.mode });
    }
    for (const item of plan.documents) {
      const file = local(project, item.name);
      if (item.action !== 'unchanged') {
        if (item.previous !== null) {
          fs.mkdirSync(backup, { recursive: true });
          fs.writeFileSync(path.join(backup, item.name), item.previous);
        }
        undo.push(() =>
          item.previous === null ? fs.rmSync(file, { force: true }) : fs.writeFileSync(file, item.previous)
        );
        fs.writeFileSync(file, item.next);
      }
      state.documents[item.name] = item.blockHash;
    }
    state.clients = plan.clients;
    state.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    undo.push(() =>
      priorState === null ? fs.rmSync(stateFile, { force: true }) : fs.writeFileSync(stateFile, priorState)
    );
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
    return {
      ...verifyEntries(project, { clients: plan.clients }),
      operations,
      state: statePath,
      backup: fs.existsSync(backup) ? path.relative(project, backup).split(path.sep).join('/') : null,
    };
  } catch (error) {
    const failures = [];
    for (const restore of undo.reverse()) {
      try {
        restore();
      } catch (failure) {
        failures.push(failure.message);
      }
    }
    if (failures.length) error.message += `；恢复失败，保留备份：${failures.join('；')}`;
    throw error;
  }
}

function doctor(project = root, options = {}) {
  const problems = [];
  let sources, entries;
  try {
    sources = verifySources(project);
  } catch (error) {
    problems.push(error.message);
  }
  try {
    entries = verifyEntries(project, options);
  } catch (error) {
    problems.push(error.message);
  }
  const dependencies = ['@babel/parser', 'vue-template-compiler', 'parse5', 'js-yaml', 'eslint', 'prettier'].map(
    (name) => {
      try {
        createRequire(path.join(project, 'package.json')).resolve(name);
        return { name, available: true };
      } catch {
        return { name, available: false };
      }
    }
  );
  const nodeReady = Number(process.versions.node.split('.')[0]) >= 20;
  const globalConflicts = [];
  const home = options.home || os.homedir();
  for (const folder of [
    '.agents/skills',
    '.claude/skills',
    '.zcode/skills',
    '.cursor/skills',
    '.copilot/skills',
    '.codex/skills',
  ]) {
    for (const item of sources?.skills || []) {
      const file = path.join(home, folder, item.name, 'SKILL.md');
      if (fs.existsSync(file)) globalConflicts.push({ name: item.name, file, projectSource: item.source });
    }
  }
  return {
    node: process.versions.node,
    nodeReady,
    dependencies,
    clients: entries?.clients || options.clients || null,
    sourcesReady: Boolean(sources),
    skills: (sources?.skills || []).map(({ name, source, version }) => ({ name, source, version })),
    entriesReady: Boolean(entries),
    ready: nodeReady && dependencies.every((item) => item.available) && !problems.length,
    problems,
    globalConflicts,
    uiActivationVerified: false,
    note: '只读文件与依赖诊断；同名来源需核实，不自动修改个人配置，不证明客户端启用或模型执行。',
  };
}

function parseArgs(args) {
  const action = args.shift();
  assert(
    ['--install', '--check', '--dry-run', '--doctor'].includes(action),
    '需要 --install | --check | --dry-run | --doctor'
  );
  const options = {};
  let sourceOnly = false;
  while (args.length) {
    const flag = args.shift();
    if (flag === '--source-only') {
      assert(!sourceOnly, '重复 --source-only');
      sourceOnly = true;
    } else {
      assert(['--clients', '--strategy'].includes(flag), `未知参数：${flag}`);
      const key = flag.slice(2);
      assert(!options[key] && args[0] && !args[0].startsWith('--'), `需要唯一 ${flag} 参数`);
      const value = args.shift();
      options[key] = key === 'clients' ? value.split(',') : value;
    }
  }
  assert(
    !sourceOnly || (action === '--check' && !options.clients && !options.strategy),
    '--source-only 仅用于独立来源检查'
  );
  assert(!options.strategy || ['--install', '--dry-run'].includes(action), '--strategy 仅用于安装或预检');
  if (options.strategy) assert(['auto', 'symlink', 'copy'].includes(options.strategy), '无效链接策略');
  return { action, options, sourceOnly };
}

module.exports = {
  profiles,
  tree,
  readCatalog,
  verifySources,
  plannedEntries,
  generatedRules,
  verifyEntries,
  install,
  doctor,
  parseArgs,
};
if (require.main === module) {
  try {
    const { action, options, sourceOnly } = parseArgs(process.argv.slice(2));
    let result;
    if (sourceOnly) {
      const sources = verifySources();
      result = {
        ...sources,
        skills: sources.skills.map(({ files, ...item }) => ({ ...item, fileCount: Object.keys(files).length })),
        localEntriesChecked: false,
      };
    } else if (action === '--install') result = install(root, options);
    else if (action === '--check') result = verifyEntries(root, options);
    else if (action === '--doctor') result = doctor(root, options);
    else {
      const plan = buildPlan(root, options);
      result = {
        clients: plan.clients,
        entries: plan.entries.map(({ entry, source, version, mode, action }) => ({
          entry,
          source,
          version,
          mode,
          action,
        })),
        documents: plan.documents.map(({ name, action: change }) => ({ name, action: change })),
        readOnly: true,
      };
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (action === '--doctor' && !result.ready) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
