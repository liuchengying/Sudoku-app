import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
const profile = readJson('docs/ai-delivery/project.json')
const pkg = readJson('package.json')
const matches = (file, prefix) => file === prefix || file.startsWith(prefix + '/')

assert(Number(process.versions.node.split('.')[0]) >= 20, 'ai-delivery requires Node >= 20')
assert.equal(profile.schemaVersion, 2)
assert.equal(profile.name, pkg.name)
assert.equal(profile.timezone, 'Asia/Shanghai')
assert.deepEqual(profile.checks, ['adapter', 'typecheck', 'unit', 'puzzles', 'ui'])
assert.equal(new Set(profile.watch).size, profile.watch.length, 'watch contains duplicate paths')

function relativePath(value) {
  assert(typeof value === 'string' && !path.isAbsolute(value) && !value.includes('\\'), `Invalid path: ${value}`)
  assert(value.split('/').every(segment => segment && segment !== '.' && segment !== '..'), `Invalid path: ${value}`)
}
function tracked(relative) {
  return profile.watch.some(prefix => matches(relative, prefix))
    && !profile.exclude.some(prefix => matches(relative, prefix))
}

// These scripts were inspected before registration. Fail if npm aliases drift
// so the adapter cannot silently keep checking an obsolete subset of the project.
const expectedScripts = {
  typecheck: 'vue-tsc --noEmit',
  test: 'vitest run --config docs/validation/vitest.config.ts',
  'puzzle:validate': 'node tools/validate-puzzles.mjs && node docs/validation/calibrate-puzzles.cjs',
  'ui:validate': 'node docs/validation/validate-ui.cjs',
  check: 'npm run typecheck && npm test && npm run puzzle:validate && npm run ui:validate'
}
for (const [name, command] of Object.entries(expectedScripts)) {
  assert.equal(pkg.scripts[name], command, `npm ${name} changed; review and update the adapter`)
}

// A deliberate allowlist preserves this project's script-only authorization.
// Adding a new command requires reviewing both the adapter and this check.
const expectedArgs = {
  adapter: [['docs/ai-delivery/check-adapter.mjs']],
  typecheck: [['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit']],
  unit: [['node_modules/vitest/vitest.mjs', 'run', '--config', 'docs/validation/vitest.config.ts', '--outputFile.json', '{evidenceDir}/unit-tests.json']],
  puzzles: [['tools/validate-puzzles.mjs'], ['docs/validation/calibrate-puzzles.cjs']],
  ui: [['docs/validation/validate-ui.cjs']]
}
assert.deepEqual(Object.keys(profile.commands).sort(), [...profile.checks].sort())
for (const id of profile.checks) {
  const commands = profile.commands[id]
  assert.equal(commands.length, expectedArgs[id].length, `Unexpected commands in ${id}`)
  commands.forEach((command, index) => {
    assert.equal(command.executable, 'node', `Only inspected Node scripts are permitted: ${id}`)
    assert.deepEqual(command.args, expectedArgs[id][index], `Unreviewed command or flags: ${id}`)
    assert.deepEqual(command.outputs ?? [], id === 'unit' ? ['{evidenceDir}/unit-tests.json'] : [], `Invalid evidence output: ${id}`)
    assert(fs.statSync(path.join(root, command.args[0])).isFile(), `Missing check tool: ${command.args[0]}`)
  })
}

const inputs = [
  'src', 'tests', 'tools', 'docs/validation',
  'docs/generated/pipeline-smoke.json',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html',
  'README.md', 'docs/PROJECT_OVERVIEW.md', 'docs/ARCHITECTURE.md',
  'docs/design', 'docs/implementation', 'docs/ai-delivery', 'docs/workflow/RULES.md'
]
assert.deepEqual(profile.exclude, ['docs/validation/results'], 'Only generated validation reports may be excluded')
for (const relative of [...profile.watch, ...profile.exclude]) relativePath(relative)
for (const relative of inputs) {
  assert(fs.existsSync(path.join(root, relative)), `Missing input: ${relative}`)
  assert(tracked(relative), `Input not fully watched: ${relative}`)
}
assert.deepEqual(profile.ruleFiles, ['docs/workflow/RULES.md', 'docs/PROJECT_OVERVIEW.md', 'docs/ARCHITECTURE.md'])
for (const relative of profile.ruleFiles) assert(fs.statSync(path.join(root, relative)).isFile())

const records = {
  taskRoot: 'docs/tasks',
  statusFile: 'docs/workflow/STATUS.md',
  runtimeDir: 'docs/workflow/runtime'
}
for (const [key, relative] of Object.entries(records)) {
  assert.equal(profile[key], relative, 'Generated records must stay in docs/')
  assert(!tracked(relative), `Generated state would invalidate inputs: ${relative}`)
}
assert(!tracked('docs/intake'), 'Intake records must not create a fingerprint loop')

const policy = profile.checkPolicy
assert.deepEqual(policy.always, ['adapter'])
for (const relative of inputs.filter(relative => !['README.md', 'docs/PROJECT_OVERVIEW.md', 'docs/ARCHITECTURE.md', 'docs/design', 'docs/implementation'].includes(relative))) {
  const required = new Set(policy.always)
  for (const rule of policy.rules) {
    assert(rule.reason?.trim(), 'A policy rule needs a reason')
    for (const prefix of rule.paths) relativePath(prefix)
    assert(rule.checks.every(id => profile.checks.includes(id)), 'Policy references an unregistered check')
    if (rule.paths.some(prefix => matches(relative, prefix) || matches(prefix, relative))) {
      rule.checks.forEach(id => required.add(id))
    }
  }
  assert(profile.checks.every(id => required.has(id)), `Incomplete project check policy: ${relative}`)
}

console.log('OK: 5 script-only checks; source, dependencies, fixtures and rules watched; generated reports excluded; complete project checks required for code or adapter changes')
