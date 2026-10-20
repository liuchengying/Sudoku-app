# 调整后的实施计划

需求与既有验收条件不变；本次 amendment 仅因验收阶段指纹失效而扩展范围并补证据类型声明。

1. 本任务为评估交付，不修改业务代码；评估报告与诊断材料作为历史存档保留。
2. 评估交付后共享路径的演进（四轮改进落地、工具链迁移、备份功能、弹窗中文化）在 impact.md 中逐项说明。
3. verify 按当前工作区运行全部注册检查（adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence）；失败按真实原因修复，不删减检查。
4. 以稳定材料（评估报告、impact.md、plan.md）与新运行证据填写 review-input，finish 交付后记录用户验收决定。

恢复：检查失败保留原始日志按真实原因修复；不操作 Git、不启动工程。
