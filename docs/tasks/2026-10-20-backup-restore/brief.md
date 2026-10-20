# 本地数据备份导出与恢复

原始需求：用户原话："真机验收的话我后面来手动验收吧，你可以把数据导出备份的功能做了"。背景：2026-10-20 功能复盘（docs/reviews/2026-10-20/FEATURE_INVENTORY.md）将"本地数据无导出备份，卸载即全部丢失"列为 P1 缺口，用户确认实施该项；真机验收由用户后续手动完成。

## 验收条件

- export-entry：设置页提供"导出备份数据"入口：先自动保存未完成对局，再生成包含本机当前局、成绩/历史/累计/每日与设置的完整备份 JSON 文本，在底部面板展示内容摘要（导出时间、历史条数、进度关卡数、是否含当前局）与只读全文，可一键复制到剪贴板，复制失败有可用的手动替代提示。
- import-entry：设置页提供"导入备份数据"入口：粘贴备份文本后先校验并展示备份摘要，确认后整体恢复成绩/历史/累计/设置与当前局，四个相关 Store（设置、进度、历史、当前局）刷新到恢复后的数据并返回主菜单。
- validate-reject：损坏或非本项目的备份被整体拒绝：无法解析、缺少备份标识、版本不支持、缺少数据、成绩历史逐条校验有丢失、进度数据无效、当前局校验不通过或设置非对象时，给出明确中文原因，且不改动本机任何存储数据。
- snapshot-semantics：恢复按快照语义执行：备份中存在的键整体覆盖本机数据，备份中不存在的键（如导出时没有未完成对局）恢复后不再存在；恢复后的数据与备份内容一致，未完成对局恢复后先暂停等待继续。
- checks-pass：项目注册的 adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence 检查全部通过。

## 修改范围

- src/repositories/storage.ts
- src/repositories/results.repository.ts
- src/repositories/current-game.repository.ts
- src/repositories/settings.repository.ts
- src/services/backup.service.ts
- src/pages/settings/index.vue
- docs/validation/backup.spec.ts
- docs/PROJECT_OVERVIEW.md

## 允许的检查

adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence

## 未纳入本次自动验收

- 本次未进行设备验收：剪贴板复制大文本、textarea 粘贴超大备份、底部面板与确认弹窗在实际设备/H5 的体验待用户手动验证。
- 跨设备、跨平台恢复（不同机型间迁移）未在真机验证。
