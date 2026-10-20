const assert = (ok, message) => { if (!ok) throw new Error(message) }
const intersects = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/')

export function validateCheckPolicy(profile, validatePath) {
  if (profile.checkPolicy === undefined) return
  const policy = profile.checkPolicy
  assert(policy && typeof policy === 'object' && !Array.isArray(policy), 'checkPolicy 必须是对象')
  const validChecks = checks => Array.isArray(checks) && new Set(checks).size === checks.length && checks.every(id => profile.checks.includes(id))
  assert(validChecks(policy.always), 'checkPolicy.always 必须是已注册且不重复的检查数组')
  assert(Array.isArray(policy.rules), 'checkPolicy.rules 必须是数组')
  for (const rule of policy.rules) {
    assert(rule && Array.isArray(rule.paths) && rule.paths.length > 0, '检查规则需要明确 paths')
    rule.paths.forEach(validatePath)
    assert(validChecks(rule.checks) && rule.checks.length > 0, '检查规则只能使用已注册且不重复的检查')
    assert(typeof rule.reason === 'string' && rule.reason.trim(), '检查规则需要 reason')
  }
  assert(policy.always.length || policy.rules.length, '空 checkPolicy 不能代替检查选择')
}

export function selectChecks(profile, scope, requested) {
  const policy = profile.checkPolicy
  const reasons = []
  const required = new Set()
  if (policy) {
    policy.always.forEach(id => required.add(id))
    if (policy.always.length) reasons.push({ reason: '项目基础检查', checks: policy.always, paths: [] })
    for (const rule of policy.rules) {
      const paths = rule.paths.filter(prefix => scope.some(relative => intersects(relative, prefix)))
      if (!paths.length) continue
      rule.checks.forEach(id => required.add(id))
      reasons.push({ reason: rule.reason, checks: rule.checks, paths })
    }
  }
  const checks = requested === undefined ? (policy ? profile.checks.filter(id => required.has(id)) : null) : requested
  assert(Array.isArray(checks) && checks.length > 0 && new Set(checks).size === checks.length && checks.every(id => profile.checks.includes(id)), '检查必须来自项目白名单且不重复；没有政策或匹配时由 AI 明确选择')
  const missing = [...required].filter(id => !checks.includes(id))
  assert(missing.length === 0, `缺少项目必要检查：${missing.join('、')}；不能通过显式选择降低门槛`)
  return { checks, source: requested === undefined ? 'project-policy' : 'explicit', required: profile.checks.filter(id => required.has(id)), reasons }
}
