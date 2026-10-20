# 共享路径变化的调用方影响

本轮涉及共享路径（src/repositories/）的变化及其对调用方的影响，逐文件说明：

- `src/repositories/storage.ts`：新增导出 `readEnvelope`/`writeEnvelope` 并导出 `StorageEnvelope` 接口；`readStorage`/`removeStorage` 语义与签名不变，`writeStorage` 改为内部复用 `writeEnvelope`（写入字节不变，仍是 `{ version: 2, data }` envelope）。现有调用方（全部 repository、相关 store）无行为变化。
- `src/repositories/results.repository.ts`：`normalizeProgress` 由模块私有改为导出，函数体未变。现有调用方不受影响；新增调用方为 `src/services/backup.service.ts`（导入校验）。
- `src/repositories/current-game.repository.ts`：`normalize` 重命名为导出的 `normalizeCurrentGame`，校验逻辑未变；`KEY` 更名为导出的 `CURRENT_GAME_KEY`。现有调用方 `game.store.ts` 与各页面仍通过 `currentGameRepository` 访问，不受影响。
- `src/repositories/settings.repository.ts`：`KEY` 更名为导出的 `SETTINGS_KEY`，读写行为未变；`settings.store.ts` 经 repository 访问，不受影响。
- `src/services/backup.service.ts` 为新增文件，仅被设置页导入，不改变既有共享契约。

页面对接：`src/pages/settings/index.vue` 新增导出/导入备份入口，消费上述新导出；对公共组件 BottomSheet 仅作既有 API 的常规使用（`v-model` + title + 默认插槽），未修改组件本身。

结论：共享契约均为向后兼容的增量导出，无既有调用方需要适配。
