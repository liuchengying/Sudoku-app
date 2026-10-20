# 调整后的实施计划

需求与验收条件不变；本次 amendment 仅因验收阶段指纹失效而扩展范围。

1. 备份功能实现维持已完成状态（storage envelope 辅助、三个 repository 校验导出、backup.service 导出/校验/快照恢复、设置页导出导入面板、9 条回归、工程概览更新），本轮不再改动业务实现。
2. 范围扩展说明：承接的共享页面（daily/game/import/levels/tutorial）与 docs/validation/validate-ui.cjs 由会话内后续任务 2026-10-20-modal-cancel-text（确认弹窗取消按钮中文化，已验收）修改；将这些文件纳入本任务范围使重检指纹覆盖当前工作区，本任务不重复修改它们。
3. verify 按当前工作区运行全部注册检查（adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence）；失败按真实原因修复，不删减检查。
4. 复核：更新 review-input 中逻辑证据路径到本轮运行目录；静态证据（impact.md、backup.spec.ts）与 render 观察不变；逐项复核后 finish 交付，等待用户验收决定。

恢复：检查失败保留原始日志按真实原因修复；不操作 Git、不启动工程。
