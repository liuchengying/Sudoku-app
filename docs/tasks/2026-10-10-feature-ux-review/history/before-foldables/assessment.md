# 当前数独功能与交互评估

评估日期：2026-10-10。对象：当前 sudoku-uniapp 源码，按现有 Android 优先、离线单机定位评估。本次输出建议与依据，不实施功能修改。

当前主线已经完整。下一步最有价值的投入是统一交互规则、补足学习闭环和保护本地进度。登录、排行榜、联网对战会引入新的产品与服务端范围，本轮不列为首批事项。

## 已有能力，避免重复建设

| 用户流程 | 当前已实现 |
| --- | --- |
| 初次使用与首页 | 三步交互引导、跳过并持久化、设置中重看引导；首页开始/继续游戏、当前局摘要和各功能入口 |
| 选择题目 | 三系列无限闯关、25 关分页、关卡跳转和推荐；四档无限练习；出题等待与取消、重复过滤/缓存 |
| 每日与自定义 | 每日题、历史日期补玩、完成日历和连续天数；81 位文字导入、冲突/无解/多解校验 |
| 游戏操作 | 两种输入顺序、草稿、单格/全盘候选、智能草稿、联动清理、撤销/重做、暂停、检查棋盘与一个棋盘书签 |
| 辅助与学习 | 分步解法、区域高亮、答案提示；技巧文章、入门实局练习；专家题不能完整逻辑讲解时明确降级为答案提示 |
| 数据与反馈 | 自动存档/冷启动恢复、存储失败提示、结算重试与去重；积分/奖牌、历史逐步回放、累计统计和基础成就 |
| 显示偏好 | 深浅主题、蓝/绿棋盘配色、大字、音效/震动及辅助开关 |

依据为实际 12 个注册页面、相关组件/Store/Repository/服务。关键源码摘录及文件哈希保存在 [source-evidence.json](source-evidence.json)。旧 README 和概览中的测试数量不用于代替本次检查结果。

## 优先优化现有交互

这里的 P1 表示建议首批处理，P2 表示后续完善；并非线上事故等级。“已确认”表示源码或模拟平台脚本确认，不代表设备体验已验收。

### UX-01 · P1 · 提示计数的时机和告知

**已确认行为：**点击“解法”打开面板时，提示次数已经从 0 变为 1；此时还没有点击“查看推导”或“填入答案”。提示次数大于 0 会影响奖牌。虽然面板和教程有计数说明，但用户是在发生计数后才看到面板说明。

依据：[requestHint](/Users/mac/Downloads/sudoku-uniapp/src/stores/game.store.ts:336)、[奖牌规则](/Users/mac/Downloads/sudoku-uniapp/src/stores/game.store.ts:41)、[解法面板](/Users/mac/Downloads/sudoku-uniapp/src/components/sudoku/HintSheet.vue:15)；脚本路径 `hint-counts-on-open`。

**建议：**明确区分“打开面板”“揭示推导”“查看/填入答案”。推荐打开说明不计数，在首次揭示有效信息时计一次，并在该按钮上提前写清对成绩的影响；同一有效提示重复展开不重复计数。若保留当前规则，也应在进入前告知，而不是发生后才解释。这是规则优化建议，当前计数本身与现有实现一致。

**改善目标：**打开后直接关闭的用户不会意外失去无提示奖牌；计数时机、文案、存档与结算一致。

### UX-02 · P1 · “给我下一步”与“提示这个格”区分

**已确认不一致：**操作说明称“选中空格可以直接查看该格答案”，实际 requestHint 优先找全局错误或全局逻辑步骤，会重新选择另一个格。脚本选中索引 0，实际提示索引 24。

依据：[操作说明](/Users/mac/Downloads/sudoku-uniapp/src/content/tutorial.ts:28)、[全局逻辑提示](/Users/mac/Downloads/sudoku-uniapp/src/stores/game.store.ts:339)；脚本路径 `hint-does-not-target-selection`。

**建议：**第一步先修正文案，明确当前解法是在找全盘下一步；后续可提供“下一步推导”和“当前格答案”两个明确动作，分别告知计数。不要把全局提示描述为当前格提示。

**改善目标：**用户知道将作用于哪个格；选中格、提示高亮和最终填入的格一致，给定数字不可被提示覆盖。

### UX-03 · P1 · 暂停、菜单与继续入口保持一致

**已确认行为：**原本暂停的游戏，在“更多 → 保存书签”后变成 PLAYING 并恢复计时；检查/恢复书签和全盘候选也有主动 resume 分支。此外：首页“继续游戏”会恢复，关卡页“继续本关”仅跳转，仍保持暂停，需要再点一次棋盘遮罩。

依据：[菜单动作](/Users/mac/Downloads/sudoku-uniapp/src/pages/game/index.vue:91)、[首页继续](/Users/mac/Downloads/sudoku-uniapp/src/pages/home/index.vue:51)、[关卡继续](/Users/mac/Downloads/sudoku-uniapp/src/pages/levels/index.vue:64)；脚本路径 `paused-bookmark-resumes`、`resume-entry-inconsistent`。

**建议：**菜单打开、取消确认和辅助操作结束后保留操作前的计时状态；需要运行中的动作可暂时执行并恢复原状态，或明确要求用户先继续。所有标为“继续”的入口采用同一规则。恢复书签确认框显示期间保持暂停，取消也不能意外开始计时。

**改善目标：**暂停中查看/保存不偷跑时间；首页、选择页和每日页的继续体验一致；取消重开、恢复和退出能回到原状态。

### UX-04 · P1 · 每日挑战的“今日”与补玩状态

**已确认行为：**保留的每日页面在跨天返回时只更新 today，selected 和 month 保持原值。脚本模拟 9 月 30 日到 10 月 1 日，今日已变为 10 月 1 日，实际选题仍是 9 月 30 日、日历仍显示 9 月。

依据：[日期初始化与 onShow](/Users/mac/Downloads/sudoku-uniapp/src/pages/daily/index.vue:16)；脚本路径 `daily-date-stale-on-return`。

**建议：**增加“回到今天”；区分默认跟随今日和用户主动补玩。默认今日选择跨天后随日期与月份更新，主动选中的历史日期保留并标明“补玩”。相同每日存档应显示“继续这一天”，避免开始按钮含义不清。

**改善目标：**跨天、跨月、切回前台后，标题、日历选中、按钮文案和真正启动的题目日期一致；补玩不被误重置。

### UX-05 · P1 · 明确定义辅助开关，避免间接揭示答案

**已确认行为：**关闭即时错误提示会隐藏数字键的余数，但数字键是否禁用仍依赖 `value === solution`。脚本构造两个都有 9 个数字 4 的棋盘，正确填满时键禁用，含错误时键可用，用户仍能间接判断正确性。

依据：[数字键余数与禁用](/Users/mac/Downloads/sudoku-uniapp/src/components/sudoku/NumberPad.vue:7)、[游戏页开关联动](/Users/mac/Downloads/sudoku-uniapp/src/pages/game/index.vue:220)。另外，智能草稿和自动候选使用 `currentBoard(true)`，会按已知答案过滤错误填写：[候选处理](/Users/mac/Downloads/sudoku-uniapp/src/stores/game.store.ts:225)。

**建议：**先明确“仅不标红”和“完全自主推理”是否是两种模式。保留独立辅助开关也可以，但要说明仍存在完成数字判断等辅助。若提供自主模式，数字禁用与候选依据不能暗中查询答案；保留普通规则冲突检查，求助动作单独标识。

**改善目标：**同样的可见填写不会仅因隐藏答案而出现不同提示状态；设置文案能真实解释行为。当前开关名只承诺即时提示，不宜直接把所有辅助行为判为规则违约。

### UX-06 · P2 · 导航失败与无效详情的恢复入口

**源码确认：**首页继续已有导航失败暂停兜底；多数 openPage 调用、结算 redirectTo、下一关跳转没有同类处理。结算先变为 COMPLETED 再跳转，若跳转失败，游戏控件已禁用。历史详情与教程详情在 ID 无效时只有 v-if 内容，缺少明确“记录不存在/已归档”的空态。

依据：[通用导航](/Users/mac/Downloads/sudoku-uniapp/src/composables/useNavigation.ts:2)、[完成跳转](/Users/mac/Downloads/sudoku-uniapp/src/stores/game.store.ts:465)、[历史详情](/Users/mac/Downloads/sudoku-uniapp/src/pages/history/detail.vue:47)、[教程详情](/Users/mac/Downloads/sudoku-uniapp/src/pages/tutorial/detail.vue:24)。未模拟真实平台的页面栈错误，属于异常路径待完善。

**建议：**统一导航失败提示与返回首页兜底；完成页跳转失败时保留“查看结果/返回首页”入口；详情 ID 不存在时提供解释和返回列表按钮。需要保留已结算数据，不能重新结算刷分。

**改善目标：**导航失败仍有可执行下一步；空详情不显示成没有内容的页面；结果保存与页面跳转分别处理。

## 建议补充的功能

| 编号与优先级 | 建议 | 当前依据与价值 | 后续可验收目标 |
| --- | --- | --- | --- |
| F-01 · P1 | 本地备份与恢复 | 设置只提供本机保存说明、重置；分享仅分享 App 文案，尚无进度导出入口。离线用户重装/换机缺少自助迁移方式。 | 导出带版本的进度、当前局和设置；导入先校验、预览冲突并确认，失败保持原数据；明确历史归档边界。 |
| F-02 · P2 | 多局暂存 | 当前仅一个 current-game；从闯关切到每日/练习会替换，已有二次确认。棋盘书签属于同一局快照，并不是多局存档。 | 支持暂存并切换少量不同模式的局；每局独立计时和操作栈，旧单存档可迁移；清晰展示当前继续对象。 |
| F-03 · P2 | 技巧专项互动练习 | 已有三步新手示例、文字技巧和随机入门实局；文章详情没有与该技巧匹配的棋盘练习。 | 先做唯一候选、隐藏唯一、区块排除的“观察→选择/排除→反馈”；支持的引擎技巧与纯科普技巧区分。 |
| F-04 · P2 | 历史筛选与更好复盘 | 已有每次加载 20 条、滑块与上/下一步；缺模式/难度/日期筛选、操作解释和重点跳转。 | 可筛选目标记录；显示填写/候选/撤销/提示动作，跳到提示或错误相关步骤；只有最终棋盘时提前说明不能回放。 |
| F-05 · P2 | 导入预览、题目收藏与题目分享 | 已有文本清洗和唯一解验证，当前主要是 textarea 与文字结果；分享并非题目分享。 | 显示识别数量及 9×9 预览，定位冲突格；可保存自定义题、复制标准题目文本并重新导入，保持题面和答案一致。 |
| F-06 · P2 | 结算解释与学习趋势 | 已有积分/奖牌/用时/错误/提示、累计和基础成就；结算没有奖牌原因、历史最佳对比和复盘直达。 | 解释本局奖牌与重复闯关计分，显示已完成局的近期趋势；按模式/难度比较，避免混合难度误导。 |

新增功能依据：[单局存储](/Users/mac/Downloads/sudoku-uniapp/src/repositories/current-game.repository.ts:32)、[设置操作](/Users/mac/Downloads/sudoku-uniapp/src/pages/settings/index.vue:116)、[分享内容](/Users/mac/Downloads/sudoku-uniapp/src/services/share.service.ts:1)、[教程入口](/Users/mac/Downloads/sudoku-uniapp/src/pages/tutorial/index.vue:49)、[历史列表](/Users/mac/Downloads/sudoku-uniapp/src/pages/history/index.vue:15)、[导入](/Users/mac/Downloads/sudoku-uniapp/src/pages/import/index.vue:31)、[结算信息](/Users/mac/Downloads/sudoku-uniapp/src/pages/result/index.vue:75)。

数据能力需要保留现有约束：最多 1000 条历史、最近 50 条详细回放，体积超限时还能进一步归档；累计值独立保存。[归档策略](/Users/mac/Downloads/sudoku-uniapp/src/repositories/results.repository.ts:62)。备份不能声称恢复已被裁掉的操作。当前累计时长/错误/提示来自**完成局**，没有完整开局/放弃分母，不宜直接增加“胜率”或宣称统计了所有游玩时间：[累计记录](/Users/mac/Downloads/sudoku-uniapp/src/repositories/results.repository.ts:35)。

## 设备上需要确认的交互

- **小屏与大字：**棋盘、数字键、工具栏和提示面板是否在小屏/横屏/系统大字体下可见；不能仅凭 CSS 推断挤压或误触已经发生。
- **无障碍：**数字键、棋盘已有 aria-label，新手引导有 dialog 语义；部分工具栏/返回/关闭仍使用 view/text 点击，H5 未见完整键盘导航与弹窗焦点管理。需要检查语义、读屏顺序、焦点恢复和图标说明。
- **等待与取消：**闯关/练习已经有 loading、token 取消和分次让出线程，不应误列为缺少加载状态。单次同步生成/评级仍会占用线程，应实测低端设备冷启动、首次专家题和取消延迟，必要时拆分计算；不能用本机脚本耗时承诺手机等待时间。
- **反馈：**真实音效、振动、暂停遮罩、候选长按是否易发现，以及 Android 返回键和系统前后台行为需实机确认。

依据：[工具栏](/Users/mac/Downloads/sudoku-uniapp/src/components/sudoku/GameToolbar.vue:23)、[棋盘格语义](/Users/mac/Downloads/sudoku-uniapp/src/components/sudoku/SudokuCell.vue:39)、[通用弹层](/Users/mac/Downloads/sudoku-uniapp/src/components/common/BottomSheet.vue:20)、[生成让出与取消](/Users/mac/Downloads/sudoku-uniapp/src/services/campaign.service.ts:14)。本次没有启动工程、浏览器或设备。

## 建议分批顺序

1. **首批：现有流程修整。**统一暂停和继续（UX-03）、修正每日日期状态（UX-04）、修正提示文案与计数告知（UX-01/02），明确辅助模式边界（UX-05）。配套回归覆盖取消、冷启动、跨月、重复提示和不同设置组合；不改既有关卡编号、积分映射或出题版本。
2. **第二批：保护数据并提高学习反馈。**先本地备份/恢复（F-01），再结算解释与复盘入口、历史筛选（F-04/06）、基础技巧互动（F-03）。导航兜底与无效详情空态（UX-06）可随关联页面改动补齐。
3. **第三批：扩展使用场景。**多局暂存（F-02）、收藏/题目分享/导入预览（F-05）、更丰富的模式与趋势。先确认实际使用频率再扩展；暂不把离线产品直接扩大为账号或对战平台。

## 证据与验证边界

[probe-interactions.cjs](probe-interactions.cjs) 直接加载当前 TypeScript 与 Vue script-setup，使用模拟 uni API、内存存储、受控日期和不执行的计时器，确认了 6 条行为路径。原始结果在 [interaction-probes.json](interaction-probes.json)，日志在 [probe-interactions.log](probe-interactions.log)。脚本只验证这些行为目前存在，不将其当作修复通过或真实 UI 验收。直接调用 setup 的生命周期警告已留在日志中，该脚本不验证组件挂载或卸载。

项目的适配、类型、完整单元回归、题库和 Vue SFC/路由脚本由本任务 verify 执行，结果以本任务的原始 evidence 和 delivery 为准；常规测试通过也不覆盖上述所有交互规则。评估建议尚未实现，后续选择的实施范围应建立新的真实交付任务。
