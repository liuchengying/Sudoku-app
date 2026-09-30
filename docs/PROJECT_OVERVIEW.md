# 当前工程与扩展入口

更新日期：2026-09-30。本文描述功能完善后的代码。修改前的问题与市场对比保存在 [原始评估](reviews/2026-09-30/ASSESSMENT.md)，实施范围与验收详见 [首版记录](implementation/2026-09-30/IMPLEMENTATION.md) 与 [无限闯关记录](implementation/2026-09-30/INFINITE_CAMPAIGN.md)。

## 工程基线

- Android 优先的离线单机数独，配置 H5 目标；uni-app、Vue 3、TypeScript、Pinia、Vite、SCSS。
- 没有业务后端、账号或业务网络请求；数据保存在本机。
- `src/main.ts` 创建应用与 Pinia，`src/App.vue` 处理后台暂停、保存和主题导航颜色。
- `src/pages.json` 注册 11 个自定义导航页面。
- 同时保留一局未完成游戏，开始其他游戏时确认替换。
- 大师、王者、宗师均为无限闯关系列：原有各 25 关保留，26 关起离线生成、分阶段提高难度；另有四档无限练习、每日挑战、自定义导入。

## 模块职责

| 模块 | 关键入口 | 职责 |
| --- | --- | --- |
| 游戏编排 | `src/stores/game.store.ts` | 输入、计时、存档、撤销重做、解法、检查、书签与完成重试 |
| 闯关进度 | `src/stores/progress.store.ts` | 最佳成绩与首次通关积分；完成流程由统一结果提交更新 |
| 历史与累计 | `src/stores/history.store.ts` | 历史摘要、完成局累计、每日完成日期 |
| 统计与成就 | `src/stores/statistics.store.ts`、统计页面 | 关卡进度、全模式完成局统计、派生成就 |
| 设置与外观 | `src/types/settings.ts`、`settings.store.ts`、`useAppearance.ts` | 布尔偏好、输入方式、深色/大字、首次引导状态 |
| 统一结果存储 | `src/repositories/results.repository.ts` | 兼容旧有效数据；一次提交进度、历史、累计和每日记录 |
| 当前局存储 | `src/repositories/current-game.repository.ts` | 验证完整棋盘与操作结构，恢复任意来源的游戏 |
| 数独 Core | `src/core/sudoku/` | 候选、求解、唯一解、逻辑推导、难度、生成与回放；纯 TypeScript |
| 保留题库 | `src/assets/puzzles/`、`src/config/difficulty.ts` | 原有 75 道题、ID、题组名、积分与实际难度标签 |
| 无限闯关 | `src/config/campaign.ts`、`src/services/campaign.service.ts`、`src/repositories/campaign.repository.ts` | 连续编号、分页、递进阶段、确定性出题、取消与最近题目缓存 |
| 练习分级与出题 | `src/config/practice.ts`、`src/services/puzzle.service.ts` | 四档技巧评级、随机生成、重复过滤、缓存、取消、每日与导入 |
| 连续完成 | `src/services/daily.service.ts` | 按本地日期处理连续天数与闰日/月边界 |
| 棋盘与输入 | `src/components/sudoku/` | 状态显示、候选高亮、单键盘、分步解法弹层 |
| 公共组件 | `src/components/common/` | 头部、底部弹层、更多菜单和响应式奖牌 |
| 脚本验证 | `tests/`、`docs/validation/` | Core、业务与组件回归、评分校准、SFC 编译、题库生成 |

调用关系：页面/组件 → Pinia → Core/Service/Repository → uni Storage。Core 不依赖 Vue、Pinia 或平台 API。

## 页面地图

| 页面 | 功能 |
| --- | --- |
| home/index | 无限闯关分页/跳转、无限练习、继续游戏、每日与导入入口 |
| game/index | 棋盘、填数/草稿、数字优先、解法、检查、书签、暂停、保存反馈 |
| result/index | 奖牌与成绩、闯关积分/连续下一关、随机新题、重玩 |
| history/index | 分批加载历史卡片与最终棋盘 |
| history/detail | 从保存的起点回放，或仅显示归档记录的最终棋盘 |
| statistics/index | 关卡最佳进度、完成局累计、模式统计与本地成就 |
| tutorial/index | 技巧目录与入门实局练习入口 |
| tutorial/detail | 文章与技巧要点 |
| settings/index | 辅助偏好、深色/大字、输入方式、重置 |
| daily/index | 日历、补玩、完成标记、当前/最长连续天数 |
| import/index | 文字题目输入、唯一解校验、开始游戏 |

## 核心业务约定

- `GameState.mode` 区分 CAMPAIGN / PRACTICE / DAILY / CUSTOM；旧局按闯关恢复。
- `GameState.level` 保存完整题目，新生成的闯关、随机/每日/导入局不依赖静态 ID 查找。
- 给定数字不可改；输入、笔记、检查、书签恢复均记录 Cell patch，避免直接修改格子绕过回放。
- 撤销最多 500 操作，Timeline 最多 1500 事件；裁切时推进 `timelineBase` 并标记 `timelineTruncated`。
- 正确填数清除相关候选属于同一个操作，撤销可整体恢复。
- 错误与提示次数累计，不被撤销或书签恢复减少；关闭即时检查隐藏即时正确性展示，错误仍计入最终成绩。
- 金牌：零错误零提示；银牌：至多 2 次错误且零提示；其他完成为铜牌。
- 只有闯关首次完成获得积分，包括新生成的关卡，重玩不重复加分；其他模式只计历史、累计与相关每日完成记录。
- 计时单位毫秒，暂停时间排除；后台是否暂停由设置决定。存档恢复后先暂停，等待继续。
- 解法先处理错误填写，再给真实逻辑推导；暂不能推导时明确提供答案提示。查看有效解法计入提示。

## 存储与迁移

| Key | 数据 |
| --- | --- |
| sudoku:v1:current-game | 完整当前局、来源元数据、操作栈、回放起点、书签 |
| sudoku:v3:results | 闯关进度、历史、完成局累计、每日日期、序号、结算/重置标识 |
| sudoku:v1:settings | 设置，按值类型兼容缺失的新字段 |
| sudoku:v1:practice | 最近 100 道练习题与每档下一题缓存 |
| sudoku:v1:campaign-cache | 最近 100 道自动生成的编号关卡；丢失后按编号重建 |
| sudoku:v1:progress / history | 原版本迁移读取来源；新写入以 results 为准 |

Storage Envelope 仍兼容旧 `{ version, data }` 与未包装数据。Repository 做结构校验。结果提交使用一个结果 key 的同步写入，成功后才更新页面完成状态；相同游戏通过结算标识与记录 ID 去重。以后增加结算字段应加入这一提交，避免恢复分步写入。

历史最多 1000 条，详细回放最多 50 条；约 150 万 JSON 字符预算优先归档较早回放。累计统计独立保留，删除/归档历史不会减少累计。首次迁移只能从现存有效记录初始化，无法恢复旧版本已经裁掉的历史。

## 难度与出题

大师/王者/宗师保留称谓与 2000/4000/10000 分，各系列原有 25 道题继续可玩。这 75 道保留题的实际难度按引擎求解路径分为入门/基础/进阶/专家，数量分别为 9/41/7/18；这个数量不是当前关卡总数。

各系列第 26 关起持续离线生成；大师从基础、王者从进阶、宗师从专家起步，新增关卡每 25 关提高一档，达到最后专家档后持续出题。阶段的实际技巧与评分区间同时受约束，同阶段难度有浮动。完整区间见 [递进规则](implementation/2026-09-30/INFINITE_CAMPAIGN.md)。编号、版本和系列决定题目，生成尝试次数固定，与设备速度及游玩顺序无关。首页只呈现每组 25 个编号，题目按需生成；超过 25、999 或 10000 均可继续。

四档无限练习先生成再评级，有限尝试后使用保持唯一解的等价变换；拒绝近期重复，支持取消与下一题缓存。没有固定关数上限，也不承诺所有历史题目永不重复。每日种子取本地日期与生成版本，修改每日算法时需要提升版本并保留当前局快照。

Core 已实现唯一候选、隐藏唯一、区块排除、裸对、隐藏对、裸三数组、X-Wing。专家表示当前引擎不能完整逻辑求解；教程中的其他技巧不代表已有对应引擎实现。

`tools/generate-puzzles.mjs` 保留命令入口，委托 `docs/validation/generate-bank.cjs`，使用同一 Core 生成和评分。产物默认放 `docs/generated/`；不要直接覆盖生产题库或改变已有 ID 的题目映射。

## 验证与协作

`npm run check` 包含类型检查、66 条单元/业务/组件回归（含 300 道连续生成关卡抽检）、75 道保留题的唯一解与评分校验、22 个 Vue SFC 和 11 条页面路由检查。结果文件位于 `docs/validation/results/`。

测试不启动应用，模拟平台存储与接口。尚未进行原生/H5 正式构建、实际布局、触摸、音效与震动的设备验收。

遵循用户协作约定：未明确要求不操作 Git、不操控电脑/浏览器、不启动工程；新增说明、验证脚本和材料位于根目录 `docs/`。后续需求按业务规则、交互、Store/类型、Repository/Core、脚本验证推进。
