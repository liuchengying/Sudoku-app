'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { localFile } = require('./check.cjs');
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const nonempty = (value) => typeof value === 'string' && Boolean(value.trim());
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const matches = (file, prefix) => file === prefix || file.startsWith(prefix + '/');
const read = (project, file) => JSON.parse(fs.readFileSync(localFile(project, file), 'utf8'));
const unique = (values, allowed, label) => {
  assert(
    Array.isArray(values) && new Set(values).size === values.length && values.every((value) => allowed.includes(value)),
    `${label}无效或重复`
  );
};

function policyOf(project) {
  const policy = read(project, '.ai-agent/acceptance-policy.json');
  const profile = read(project, '.ai-agent/project.json');
  assert(policy.schemaVersion === 1 && policy.riskChecks && Array.isArray(policy.sharedPaths), '风险验收政策无效');
  unique(policy.evidenceTypes, ['static', 'logic', 'render', 'business'], '证据类型政策');
  unique(policy.logicChecks, profile.checks, '逻辑检查政策');
  for (const checks of Object.values(policy.riskChecks)) unique(checks, profile.checks, '风险检查政策');
  if (policy.sharedCheck !== undefined)
    assert(
      typeof policy.sharedCheck === 'string' && profile.checks.includes(policy.sharedCheck),
      '公共变化的快照检查未在项目检查中注册'
    );
  policy.sharedPaths.forEach((file) => localFile(project, file, true));
  return { policy, profile };
}

function validateDefinition(project, task) {
  const { policy, profile } = policyOf(project);
  assert(Array.isArray(task.criteria) && task.criteria.length, '缺少验收条件');
  const required = new Set();
  const criteria = task.criteria.map((criterion) => {
    unique(criterion.evidenceTypes, policy.evidenceTypes, `${criterion.id}证据类型`);
    assert(criterion.evidenceTypes.length, `${criterion.id}必须声明需要的证据类型`);
    unique(criterion.risks, Object.keys(policy.riskChecks), `${criterion.id}风险`);
    const checks = [
      ...new Set([...(criterion.checks || []), ...criterion.risks.flatMap((risk) => policy.riskChecks[risk])]),
    ];
    unique(checks, profile.checks, `${criterion.id}检查`);
    assert(!checks.includes('risk-evidence'), '风险门槛不能把自身作为条件检查');
    const logicChecks = checks.filter((check) => policy.logicChecks.includes(check));
    if (criterion.evidenceTypes.includes('logic'))
      assert(logicChecks.length, `${criterion.id}逻辑证据需要已注册的逻辑检查`);
    if (criterion.risks.some((risk) => risk !== 'shared-contract'))
      assert(criterion.evidenceTypes.includes('logic'), `${criterion.id}风险需要逻辑证据`);
    checks.forEach((check) => required.add(check));
    const testFiles = criterion.testFiles || [];
    if (checks.includes('behavior-tests')) {
      assert(
        Array.isArray(testFiles) && testFiles.length && new Set(testFiles).size === testFiles.length,
        `${criterion.id}风险需要明确行为测试文件`
      );
      for (const file of testFiles) {
        localFile(project, file, true);
        assert(
          /\.test\.(?:js|cjs|mjs)$/.test(file) && task.scope.some((prefix) => matches(file, prefix)),
          `${criterion.id}测试文件不在任务范围内`
        );
      }
    }
    return {
      id: criterion.id,
      evidenceTypes: criterion.evidenceTypes,
      risks: criterion.risks,
      checks,
      testFiles,
      impact: criterion.impact,
    };
  });
  return { criteria, requiredChecks: [...required], policy, profile };
}

function checkReport(project, file, check, requireCommand = true) {
  const report = read(project, file);
  assert(
    report.mode === check &&
      report.status === 'passed' &&
      Array.isArray(report.commands) &&
      (!requireCommand || report.commands.length) &&
      report.commands.every((command) => command.passed === true && command.exitCode === 0),
    `${check}缺少真实通过的命令报告`
  );
  if (['behavior-tests', 'adapter-tests'].includes(check)) {
    assert(
      report.commands.some(
        (command) => /# tests [1-9]\d*/.test(command.stdout) && /# pass [1-9]\d*/.test(command.stdout)
      ),
      `${check}没有实际通过的测试`
    );
  }
  return report;
}

function checkGate(project, task, input, evidenceDir) {
  const definition = validateDefinition(project, task);
  assert(
    definition.requiredChecks.every((check) => task.checks.includes(check)),
    '任务遗漏风险所需检查；使用项目交付入口调整定义'
  );
  const checked = new Map();
  for (const check of definition.requiredChecks) {
    const report = checkReport(
      project,
      `${evidenceDir}/${check}.json`,
      check,
      definition.policy.logicChecks.includes(check)
    );
    checked.set(check, report);
  }
  for (const criterion of definition.criteria) {
    if (criterion.checks.includes('behavior-tests')) {
      const report = checked.get('behavior-tests');
      assert(
        criterion.testFiles.every(
          (file) => report.files.includes(file) && report.commands.some((command) => command.args.includes(file))
        ),
        `${criterion.id}要求的测试未实际执行`
      );
    }
  }
  const sharedChanges = [...new Set([...Object.keys(task.baseline), ...Object.keys(input.files)])].filter(
    (file) =>
      task.baseline[file] !== input.files[file] && definition.policy.sharedPaths.some((prefix) => matches(file, prefix))
  );
  const sharedCheck = definition.policy.sharedCheck ?? 'frontend-tools';
  const impacts = [];
  if (sharedChanges.length) {
    const criteria = definition.criteria.filter((criterion) => criterion.risks.includes('shared-contract'));
    assert(
      criteria.length && task.checks.includes(sharedCheck),
      `公共变化需要 shared-contract 风险、快照检查（${sharedCheck}）和影响记录`
    );
    for (const criterion of criteria) {
      const impact = criterion.impact;
      assert(
        impact &&
          Array.isArray(impact.paths) &&
          nonempty(impact.note) &&
          (impact.paths.length || nonempty(impact.reason)),
        `${criterion.id}缺少调用方影响说明`
      );
      impact.paths.forEach((file) => localFile(project, file));
      assert(impact.note.startsWith(`docs/tasks/${task.id}/`), '影响记录必须位于当前任务 docs');
      const file = localFile(project, impact.note);
      assert(nonempty(fs.readFileSync(file, 'utf8')), '影响记录不能为空');
      impacts.push({ criterion: criterion.id, note: impact.note, sha256: sha(file), paths: impact.paths });
    }
  }
  return {
    mode: 'risk-evidence',
    status: 'passed',
    criteria: definition.criteria,
    requiredChecks: definition.requiredChecks,
    sharedChanges,
    impacts,
    note: '核对已声明风险和实际脚本结果；业务风险分类及测试断言仍需源码复核，页面观察在复核入口核对。',
  };
}

function observation(project, file, kind) {
  const document = read(project, file);
  assert(
    document.kind === kind &&
      document.status === 'passed' &&
      nonempty(document.observedAt) &&
      Number.isFinite(Date.parse(document.observedAt)) &&
      nonempty(document.method) &&
      nonempty(document.result) &&
      nonempty(document.authorization),
    `${kind}需要明确的实际观察记录及授权来源`
  );
  assert(document.context && nonempty(document.context.environment), '观察记录缺少环境');
  if (kind === 'render')
    assert(
      nonempty(document.context.viewport) && nonempty(document.context.theme) && nonempty(document.context.data),
      '渲染记录缺少视口、主题或数据状态'
    );
  if (kind === 'business')
    assert(
      nonempty(document.context.steps) && nonempty(document.context.expected) && nonempty(document.context.actual),
      '业务记录缺少步骤、预期或实际结果'
    );
  assert(Array.isArray(document.artifacts) && document.artifacts.length, '观察记录需要可核对的原始资料');
  for (const artifact of document.artifacts) {
    assert(typeof artifact.path === 'string' && artifact.path.startsWith('docs/'), '原始观察资料必须位于 docs');
    const source = localFile(project, artifact.path);
    assert(/^[a-f0-9]{64}$/.test(artifact.sha256) && sha(source) === artifact.sha256, '原始观察资料缺失或已变化');
  }
  if (kind === 'render')
    assert(
      document.artifacts.some((item) => /\.(?:png|jpe?g|webp)$/i.test(item.path)),
      '渲染证据需要实际截图'
    );
}

function validateReview(project, task, review) {
  const definition = validateDefinition(project, task);
  assert(task.verification?.passed && /^[a-zA-Z0-9._-]+$/.test(task.verification.id), '需要本轮通过的检查');
  const directory = `docs/tasks/${task.id}/evidence/${task.verification.id}`;
  const gate = read(project, `${directory}/risk-evidence.json`);
  assert(gate.status === 'passed' && gate.mode === 'risk-evidence', '本轮缺少风险证据检查');
  assert(
    Array.isArray(review.criteria) &&
      review.criteria.length === definition.criteria.length &&
      new Set(review.criteria.map((criterion) => criterion.id)).size === definition.criteria.length,
    '必须复核全部验收条件'
  );
  for (const criterion of definition.criteria) {
    const item = review.criteria.find((record) => record.id === criterion.id);
    assert(
      item?.result === 'passed' &&
        Array.isArray(item.evidence) &&
        item.evidence.length &&
        item.evidenceKinds &&
        equalPaths(item.evidence, Object.keys(item.evidenceKinds)),
      `${criterion.id}需要逐文件声明证据类型`
    );
    const kinds = new Set();
    for (const file of item.evidence) {
      assert(typeof file === 'string' && file.startsWith('docs/'), '复核证据必须位于 docs');
      localFile(project, file);
      const kind = item.evidenceKinds[file];
      assert(definition.policy.evidenceTypes.includes(kind), '无效复核证据类型');
      kinds.add(kind);
      if (kind === 'logic') {
        const check = path.posix.basename(file, '.json');
        assert(
          criterion.checks.includes(check) &&
            definition.policy.logicChecks.includes(check) &&
            file === `${directory}/${check}.json`,
          `${criterion.id}不能用静态或历史报告充当逻辑证据`
        );
        checkReport(project, file, check);
      } else if (kind === 'render' || kind === 'business') observation(project, file, kind);
    }
    assert(
      criterion.evidenceTypes.every((kind) => kinds.has(kind)),
      `${criterion.id}缺少所需证据类型`
    );
    for (const impact of gate.impacts || []) {
      if (impact.criterion !== criterion.id) continue;
      assert(
        item.evidence.includes(impact.note) && sha(localFile(project, impact.note)) === impact.sha256,
        '调用方影响记录未复核或已变化'
      );
    }
  }
  return { passed: true, criteria: definition.criteria.length };
}

function equalPaths(first, second) {
  return (
    new Set(first).size === first.length && JSON.stringify([...first].sort()) === JSON.stringify([...second].sort())
  );
}

module.exports = { policyOf, validateDefinition, checkGate, validateReview };
