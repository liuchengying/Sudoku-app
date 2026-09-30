# Architecture

```text
Vue Pages / Components
        │
        ▼
      Pinia
        │
        ├──────────────► Repository ─────► uni local storage
        │
        ▼
Game orchestration
        │
        ▼
Pure TypeScript Sudoku Core
(candidate / solver / logical / hint / generator / validator)
```

## State ownership

- `game.store.ts`: 当前局、输入模式、计时、Action、Undo/Redo、提示与完成流程。
- `progress.store.ts`: 固定关卡最佳成绩与首次完成积分。
- `history.store.ts`: 完成记录和复盘数据。
- `settings.store.ts`: 用户偏好。
- `statistics.store.ts`: 从 progress/history 派生统计。

## Persistence

页面和 Store 不直接散落调用 `uni.setStorageSync`。所有本地数据通过 `repositories/` 访问，以便后续把实现替换成 SQLite。

## Replay

Action 保存 Cell patch；Timeline 额外记录 APPLY / REVERT，因此复盘能还原撤销与重做后的真实操作顺序，而不是只回放最终 undoStack。

为控制 JSON 体积，最新 50 条历史保留 Timeline，最多保存 1000 条历史摘要；较早记录保留最终棋盘和成绩。

## Puzzle pipeline

```text
Solved board
   ↓
Unique-solution digging
   ↓
Validator / countSolutions(limit=2)
   ↓
Logical solver + difficulty metadata
   ↓
Static JSON bank
   ↓
Build-time / CI validation
```

运行期使用固化 JSON，不在用户手机上等待复杂生成流程。
