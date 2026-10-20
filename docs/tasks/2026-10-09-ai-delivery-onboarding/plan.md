# 调整后的实施计划

需求与既有验收条件不变；本次 amendment 仅因验收阶段指纹失效而扩展范围并补证据类型声明。

1. 本任务为流程接入交付；接入能力经 2026-10-20 工具链迁移后由 ai/ 与 .ai-agent/ 承载，行为不变，不改业务代码。
2. 交付后的演进在 impact.md 中逐项说明；旧基线中被迁移删除的 docs/ai-delivery 文件按删除记录纳入范围。
3. verify 按当前工作区运行全部注册检查（adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence）；失败按真实原因修复，不删减检查。
4. 以稳定材料（规则、概览、impact.md、plan.md）与新运行证据填写 review-input，finish 交付后记录用户验收决定。

恢复：检查失败保留原始日志按真实原因修复；不操作 Git、不启动工程。
