# Architecture

```text
Vue Pages / Components
        │
        ▼
      Pinia
        │
        ├──────────────► Services (generation / daily / audio)
        │                     │
        ├──────────────► Repository ─────► uni local storage
        │
        ▼
Pure TypeScript Sudoku Core
(candidate / solver / logical / hint / generator / validator / replay)
```

## State ownership

- `home/index.vue`：常驻游戏主菜单，应用入口与当前局摘要；显示时恢复/暂停/保存原局，不创建新题。
- `levels/index.vue`：二级闯关/练习选择，复用原有连续编号、生成取消与替换确认。
- `game.store.ts`：当前局、模式和完整题目、输入、计时、操作、解法、书签、保存与结算反馈。
- `progress.store.ts`：保留与生成关卡的最佳成绩与首次完成积分视图。
- `history.store.ts`：保留历史、独立完成局累计与每日日期。
- `settings.store.ts`：类型校验后的偏好，持久化成功后更新响应式状态。
- `statistics.store.ts`：从闯关进度与累计值派生统计，显示无总关数上限的完成数与阶段进度；历史列表不是累计口径。

## Window adaptation and interaction

`useWindowMetrics.ts` 共享响应式可用窗口与安全区，监听尺寸变化并在页面/应用返回前台补读；所有消费者释放后取消原生窗口监听。缺少全局 API 时使用页面 onResize，窗口 API 失败时回退系统信息。`useAppearance` 返回外观 class 与页面安全区变量；`useSafeArea` 的顶/底数据现在是 computed Ref，使用者不可再当成静态数值。

`window-layout.ts` 依据实际宽、高及安全区选择单列或并排，棋盘和操作区有尺寸边界，矮窗口允许纵向滚动；大屏内屏（折叠屏展开、平板）棋盘上限提升至 840px 且格子数字/候选字号随棋盘放大（字号上限 44/50px），操作列收窄至 ≤300px 并在分屏内紧凑排布，触控目标保持 ≥44px。宽高均 ≥900px 的窗口（内屏展开）进一步切换为竖栏布局：棋盘最大化（上限 1024px、数字字号上限 64/72px），候选/解法/擦除/草稿与撤销/重做沿右缘竖向排列，数字键横排于棋盘下方。普通尺寸变化不调用游戏动作、不创建游戏、不改变计时与操作栈。半折叠铰链需要原生姿态信息，目前没有此桥接，不能把窗口适配等同于姿态识别。

单格候选与全部候选为开关动作（再次点击清空；部分笔记仍被完整候选覆盖），动作整体入撤销栈，全部候选的激活态经 allCandidatesShown 驱动工具栏高亮。更多菜单工具通过明确的 allowPaused 参数在暂停中执行；确认结束按原状态恢复，迟到回调受页面生命周期与游戏 ID 保护。继续入口统一导航失败兜底。提示说明与有效揭示分开，lastHintKey 保存已查看棋盘/步骤标识以避免同一步重复计数。新增 independentMode 默认 false，候选/清理依可见棋盘，手动检查与推导为显式求助。

## Persistence and completion

`results.repository.ts` 使用一次同步写入提交进度、历史、累计计数、每日完成和结算标识。完成写入成功后才置 COMPLETED，之后刷新 Store 视图、清理当前局并导航。失败保留可重试的棋盘；相同游戏使用稳定的记录 ID 与结算标识去重。

首次读取结果格式兼容原有有效 progress/history，首次更新写入统一结果。当前局保留完整 level 和 mode，使保留题、生成关卡、练习、每日和自定义来源都能恢复与重开。生成关卡恢复额外校验唯一解和完整评级元数据。重置结果标记旧当前局废弃，当前局文件清理失败也不会恢复旧进度。

写入成功依赖平台单个 Storage key 的同步持久化语义；未引入跨 key 数据库事务。设备完全无法写入时 UI 明确提示只能暂存在内存。

## Replay and retention

Action 保存格子的 before/after patch；Timeline 包含 APPLY / REVERT，真实记录撤销和重做。超过 1500 事件时把被移除事件应用到 `timelineBase`，回放从新的起点开始。

最多保存 1000 条历史、50 条详细回放，并按约 150 万 JSON 字符的预算优先清空较早回放。归档记录只显示最终棋盘。累计与历史序号独立持久化，不随裁切或删除减少。

## Puzzle sources

```text
Seed / date / imported text / bundled bank
   ↓
Unique-solution generation or validation
   ↓
Logical solver + actual technique tier
   ↓
SudokuLevel + mode
   ↓
GameState stores a complete level snapshot
```

四档按当前引擎求解路径分级。运行期生成限制尝试次数、让出执行并支持取消；有限尝试后采用等价变换并重新评级。最近题目与每档下一题缓存单独保存，缓存失败不决定业务存档结果。

保留题库元数据校准、命令行生成与运行期均调用同一个 Core。保留原 75 关 ID 与题目映射；静态 `getLevelById` 只负责这部分。连续编号与后继入口由 `config/campaign.ts` 提供，`campaign.service.ts` 按需解析保留题或生成新关卡。

新闯关使用系列、编号和 `CAMPAIGN_GENERATOR_VERSION` 决定种子，固定尝试次数保证确定性；每 25 关提高评分区间与技巧阶段，最高档保持专家持续出题。缓存最近 100 道，使用缓存前重新验证。当前局快照和成绩独立于缓存。改变关卡算法、评分或阶段参数需保持已有编号映射并处理版本兼容，不能直接使旧编号重新出另一道题。

每日算法改动需要提升独立的 `GENERATOR_VERSION`；本次未改变每日规则。

## Validation

`docs/validation/vitest.config.ts` 独立于 uni-app 构建插件，真实 Store/Repository 和 Vue 内存渲染器配合模拟平台接口测试。`npm run check` 执行类型、完整回归（含 300 道生成关卡抽检及折叠屏窗口/交互专项）、保留题库唯一解/元数据以及 24 个 SFC 与 12 条路由源码校验；不启动工程或浏览器。

详细范围与待进行的设备验收见 [首版记录](implementation/2026-09-30/IMPLEMENTATION.md)、[无限闯关记录](implementation/2026-09-30/INFINITE_CAMPAIGN.md) 与 [主菜单设计](design/2026-09-30/MAIN_MENU.md)。
