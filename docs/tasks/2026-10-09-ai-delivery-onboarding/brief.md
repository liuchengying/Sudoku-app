# 接入数独项目的 AI 需求交付流程

原始需求：[$ai-delivery](/Users/mac/.agents/skills/ai-delivery/SKILL.md) 接入此项目

## 验收条件

- adapter-ready：本项目适配配置可被 ai-delivery 识别，doctor 返回 ready=true，已注册真实脚本检查及范围检查政策。
- permissions-preserved：新增配置、脚本及材料均位于根目录 docs/；项目规则保留用户对 Git、电脑/浏览器控制、工程启动及脚本验证的约定。
- checks-backed：通过适配器执行类型、完整 Vitest 回归、生产题库唯一解/评分及 Vue SFC/路由检查，原始日志和单元测试报告绑定本轮证据。
- inputs-tracked：源码、测试、依赖声明、检查脚本、必要样本和规则均纳入指纹跟踪，生成报告不触发输入循环；注册命令不会启动应用。
- workflow-usable：提供后续需求与恢复入口说明，完成本次任务的逐项会话内复核和交付，自动状态页准确显示待用户验收。
- menu-regression-aligned：首页菜单回归明确使用已看过新手引导的用户前提，并独立检查首次引导、跳过后菜单可用及设置持久化；保持原有菜单、恢复、导航和统计断言，不修改业务源码。

## 修改范围

- docs/ai-delivery
- docs/workflow/RULES.md
- docs/PROJECT_OVERVIEW.md
- docs/validation/game-flows.spec.ts

## 允许的检查

adapter、typecheck、unit、puzzles、ui

## 未纳入本次自动验收

- 本次仅接入交付流程并执行脚本检查，未启动 H5/Android 工程、构建应用或进行设备、浏览器体验验收。
- 后续新会话是否自动选择技能尚需真实需求观察；本次未运行后台模型，也未替用户记录验收通过。
