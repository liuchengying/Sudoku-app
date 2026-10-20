# 项目适配与任务格式

## 一次接入

AI 先读项目约定、包配置、真实验证脚本；仅注册脚本检查，不注册 dev、应用启动、发布或 Git。用户要求接入即授权创建适配，不能据此批量修改其他项目。默认新材料在 docs；已有 `.ai-agent` 规则按其项目约定继续读取。

`init` 会生成 `docs/ai-delivery/project.json` 草稿，保留已有文件。AI 完善后运行 `doctor`；也可先在 docs 写适配，再 `init --adapter docs/...json`。未注册检查时 doctor 失败，不能创建任务。不要用永远 exit 0 的脚本代替项目检查。

```json
{
  "schemaVersion": 2,
  "name": "example-project",
  "timezone": "Asia/Shanghai",
  "maxRepairRounds": 3,
  "checkTimeoutMs": 120000,
  "watch": ["src", "tests", "package.json", "docs/ai-delivery/project.json"],
  "exclude": [],
  "checks": ["unit"],
  "commands": {
    "unit": [{"executable": "node", "args": ["--test", "tests/service.test.mjs"]}]
  },
  "ruleFiles": ["docs/workflow/RULES.md"]
}
```

`watch` 跟踪影响结果的源码、依赖、配置和规则；`scope` 为本任务许可改动范围。不能把生成状态纳入输入形成循环。默认 `taskRoot` = `docs/tasks`、`statusFile` = `docs/workflow/STATUS.md`、`runtimeDir` = `docs/workflow/runtime`；如 watch 覆盖它们，必须在 exclude 排除。配置字段的变化也参与指纹。

源码 scope 必须是 watch 中某路径或其子路径，并且不能位于 exclude 内。宽泛父目录不等于已跟踪所有子目录；先缩小范围或完善 watch。任务目录、收件 docs/intake、状态文件和运行目录属于操作资料。目录下的 exclude 仅用于生成资料，不能用来隐藏必要输入。检查脚本、关键数据及依赖声明也纳入 watch；工具不会推导所有隐式依赖。

可选 checkPolicy 是项目质量门槛，例如：

```json
{
  "checkPolicy": {
    "always": ["unit"],
    "rules": [
      {"paths": ["src/core", "tests/core"], "checks": ["unit"], "reason": "核心行为及对应回归"}
    ]
  }
}
```

所有检查必须已注册，规则必须有 paths、checks 和 reason；范围与规则路径按父子交集匹配，结果按项目注册顺序合并。存在政策时可省略新收件的 checks，自动选择并记录 checkSelection；显式选择不得漏掉必要项。无政策仍由 AI 明确选择，有政策但没有任何匹配时也不能凭空生成通过检查。amend 不能减少已有检查，verify 再核对当前政策。政策是最低要求，不代替风险判断。

每个检查可有多条命令，以参数数组、项目根为 cwd、shell=false 执行；node 自动使用当前 Node。可执行 python3 或项目现有测试工具。检查由适配配置授权，CLI 不接受任意临时命令；这不是沙箱，注册命令的代码仍需可信。

仅展开 `{projectRoot}`、`{taskDir}`、`{evidenceDir}`，后两者为相对项目路径。报告用 `outputs` 声明，且必须在本轮 `{evidenceDir}` 内；缺报告即失败，报告哈希纳入门槛。源码、需求、计划、引擎或证据变化需重新检查。检查有超时和有限修复次数。

next [ID] 只读汇总待办及建议动作；没有 ID 时优先唯一进行中任务，多项候选不猜测目标。返回 readOnly、selected、candidates、action、next、counts、tasks 和 runtime，任务项包含真实检查及 attempts；不会自动执行动作或创建新任务。已结束历史保留在 status，排除 next 的待办。回执与自动状态页复用同一判断。

inspect 同时核对验证、复核、交付和需求调整归档，输出材料路径、具体失效原因、范围外变化及剩余尝试。doctor 的 ready 表示配置就绪，writeAvailable 单独表示写锁是否允许推进；两者都不代表已运行检查。恢复或修改任务时读 [恢复与调整](recovery.md)。

context ID 是精简只读接续包：完整 request/scope/criteria/manualChecks、必要检查、规则路径、真实动作及材料位置。计划最多摘录 2400 字符，并给总长度、truncated 与完整路径；需求和验收条件不截断。没有 baseline、完整 runs 或日志正文。复杂异常再 inspect。单次 status/inspect 共享输入快照，下一次读取和检查结束重新取样。

## AI 填写的任务文件

收件 `docs/intake/<id>.json`：

```json
{
  "id": "2026-10-09-example",
  "title": "用户结果",
  "request": "用户实际需求描述",
  "scope": ["src/service.mjs", "tests/service.test.mjs"],
  "criteria": [{"id": "expected-behavior", "description": "具体可验证的行为"}],
  "checks": ["unit"],
  "manualChecks": ["本次未进行设备验收"]
}
```

将具体计划作为同一收件的 plan 字符串后，用 begin --spec 一次创建并开工。计划描述实现、检查及恢复，不能使用占位内容；无效输入在创建前拒绝，已有任务不覆盖。new/plan/start 继续可用。begin 不自动执行 verify。

复核 `docs/tasks/<id>/review-input.json`：

```json
{
  "reviewer": "当前会话逐项复核",
  "summary": "根据真实检查和文件复核填写结论",
  "findings": [],
  "criteria": [{"id": "expected-behavior", "result": "passed", "evidence": ["docs/tasks/<id>/evidence/<run>/result.json"]}]
}
```

存在未解决问题不能交付。必要证据不只局限于日志，可以在 docs 写源码复核说明；AI 必须说明证据支持什么，工具只核实覆盖、文件和哈希。

finish ID --file docs/...json 依次执行 review 与 deliver，保持检查、逐项证据及文件指纹门槛。两步间输入变化时停在真实 reviewed 阶段，不伪造交付；恢复可使用原 deliver，或在复核输入与已记录原结论一致时使用 finish。确认仍由用户明确决定。检查摘要与原始结果、非空证据及必要报告不一致时，当前材料无效。

决定 `docs/tasks/<id>/owner-input.json`：

```json
{
  "source": "explicit-user-message",
  "reference": "真实用户消息引用",
  "note": "实际确认或调整内容",
  "decision": "accept"
}
```

decision 可为 accept、return、cancel。accept/return 限待验收阶段；cancel 可以在所有未结束阶段使用且保留历史，不回滚代码或终止进程。决定记录包含 previousStatus 及当时的检查/交付 fingerprint；尚无检查时 fingerprint 为 null。最终掌控权保留给用户。工具不会替用户自动验收，也不能以本地文件证明身份。
