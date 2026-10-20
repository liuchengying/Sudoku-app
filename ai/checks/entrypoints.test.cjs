'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;
const { test } = require('node:test');
const { install, verifyEntries, verifySources, doctor, parseArgs } = require('../scripts/install-entrypoints.cjs');
const root = path.resolve(__dirname, '../..');
const artifacts = path.join(root, 'docs/ai-delivery/evidence/entrypoint-tests');
fs.mkdirSync(artifacts, { recursive: true });
function fixture(t) {
  const folder = fs.mkdtempSync(path.join(artifacts, 'case-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const write = (name, content) => {
    const file = path.join(folder, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
  };
  write('.ai-agent/RULES.md', '# Project rules\n');
  write(
    '.ai-agent/skills.json',
    JSON.stringify({
      schemaVersion: 1,
      active: [
        { name: 'ai-delivery', source: 'ai/skills/ai-delivery', version: '0.5.1' },
        { name: 'ce-front-development', source: 'ai/skills/ce-front-development', version: '1.1.0' },
      ],
    })
  );
  for (const name of ['ai-delivery', 'ce-front-development'])
    write(`ai/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: Fixture\n---\n`);
  return { folder, write };
}

test('共同目录服务多个客户端，只生成两项入口', (t) => {
  const { folder } = fixture(t);
  const result = install(folder, { clients: ['codex', 'cursor', 'copilot', 'windsurf'] });
  assert.equal(result.entries.length, 2);
  assert.equal(fs.existsSync(path.join(folder, '.claude')), false);
  assert.equal(fs.existsSync(path.join(folder, 'CLAUDE.md')), false);
  assert.equal(verifyEntries(folder).entries.length, 2);
});

test('保留自定义规则和其他技能，更新仅管理区块', (t) => {
  const { folder, write } = fixture(t);
  const original = '# Personal instructions\nDo not change this.\n';
  write('AGENTS.md', original);
  write('CLAUDE.md', '# Claude preferences\n');
  write('.claude/skills/another-skill/SKILL.md', 'Another skill\n');
  install(folder, { clients: ['claude'], strategy: 'copy' });
  fs.appendFileSync(path.join(folder, 'AGENTS.md'), '\nUser suffix\n');
  write('.ai-agent/RULES.md', '# Updated project rules\n');
  install(folder);
  const text = fs.readFileSync(path.join(folder, 'AGENTS.md'), 'utf8');
  assert.ok(text.startsWith(original));
  assert.ok(text.endsWith('\nUser suffix\n'));
  assert.match(text, /Updated project rules/);
  assert.equal(fs.readFileSync(path.join(folder, '.claude/skills/another-skill/SKILL.md'), 'utf8'), 'Another skill\n');
});

test('管理区块被手改或标记损坏时，预检拒绝全部写入', (t) => {
  const { folder, write } = fixture(t);
  install(folder);
  const before = fs.readFileSync(path.join(folder, 'docs/ai-delivery/local/entrypoints.json'), 'utf8');
  const file = path.join(folder, 'AGENTS.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Project rules', 'Hand edited'));
  assert.throws(() => install(folder, { clients: ['claude'] }), /被修改的管理区块/);
  assert.equal(fs.existsSync(path.join(folder, '.claude')), false);
  assert.equal(fs.readFileSync(path.join(folder, 'docs/ai-delivery/local/entrypoints.json'), 'utf8'), before);
  write('AGENTS.md', '<!-- sudoku:rules:begin -->\nBroken\n');
  assert.throws(() => install(folder), /标记不完整/);
});

test('管理副本随源更新，额外文件或用户修改阻止覆盖', (t) => {
  const { folder, write } = fixture(t);
  install(folder, { clients: ['claude'], strategy: 'copy' });
  const source = 'ai/skills/ce-front-development/references/rules.md';
  write(source, 'New rules\n');
  assert.throws(() => verifyEntries(folder), /未同步维护源/);
  const result = install(folder);
  assert.ok(result.operations.some((item) => item.action === 'update-copy'));
  assert.equal(
    fs.readFileSync(path.join(folder, '.claude/skills/ce-front-development/references/rules.md'), 'utf8'),
    'New rules\n'
  );
  write('.claude/skills/ce-front-development/own.md', 'User file\n');
  assert.throws(() => install(folder), /被修改的技能副本/);
  assert.equal(fs.readFileSync(path.join(folder, '.claude/skills/ce-front-development/own.md'), 'utf8'), 'User file\n');
});

test('自动策略遇到链接权限问题回退副本，显式链接策略停止', (t) => {
  const { folder } = fixture(t);
  const denied = () => {
    const error = new Error('No privilege');
    error.code = 'EPERM';
    throw error;
  };
  const result = install(folder, { clients: ['claude'], link: denied });
  assert.ok(result.entries.every((item) => item.mode === 'copy'));
  const second = fixture(t);
  assert.throws(() => install(second.folder, { strategy: 'symlink', link: denied }), /No privilege/);
  assert.equal(fs.existsSync(path.join(second.folder, 'AGENTS.md')), false);
});

test('Windows 策略使用绝对目录 junction（策略模拟，不代表实机验证）', (t) => {
  const { folder } = fixture(t);
  const calls = [];
  const result = install(folder, {
    platform: 'win32',
    link: (target, file, type) => {
      calls.push({ target, type });
      fs.symlinkSync(target, file, type);
    },
  });
  assert.ok(calls.every((call) => path.isAbsolute(call.target) && call.type === 'junction'));
  assert.ok(result.entries.every((item) => item.mode === 'junction'));
  verifyEntries(folder);
});

test('写入中断恢复已创建入口，保留非管理内容', (t) => {
  const { folder, write } = fixture(t);
  write('.agents/skills/other/SKILL.md', 'Keep me\n');
  let count = 0;
  assert.throws(
    () =>
      install(folder, {
        link: (target, file, type) => {
          if (++count === 2) throw new Error('Injected IO failure');
          fs.symlinkSync(target, file, type);
        },
      }),
    /Injected IO failure/
  );
  assert.equal(fs.existsSync(path.join(folder, '.agents/skills/ai-delivery')), false);
  assert.equal(fs.existsSync(path.join(folder, 'AGENTS.md')), false);
  assert.equal(fs.readFileSync(path.join(folder, '.agents/skills/other/SKILL.md'), 'utf8'), 'Keep me\n');
});

test('独立来源检查无需客户端入口，固定包漂移会失败', (t) => {
  const { folder, write } = fixture(t);
  assert.equal(verifySources(folder).skillCount, 2);
  assert.equal(fs.existsSync(path.join(folder, '.agents')), false);
  write('.ai-agent/skill-sources.json', JSON.stringify({ name: 'ai-delivery', files: { 'SKILL.md': 'bad-hash' } }));
  assert.throws(() => verifySources(folder), /固定公共包已变化/);
});

test('只读诊断报告全局同名，不修改其内容', (t) => {
  const { folder, write } = fixture(t);
  install(folder);
  const personal = write('personal/.claude/skills/ai-delivery/SKILL.md', 'Global skill\n');
  const before = fs.readFileSync(personal, 'utf8');
  const state = fs.readFileSync(path.join(folder, 'docs/ai-delivery/local/entrypoints.json'), 'utf8');
  const report = doctor(folder, { home: path.join(folder, 'personal') });
  assert.equal(report.globalConflicts.length, 1);
  assert.equal(report.uiActivationVerified, false);
  assert.equal(fs.readFileSync(personal, 'utf8'), before);
  assert.equal(fs.readFileSync(path.join(folder, 'docs/ai-delivery/local/entrypoints.json'), 'utf8'), state);
});

test('拒绝异常客户端及来源检查混用参数', (t) => {
  const { folder } = fixture(t);
  assert.throws(() => install(folder, { clients: ['constructor'] }), /客户端必须来自/);
  assert.throws(() => parseArgs(['--check', '--source-only', '--clients', 'codex']), /独立来源检查/);
  assert.throws(() => parseArgs(['--install', '--strategy', 'bad']), /无效链接策略/);
});
