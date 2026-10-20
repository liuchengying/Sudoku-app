'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;
const { test } = require('node:test');
const { localFile, selectFiles, runCheck } = require('./check.cjs');
const { install, verifyEntries } = require('../scripts/install-entrypoints.cjs');
const root = path.resolve(__dirname, '../..');
const artifacts = path.join(root, 'docs/ai-delivery/evidence/adapter-tests');
fs.mkdirSync(artifacts, { recursive: true });

function fixture(t) {
  const folder = fs.mkdtempSync(path.join(artifacts, 'case-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const write = (name, text) => {
    const file = path.join(folder, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return name;
  };
  return { folder, write };
}

test('目录范围只选择实际变化，显式文件仍被检查，删除单独记录', (t) => {
  const { folder, write } = fixture(t);
  write('src/changed.js', 'module.exports = 1;\n');
  write('src/old.js', 'module.exports = 2;\n');
  const task = {
    scope: ['src', 'src/old.js'],
    baseline: { 'src/changed.js': 'a', 'src/old.js': 'b', 'src/gone.js': 'c' },
  };
  const result = selectFiles(folder, task, { files: { 'src/changed.js': 'd', 'src/old.js': 'b' } });
  assert.deepEqual(result.files, ['src/changed.js', 'src/old.js']);
  assert.deepEqual(result.deleted, ['src/gone.js']);
});

test('范围外变化不能被静默过滤', (t) => {
  const { folder, write } = fixture(t);
  write('src/a.js', '');
  assert.throws(
    () =>
      selectFiles(
        folder,
        { scope: ['src/a.js'], baseline: { 'src/a.js': 'a' } },
        { files: { 'src/a.js': 'a', 'src/b.js': 'b' } }
      ),
    /范围外变化/
  );
});

test('拒绝路径越界及链接输入', (t) => {
  const { folder, write } = fixture(t);
  write('source/file.js', '');
  fs.symlinkSync(path.join(folder, 'source'), path.join(folder, 'linked'), 'junction');
  for (const file of ['../file.js', '/tmp/file.js', 'src/../../file.js', '.git/config'])
    assert.throws(() => localFile(folder, file), /无效项目路径/);
  assert.throws(() => localFile(folder, 'linked/file.js'), /链接输入/);
});

function prepareEntries(write) {
  write('.ai-agent/RULES.md', '# Rules\n');
  write('.ai-agent/skills.json', fs.readFileSync(path.join(root, '.ai-agent/skills.json'), 'utf8'));
  write('ai/skills/ai-delivery/SKILL.md', '---\nname: ai-delivery\ndescription: Fixture\n---\n');
}

test('入口安装幂等，规则或链接漂移会被发现', (t) => {
  const { folder, write } = fixture(t);
  prepareEntries(write);
  const result = install(folder, { clients: ['codex', 'claude', 'zcode'] });
  assert.equal(result.entries.length, 3);
  assert.ok(install(folder).operations.every((item) => item.action === 'unchanged'));
  write('.ai-agent/RULES.md', '# Changed rules\n');
  assert.throws(() => verifyEntries(folder), /共同规则入口未同步/);
  install(folder);
  fs.unlinkSync(path.join(folder, '.zcode/skills/ai-delivery'));
  fs.mkdirSync(path.join(folder, 'elsewhere'));
  fs.symlinkSync(path.join(folder, 'elsewhere'), path.join(folder, '.zcode/skills/ai-delivery'), 'junction');
  assert.throws(() => verifyEntries(folder), /其他来源/);
});

test('任一入口冲突会在所有写入前停止', (t) => {
  const { folder, write } = fixture(t);
  prepareEntries(write);
  write('.claude/skills/ai-delivery/SKILL.md', 'User skill\n');
  assert.throws(() => install(folder, { clients: ['codex', 'claude'] }), /非管理副本/);
  assert.equal(fs.existsSync(path.join(folder, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(folder, '.agents')), false);
  assert.equal(fs.readFileSync(path.join(folder, '.claude/skills/ai-delivery/SKILL.md'), 'utf8'), 'User skill\n');
});

test('其他技能可共存，保留原目录及内容', (t) => {
  const { folder, write } = fixture(t);
  prepareEntries(write);
  write('.zcode/skills/figma-to-code/SKILL.md', 'User skill\n');
  install(folder, { clients: ['zcode'] });
  assert.equal(fs.existsSync(path.join(folder, 'AGENTS.md')), true);
  assert.equal(fs.readFileSync(path.join(folder, '.zcode/skills/figma-to-code/SKILL.md'), 'utf8'), 'User skill\n');
});

test('空行为测试失败，证据目录越界如实拒绝', async (t) => {
  const { folder, write } = fixture(t);
  write('notes.md', 'Notes\n');
  write('docs/tasks/example/task.json', JSON.stringify({ scope: ['notes.md'], baseline: { 'notes.md': 'a' } }));
  write('docs/tasks/example/evidence/run/input.json', JSON.stringify({ files: { 'notes.md': 'a' } }));
  const args = [folder, 'behavior-tests', 'docs/tasks/example', 'docs/tasks/example/evidence/run'];
  const result = await runCheck(...args);
  assert.equal(result.status, 'failed');
  assert.equal(result.commands.length, 0);
  assert.throws(() => localFile(folder, '../../report.json', true), /无效项目路径/);
  await assert.rejects(() => runCheck(folder, 'behavior-tests', args[2], 'docs/another-task'), /当前任务/);
});
