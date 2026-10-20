'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert').strict;
const { test } = require('node:test');
const { validateDefinition, checkGate, validateReview } = require('./acceptance.cjs');
const { run } = require('../scripts/delivery.cjs');
const root = path.resolve(__dirname, '../..');
const artifacts = path.join(root, 'docs/ai-delivery/evidence/acceptance-tests');
fs.mkdirSync(artifacts, { recursive: true });
const digest = (data) => crypto.createHash('sha256').update(data).digest('hex');
function fixture(t) {
  const folder = fs.mkdtempSync(path.join(artifacts, 'case-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const write = (name, data) => {
    const file = path.join(folder, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
    return file;
  };
  // 独立于真实项目政策：fixture 自己维护一份同构政策，保证引擎测试不随项目配置漂移。
  const policy = {
    schemaVersion: 1,
    evidenceTypes: ['static', 'logic', 'render', 'business'],
    logicChecks: ['behavior-tests'],
    riskChecks: { money: ['behavior-tests'], 'shared-contract': ['frontend-tools'] },
    sharedPaths: ['src/common/components'],
  };
  const checks = [
    'adapter',
    'adapter-tests',
    'frontend-tools',
    'lint',
    'format',
    'contracts',
    'behavior-tests',
    'risk-evidence',
  ];
  const profile = {
    schemaVersion: 2,
    timezone: 'Asia/Shanghai',
    maxRepairRounds: 3,
    checkTimeoutMs: 30000,
    watch: ['src', 'ai', '.ai-agent'],
    exclude: [],
    checks,
    commands: Object.fromEntries(
      checks.map((check) => [
        check,
        [
          {
            executable: 'node',
            args: ['ai/check-run.cjs', check, '{taskDir}', '{evidenceDir}'],
            outputs: [`{evidenceDir}/${check}.json`],
          },
        ],
      ])
    ),
    checkPolicy: { always: ['risk-evidence'], rules: [] },
    ruleFiles: ['.ai-agent/RULES.md'],
  };
  write('.ai-agent/project.json', profile);
  write('.ai-agent/acceptance-policy.json', policy);
  write('.ai-agent/RULES.md', '# Fixture rules\n');
  write('src/amount.test.cjs', 'Fixture test source\n');
  const task = {
    id: 'fixture',
    scope: ['src'],
    checks: ['behavior-tests', 'risk-evidence'],
    baseline: {},
    criteria: [
      {
        id: 'amount',
        description: '金额行为',
        evidenceTypes: ['logic'],
        risks: ['money'],
        testFiles: ['src/amount.test.cjs'],
      },
    ],
    verification: { passed: true, id: 'run' },
  };
  const directory = 'docs/tasks/fixture/evidence/run';
  const report = (check, changes = {}) =>
    write(`${directory}/${check}.json`, {
      mode: check,
      status: 'passed',
      files: ['src/amount.test.cjs'],
      commands: [
        { passed: true, exitCode: 0, args: ['--test', 'src/amount.test.cjs'], stdout: '# tests 1\n# pass 1\n' },
      ],
      ...changes,
    });
  report('behavior-tests');
  write(`${directory}/risk-evidence.json`, { mode: 'risk-evidence', status: 'passed', impacts: [] });
  const file = `${directory}/behavior-tests.json`;
  const review = {
    reviewer: 'Fixture review',
    summary: 'Fixture',
    findings: [],
    criteria: [{ id: 'amount', result: 'passed', evidence: [file], evidenceKinds: { [file]: 'logic' } }],
  };
  return { folder, write, task, directory, report, review };
}

test('风险声明要求逻辑证据和范围内的明确测试文件', (t) => {
  const { folder, task } = fixture(t);
  assert.deepEqual(validateDefinition(folder, task).requiredChecks, ['behavior-tests']);
  task.criteria[0].testFiles = [];
  assert.throws(() => validateDefinition(folder, task), /明确行为测试文件/);
  task.criteria[0].testFiles = ['outside.test.cjs'];
  assert.throws(() => validateDefinition(folder, task), /不在任务范围/);
  task.criteria[0].evidenceTypes = ['static'];
  assert.throws(() => validateDefinition(folder, task), /风险需要逻辑证据/);
});

test('遗漏风险检查、零测试和失败命令不能通过', (t) => {
  const { folder, task, directory, report } = fixture(t);
  task.checks = ['risk-evidence'];
  assert.throws(() => checkGate(folder, task, { files: {} }, directory), /遗漏风险/);
  task.checks.push('behavior-tests');
  report('behavior-tests', { commands: [{ passed: true, exitCode: 0, stdout: '# tests 0\n# pass 0\n', args: [] }] });
  assert.throws(() => checkGate(folder, task, { files: {} }, directory), /没有实际通过的测试/);
  report('behavior-tests', { commands: [{ passed: false, exitCode: 1 }] });
  assert.throws(() => checkGate(folder, task, { files: {} }, directory), /缺少真实通过/);
});

test('声明的测试必须出现在本轮实际命令中', (t) => {
  const { folder, task, directory, report } = fixture(t);
  report('behavior-tests', { files: [] });
  assert.throws(() => checkGate(folder, task, { files: {} }, directory), /未实际执行/);
});

test('静态或历史报告不能充当逻辑通过证据', (t) => {
  const { folder, write, task, review } = fixture(t);
  validateReview(folder, task, review);
  const file = review.criteria[0].evidence[0];
  review.criteria[0].evidenceKinds[file] = 'static';
  assert.throws(() => validateReview(folder, task, review), /缺少所需证据类型/);
  write('docs/tasks/fixture/evidence/old/behavior-tests.json', {});
  review.criteria[0].evidence = ['docs/tasks/fixture/evidence/old/behavior-tests.json'];
  review.criteria[0].evidenceKinds = { [review.criteria[0].evidence[0]]: 'logic' };
  assert.throws(() => validateReview(folder, task, review), /静态或历史报告/);
});

test('页面观察需要原始资料，资料漂移会阻止复核', (t) => {
  const { folder, write, task, review } = fixture(t);
  task.criteria = [{ id: 'view', evidenceTypes: ['render'], risks: [] }];
  const file = 'docs/tasks/fixture/observation.json';
  const image = 'docs/tasks/fixture/fixture.png';
  write(image, 'Test artifact; not a real screenshot');
  const observation = {
    kind: 'render',
    status: 'passed',
    observedAt: new Date().toISOString(),
    method: 'Fixture observation',
    authorization: 'Fixture only',
    result: 'Fixture expected state',
    context: { environment: 'Fixture', viewport: '1280x800', theme: 'default', data: 'empty' },
    artifacts: [{ path: image, sha256: digest(fs.readFileSync(path.join(folder, image))) }],
  };
  write(file, observation);
  review.criteria = [{ id: 'view', result: 'passed', evidence: [file], evidenceKinds: { [file]: 'render' } }];
  validateReview(folder, task, review);
  write(image, 'Changed fixture artifact');
  assert.throws(() => validateReview(folder, task, review), /原始观察资料缺失或已变化/);
  observation.status = 'not-verified';
  write(file, observation);
  assert.throws(() => validateReview(folder, task, review), /实际观察记录/);
});

test('公共源码变化必须有调用方影响说明及快照检查', (t) => {
  const { folder, write, task, directory, report } = fixture(t);
  write('src/common/components/shared.vue', '<template><div /></template>\n');
  const input = { files: { 'src/common/components/shared.vue': 'changed' } };
  assert.throws(() => checkGate(folder, task, input, directory), /公共变化需要/);
  task.criteria.push({ id: 'shared', evidenceTypes: ['static'], risks: ['shared-contract'] });
  task.checks.push('frontend-tools');
  report('frontend-tools');
  assert.throws(() => checkGate(folder, task, input, directory), /缺少调用方影响说明/);
  task.criteria[1].impact = { paths: [], reason: 'Fixture has no callers', note: 'docs/tasks/fixture/impact.md' };
  write(task.criteria[1].impact.note, '# No fixture callers\n');
  const gate = checkGate(folder, task, input, directory);
  assert.equal(gate.impacts.length, 1);
  assert.equal(gate.sharedChanges.length, 1);
});

test('项目入口自动追加风险检查，真实 Node 测试后才能完成交付', async (t) => {
  const { folder, write } = fixture(t);
  fs.cpSync(path.join(root, 'ai/skills/ai-delivery'), path.join(folder, 'ai/skills/ai-delivery'), { recursive: true });
  write(
    'ai/check-run.cjs',
    `const {runCheck}=require(${JSON.stringify(
      path.join(root, 'ai/checks/check.cjs')
    )}); runCheck(process.cwd(),...process.argv.slice(2)).then(r=>{console.log(JSON.stringify(r));process.exitCode=r.status==='failed'?1:0}).catch(e=>{console.error(e.message);process.exitCode=1});\n`
  );
  write('src/amount.cjs', 'module.exports = (items) => items.reduce((sum, cents) => sum + cents, 0);\n');
  write(
    'src/amount.test.cjs',
    "const {test}=require('node:test');const assert=require('assert').strict;const total=require('./amount.cjs');test('整数分保持零值和负数',()=>{assert.equal(total([101,202]),303);assert.equal(total([]),0);assert.equal(total([100,-100]),0)});\n"
  );
  const spec = {
    id: 'integrated',
    title: 'Fixture delivery',
    request: 'Fixture only',
    scope: ['src'],
    plan: 'Create an isolated cents calculation fixture, run actual Node tests through the project adapter, then verify that typed review rejects a static claim and permits real logical evidence without starting an application.',
    criteria: [
      {
        id: 'amount',
        description: 'Fixture cents totals',
        evidenceTypes: ['logic'],
        risks: ['money'],
        testFiles: ['src/amount.test.cjs'],
      },
    ],
    manualChecks: ['Fixture only; no browser'],
  };
  write('docs/intake/integrated.json', spec);
  const begun = await run(['begin', '--spec', 'docs/intake/integrated.json'], folder);
  assert.equal(JSON.parse(begun.output).stage, 'executing');
  const verified = await run(['verify', spec.id], folder);
  const task = JSON.parse(fs.readFileSync(path.join(folder, 'docs/tasks/integrated/task.json'), 'utf8'));
  const logs = task.verification.checks
    .map((check) => fs.readFileSync(path.join(folder, check.log), 'utf8'))
    .join('\n');
  assert.equal(verified.exitCode, 0, verified.output + logs);
  assert.ok(task.checks.includes('behavior-tests'));
  const file = `docs/tasks/integrated/evidence/${task.verification.id}/behavior-tests.json`;
  const review = {
    reviewer: 'Fixture only',
    summary: 'Actual Node test',
    findings: [],
    criteria: [{ id: 'amount', result: 'passed', evidence: [file], evidenceKinds: { [file]: 'static' } }],
  };
  write('docs/tasks/integrated/review-input.json', review);
  await assert.rejects(
    () => run(['finish', spec.id, '--file', 'docs/tasks/integrated/review-input.json'], folder),
    /缺少所需证据类型/
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(folder, 'docs/tasks/integrated/task.json'), 'utf8')).status,
    'verified'
  );
  review.criteria[0].evidenceKinds[file] = 'logic';
  write('docs/tasks/integrated/review-input.json', review);
  const completed = await run(['finish', spec.id, '--file', 'docs/tasks/integrated/review-input.json'], folder);
  assert.equal(JSON.parse(completed.output).stage, 'awaiting_owner');
});

test('本项目真实风险政策与项目配置一致', (t) => {
  const { policyOf } = require('./acceptance.cjs');
  const { policy, profile } = policyOf(root);
  assert.ok(policy.riskChecks['shared-contract'].every((check) => profile.checks.includes(check)));
  assert.ok(profile.checks.includes(policy.sharedCheck));
  assert.ok(policy.logicChecks.every((check) => profile.checks.includes(check)));
});
