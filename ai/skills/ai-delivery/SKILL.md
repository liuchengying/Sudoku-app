---
name: ai-delivery
description: Run tracked development, bug fixes, and requirement delivery in projects with an ai-delivery adapter; onboard a project or install the reusable workflow when asked. Use durable task states, project checks, evidence gates, and user acceptance. Do not use for ordinary questions, brainstorming, or unrelated writing.
---

# AI 需求交付

让用户描述需求，AI 负责实现并提交有证据的结果。该技能驱动当前会话中的工作；不会启动后台模型，也不会增加 Git、工程启动、浏览器或发布权限。

## 接入与入口

使用本技能目录内 `scripts/ai-delivery.mjs`，总是明确目标项目：

```text
node <技能绝对目录>/scripts/ai-delivery.mjs --project <项目绝对路径> doctor
```

配置按顺序查找 `.ai-agent/project.json`、`docs/ai-delivery/project.json`；其他位置使用 `--config`。先读用户约定、配置中 `ruleFiles` 及需求涉及的项目资料。未接入的项目仅在用户要求接入时读取 [项目适配说明](references/project-adapter.md)，核实实际脚本后注册检查；空配置不能开始交付。安装或卸载时读包内 README，先检查同名安装，不能覆盖其他工具。

## 推进真实任务

1. `next` 查看真实待办，结合当前需求定位已有相关任务；多个候选用 `next ID`，不要仅按最新日期猜目标，也不要让用户为内部流程逐阶段选择。已结束历史不进入待办。定位后先读 `context ID` 的完整需求、范围、验收条件、规则路径和真实下一步，必要时再读完整计划与证据；不重复加载所有历史。复杂异常用 `inspect ID`，需要恢复时按需读 [恢复与调整](references/recovery.md)。
2. 新需求由 AI 在 `docs/intake/<id>.json` 写原话、范围、可核查的验收条件及具体 `plan`，用 `begin --spec` 合并收件、计划和开工；已有 new/plan/start 同样可用。项目有 checkPolicy 时允许省略 checks，由范围规则选择并记录必要项；无政策由 AI 明确选择。源码范围必须纳入 watch，检查脚本和关键依赖也应跟踪，排除项仅用于生成资料。无需让用户填写内部表单。
3. 实施并运行 `verify ID`。选择与变化相关的检查；失败后不能删减检查或绕过门槛。用户中途补充需求或必要范围变化时，用 `amend` 归档旧定义并重新计划，不直接改 task.json；始终限定在已授权的需求内。不要把脚本成功当作设备体验验收。达到修复上限时呈现实际阻碍。
4. 对照需求逐项复核，记录真实复核方式和 docs 内证据，填写 `review-input.json` 后调用 `finish ID --file ...`，合并复核与交付；原 review/deliver 保持可用。合并命令保留检查与证据门槛，中断时按真实阶段继续。同一会话复核如实称为会话内复核，不虚构不同代理。授权范围内持续工作到交付。
5. 只有用户明确确认、退回或取消时记录 `decision`。取消可在所有未结束阶段记录，保留历史且不回滚代码；写锁仍在时等当前执行结束，不终止其他进程。确认和退回仍在待验收阶段。“继续完善”是后续工作，不是验收同意；指向不明确且有多个待验收交付时，先确认具体对象。accepted/cancelled 的后续变化建立新任务，保留历史决定。本地 JSON 不具备身份认证；交付验收不等于发布许可。

具体收件、复核和决定 JSON 见 [项目适配说明](references/project-adapter.md)。CLI `help` 提供语法。

按需求复杂度选择资料与检查：小改动可以用简短计划和直接证据，不额外制造角色报告；复杂变更再补设计、兼容或迁移说明。验收条件描述用户结果，测试验证行为或真实风险，不把过程文件数量当作质量。仅在缺少关键需求或必要授权时请用户决定，其他内部步骤持续完成。

质量优先：项目政策是最低门槛，AI 仍应补充规则未覆盖的真实风险检查，不为省成本降低条件。工具核对证明文件与原始结果的一致性，但不能替代对业务结果、测试有效性及未解决问题的判断。脚本通过、设备体验和用户验收分别如实说明。

## 让流程可感知

在开始实施、检查结束和交付时，把 CLI 返回的实际回执简洁地写进进度消息，版本取工具输出，例如“AI 交付 <版本> · 任务 … · 执行中 · 下一步 …”。next 是只读接续入口，回执包含动作与剩余尝试；上限用尽先说明阻碍，不盲目重试。材料失效先说明具体原因，不能仍提示用户接受失效交付。不编造状态或省略失败。用户无需逐阶段确认；只有需求缺关键内容或验收时才需要用户决策。

最终回复说明结果、实际检查、未验证事项，以及 `docs/tasks/<id>/delivery.md` 和 `docs/workflow/STATUS.md` 链接。状态摘要由工具自动更新。历史 accepted 关联历史交付指纹，当前证据失效不撤销用户曾经的验收。
