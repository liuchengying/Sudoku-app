#!/usr/bin/env node
'use strict';

// Generic check report wrapper. The risk-evidence gate (ai/checks/acceptance.cjs
// checkGate) requires one {check}.json report per registered check inside the run's
// evidence directory, in the { mode, status, commands } shape covered by
// acceptance.test.cjs. This wrapper runs the real command, appends its outcome to
// that report and mirrors the command's exit code, so external checks (typecheck,
// unit, puzzles, ui) can satisfy the gate without changing what is actually run.
//
// Usage: node ai/checks/report.cjs <check> <evidenceDir> -- <executable> [args...]
// Multiple wrapped commands of the same check append to the same report.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');

async function main() {
  const [check, evidenceDir, ...rest] = process.argv.slice(2);
  if (!check || !evidenceDir || rest[0] !== '--' || rest.length < 2) {
    throw new Error('用法：report.cjs <check> <evidenceDir> -- <executable> [args...]');
  }
  // The engine passes the run's evidence directory as a relative path; only refuse
  // absolute paths or traversal, mirroring localFile's own guards.
  if (!/^[\w-]+$/.test(check) || path.isAbsolute(evidenceDir) || evidenceDir.includes('\\') || evidenceDir.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('报告参数无效');
  }
  const [executable, ...args] = rest.slice(1);
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 240000,
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
    env: { ...process.env, NO_COLOR: '1', CI: '1' },
  });
  const entry = {
    executable: path.basename(executable),
    args,
    exitCode: result.status,
    passed: result.status === 0 && !result.error,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error?.message || null,
  };
  const reportFile = path.join(evidenceDir, `${check}.json`);
  let commands = [];
  if (fs.existsSync(reportFile)) {
    try {
      commands = JSON.parse(fs.readFileSync(reportFile, 'utf8')).commands || [];
    } catch {
      // A previous wrapped command of this run should have written valid JSON.
    }
  }
  commands.push(entry);
  const report = { mode: check, status: commands.every((command) => command.passed) ? 'passed' : 'failed', commands };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  process.exitCode = entry.passed ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
