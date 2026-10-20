# 调整后的实施计划

需求：设置页提供本地数据备份导出与导入恢复，先校验后整体写入，快照语义。原计划随首次定义归档保留。

1. `src/repositories/storage.ts` 增加 `readEnvelope`/`writeEnvelope`：读取时兼容旧版无包装数据（包装为 `version: 0`），写出时保持 envelope 原样；`writeStorage` 复用 `writeEnvelope`，不改变现有写入口径。
2. `src/repositories/results.repository.ts` 导出 `normalizeProgress`；`src/repositories/current-game.repository.ts` 将 `normalize` 导出为 `normalizeCurrentGame`；`src/repositories/settings.repository.ts` 导出 `SETTINGS_KEY`。供备份校验复用，不复制校验逻辑。
3. 新增 `src/services/backup.service.ts`：`BACKUP_KEYS` 固定为 current-game/results/settings 三个不可再生键（练习/闯关缓存可重建，明确不纳入备份）。`buildBackupPayload()` 读取原始 envelope 组装 `{ kind: 'sudoku-backup', backupVersion: 1, exportedAt, data }`；`summarizeBackup()` 输出导出时间、历史条数、进度数、是否含当前局与文本大小；`parseBackup()` 严格校验（kind、backupVersion、data 内每键 envelope 结构；results 的 history/progress 逐条 normalize 后零丢失、dailyDates 为数组；current-game 通过 `normalizeCurrentGame` 或 data 为 null；settings 为对象），任一失败抛中文错误且不写任何键；`applyBackup()` 按快照语义恢复：备份中存在的键 `writeEnvelope` 整体覆盖，不存在或 data 为 null 的键 `removeStorage`，任一写入失败抛错并如实报告。
4. `src/pages/settings/index.vue`：操作区在"恢复默认设置"前新增"导出备份数据/导入备份数据"两行。导出：`gameStore.flushSave()` 后 `buildBackupPayload()`，BottomSheet 展示摘要、只读 textarea（`maxlength="-1"`）全文与"复制备份内容"按钮（`uni.setClipboardData`，失败提示长按手动复制）。导入：BottomSheet textarea + "检查备份"（`parseBackup`，展示摘要或错误）+ "导入并覆盖本机数据"按钮（仅校验通过可用）+ `uni.showModal` 二次确认（覆盖不可撤销）→ `applyBackup` → `settingsStore.reload()`、`progressStore.reload()`、`historyStore.refresh()`、`gameStore.discard(false)` 后 `restoreGame()` → 提示成功并 `uni.reLaunch` 回主菜单。
5. 新增 `docs/validation/backup.spec.ts`（沿用 docs/validation 的 uni 全局模拟、假计时器与 Pinia 约定）：覆盖含真实对局与结算数据的"导出→清空→导入→restoreGame"往返一致、legacy 无包装数据包装与恢复、各类损坏/伪造备份整体拒绝且本机数据不变、备份缺键时对应键被清除、envelope 读写辅助函数行为。
6. 更新 `docs/PROJECT_OVERVIEW.md`：页面地图设置页描述与"存储与迁移"章节补充备份键范围与快照语义。
7. `verify` 运行全部注册检查（adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence）；失败按真实原因修复，不删减检查。
8. 会话内逐项复核验收条件并填写 review-input.json，`finish` 交付；设备体验（剪贴板大文本、textarea 粘贴、弹窗面板）如实列入未验证项，由用户手动验收。

恢复：检查失败保留原始日志，修复授权范围内代码后重新 verify（检查最多 4 次、3 轮修复）；需求或范围再变化走 amend；不操作 Git、不启动工程。
