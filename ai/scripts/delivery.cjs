#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { validateDefinition, validateReview } = require('../checks/acceptance.cjs');
const root = path.resolve(__dirname, '../..');
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};

async function run(argv = process.argv.slice(2), project = root) {
  const engineRoot = path.join(project, 'ai/skills/ai-delivery/scripts');
  const { runCLI } = await import(pathToFileURL(path.join(engineRoot, 'ai-delivery.mjs')));
  const [command = 'help', first, ...rest] = argv;
  if (['help', '--help', '-h'].includes(command)) {
    return {
      output:
        'sudoku-uniapp 项目交付入口（固定公共引擎 + 项目风险证据门槛）\n不需要 --project，目标为本脚本所在项目。\n' +
        runCLI(['help']).output,
      exitCode: 0,
    };
  }
  assert(!argv.includes('--project') && !argv.includes('--config'), '项目入口不接受切换项目或配置，避免误用全局来源');
  const intercepted = ['new', 'begin', 'amend', 'review', 'finish', 'deliver', 'decision'];
  if (!intercepted.includes(command)) return runCLI(['--project', project, ...argv]);
  const { createWorkflow, safePath, withLock } = await import(pathToFileURL(path.join(engineRoot, 'workflow.mjs')));
  const { selectChecks } = await import(pathToFileURL(path.join(engineRoot, 'policy.mjs')));
  const profile = JSON.parse(fs.readFileSync(safePath(project, '.ai-agent/project.json', true), 'utf8'));
  const workflow = createWorkflow(project, profile);
  const read = (file) => JSON.parse(fs.readFileSync(safePath(project, file, true), 'utf8'));
  const option = (args, flag) => {
    assert(args.length === 2 && args[0] === flag && args[1], `需要 ${flag}，不接受额外参数`);
    return args[1];
  };
  const prepare = (spec, existing = []) => {
    const definition = validateDefinition(project, spec);
    const selected = selectChecks(profile, spec.scope, spec.checks).checks;
    return {
      ...spec,
      scope: [...new Set([...spec.scope, ...definition.criteria.flatMap((criterion) => criterion.testFiles)])],
      checks: profile.checks.filter(
        (check) => selected.includes(check) || existing.includes(check) || definition.requiredChecks.includes(check)
      ),
    };
  };
  return withLock(
    project,
    () => {
      let task;
      if (command === 'new' || command === 'begin') {
        const spec = prepare(read(option([first, ...rest], '--spec')));
        task = command === 'new' ? workflow.create(spec) : workflow.begin(spec);
      } else if (command === 'amend') {
        assert(
          first && rest.length === 4 && rest[0] === '--spec' && rest[2] === '--reason',
          '需要 amend ID --spec 文件 --reason 原因'
        );
        task = workflow.amend(first, prepare(read(rest[1]), workflow.load(first).checks), rest[3]);
      } else if (command === 'review' || command === 'finish') {
        assert(first, '需要任务 ID');
        const file = option(rest, '--file');
        task = workflow.load(first);
        validateReview(project, task, read(file));
        task = workflow[command](first, file);
      } else if (command === 'deliver') {
        assert(first && !rest.length, '需要任务 ID，不接受额外参数');
        task = workflow.load(first);
        assert(task.review, '需要已复核材料');
        validateReview(project, task, read(task.review.file));
        task = workflow.deliver(first);
      } else {
        assert(first, '需要任务 ID');
        const file = option(rest, '--file');
        const decision = read(file);
        task = workflow.load(first);
        if (decision.decision === 'accept' && task.criteria.some((criterion) => criterion.evidenceTypes)) {
          assert(task.review, '需要已复核材料');
          validateReview(project, task, read(task.review.file));
        }
        task = workflow.decision(first, file);
      }
      return { output: JSON.stringify(workflow.receipt(task), null, 2) + '\n', exitCode: 0 };
    },
    workflow.runtimeDir
  );
}

module.exports = { run };
if (require.main === module)
  run()
    .then((result) => {
      process.stdout.write(result.output);
      process.exitCode = result.exitCode;
    })
    .catch((error) => {
      process.stderr.write(`交付停止：${error.message}\n`);
      process.exitCode = 1;
    });
