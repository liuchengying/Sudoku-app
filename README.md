# 数独 Android App · uni-app V1.0.0

一个以参考截图为产品基准、面向 Android 的离线数独应用。工程采用 **uni-app + Vue 3 + TypeScript + Pinia + Vite**，游戏引擎保持纯 TypeScript，可独立测试和复用。

当前 V1 已经是可以在本地安装依赖后直接进入联调的完整单机版本，不依赖后端服务。

## V1 功能清单

### 首页与关卡

- 3 档难度：大师 / 王者 / 宗师
- 每档 25 个固定关卡，共 75 关
- 5 × 5 关卡矩阵
- 滑动切换难度
- 当前关卡、进行中状态、完成奖牌
- 未完成局继续游戏
- 开始其他关卡时二次确认
- 首次完成固定积分：2000 / 4000 / 10000

### 数独游戏

- 标准 9 × 9 数独
- 初始数字、玩家数字、提示数字区分
- 选中格 / 同行 / 同列 / 同宫高亮
- 相同数字高亮
- 普通数字输入
- 草稿（Notes）模式
- 单格自动候选
- 长按“候选”填充全盘候选
- 智能草稿：阻止非法候选
- 正确输入后自动清理相关候选
- 擦除
- 错误即时提示及累计错误数
- 解法提示及一键填入
- Undo / Redo
- 暂停 / 恢复
- App 进入后台自动暂停（可关闭）
- 基于时间戳的可靠计时
- 自动存档、冷启动恢复
- 音效与震动反馈
- 完成检测与结算

### Solver / Sudoku Engine

`src/core/sudoku` 完全不依赖 Vue、Pinia 和 uni-app，包含：

- Row / Column / Box bitmask
- Candidate bitmask
- MRV Backtracking Solver
- 唯一解计数（搜索到第 2 解即停止）
- 棋盘合法性校验
- 随机终盘生成器
- 唯一解挖洞生成器
- 逻辑求解轨迹
- Naked Single
- Hidden Single
- Locked Candidate（Pointing / Claiming）
- Naked Pair
- Hidden Pair
- Naked Triple
- X-Wing
- 难度评分扩展接口
- 逻辑提示引擎

### 历史与统计

- 完成一局自动写入历史
- 历史卡片显示最终棋盘
- 题目数字黑色、玩家/提示数字蓝色
- 历史序号持续递增
- 最近 50 局保存完整操作复盘
- 最多保存 1000 条历史摘要
- 较早记录保留最终棋盘、成绩和统计，压缩逐步操作数据
- 总积分
- 完成关卡数 / 完成局数
- 金牌 / 银牌 / 铜牌
- 总游戏时长
- 累计错误 / 提示
- 分难度完成进度、金牌数、最佳时间

### 教程与设置

- 玩法说明
- 基础技巧
- 高级技巧
- 行列宫高亮开关
- 相同数字高亮开关
- 自动删除候选开关
- 智能草稿开关
- 错误即时提示开关
- 后台自动暂停开关
- 完成数字键禁用开关
- 音效开关
- 震动开关
- 恢复默认设置
- 重置全部游戏进度
- 系统分享 / 剪贴板降级

## 奖牌和积分规则

奖牌：

- 金牌：0 错误、0 提示
- 银牌：错误 ≤ 2、0 提示
- 铜牌：成功完成

积分：

- 大师：2000
- 王者：4000
- 宗师：10000
- 每个固定关卡只有首次完成获得积分，重复完成只更新最佳成绩并保存历史，不重复刷分。

相关配置集中在 `src/config/difficulty.ts`。

## 目录结构

```text
src/
├── pages/                     # 页面
│   ├── home/
│   ├── game/
│   ├── result/
│   ├── history/
│   ├── statistics/
│   ├── tutorial/
│   └── settings/
├── components/
│   ├── common/
│   ├── home/
│   └── sudoku/
├── core/sudoku/               # 纯 TypeScript Sudoku Engine
├── stores/                    # Pinia 游戏 / 进度 / 历史 / 设置
├── repositories/              # 本地持久化隔离层
├── services/                  # 音效、分享
├── assets/puzzles/            # 生产题库 JSON
├── content/                   # 教程内容
├── config/
├── types/
└── utils/

tests/                         # Vitest 测试
tools/                         # 零依赖题库生成 / 校验工具
```

## 环境

建议：

- Node.js 20 LTS 或更新的兼容版本
- npm 10+
- HBuilderX 当前稳定版
- Android Studio / Android SDK（使用本地原生运行环境时）

## 首次安装

```bash
npm install
```

安装成功后建议把生成的 `package-lock.json` 一并提交到你的仓库，保证后续团队环境完全一致。

## H5 快速调试

```bash
npm run dev:h5
```

H5 适合调试业务逻辑、棋盘和页面。Android 的状态栏、安全区、震动、系统分享等仍需真机确认。

## Android / App 调试

CLI：

```bash
npm run dev:app
```

也可以直接使用 HBuilderX 打开项目，然后：

```text
运行 → 运行到手机或模拟器 → Android
```

正式生成 APK/AAB 前，请在 HBuilderX / DCloud 配置中替换：

1. `src/manifest.json` 的开发 AppID
2. Android 包名
3. 自己的签名证书
4. 应用图标和启动图
5. 隐私政策、权限说明及目标商店要求

当前工程没有业务网络请求，也没有申请额外 Android 危险权限。

## 检查与测试

完整检查：

```bash
npm run check
```

等价于：

```bash
npm run typecheck
npm test
npm run puzzle:validate
```

### 零依赖题库验证

即使还没有 `npm install`，只要本机有 Node.js，也能验证生产题库：

```bash
node tools/validate-puzzles.mjs
```

它会逐题检查：

- 81 格格式
- 初始棋盘合法性
- solution 合法性
- puzzle 与 solution 一致
- 唯一解
- Solver 解与固化 solution 一致

### 重新生成离线题库

```bash
npm run puzzle:generate
```

默认输出 `generated-puzzles.json`，不会直接覆盖生产题库。可以指定随机种子和输出文件：

```bash
SEED=20260929 OUTPUT=./generated-puzzles.json npm run puzzle:generate
```

确认质量后再人工替换 `src/assets/puzzles/puzzles.json` 并执行 `npm run check`。

## 本地数据

目前使用 `uni.setStorageSync`，Repository 层统一封装：

```text
sudoku:v1:current-game
sudoku:v1:progress
sudoku:v1:history
sudoku:v1:settings
```

数据使用版本 Envelope 包装，便于后续 migration。

对于 V1 的单机规模，本地 Storage 足够。若未来加入无限历史、每日挑战、云同步等，再把 Repository 实现替换为 SQLite / 服务端即可，页面和 Sudoku Core 不需要重写。

## 核心架构约束

### Sudoku Core 不引用前端框架

`src/core/sudoku` 只能使用纯 TypeScript。这保证 Solver、Generator、Validator 可以在 Node 工具、Web Worker 或其他客户端中直接复用。

### 页面不能直接改游戏格子

不要：

```ts
cell.value = 7
```

统一使用：

```ts
gameStore.inputDigit(7)
```

这样输入、候选联动、Undo / Redo、自动保存和复盘才会保持一致。

### 游戏修改采用 Patch Action

一次操作会保存所有受影响 Cell 的 before / after snapshot。例如填入正确数字后自动删除同行候选，这些候选变化也属于同一个 Action，因此可以完整撤销。

## 当前有意不包含的功能

V1 是完整离线单机版本，下列功能需要服务端或新的产品设计，因此没有伪实现：

- 好友实时对战
- 登录 / 账号系统
- 云同步
- 在线排行榜
- 广告 / 内购
- 每日在线挑战

后续如果要做 PvP，建议独立设计 WebSocket 房间、断线重连、局面仲裁和反作弊，不要把它硬塞进当前本地 Store。

## 本地调试建议

第一次真机启动建议依次确认：

1. 首页三档难度都能滑动且各 25 关。
2. 开始一关，输入 / 草稿 / 候选 / 擦除 / Undo / Redo 正常。
3. 切后台 5～10 秒，再回来确认暂停与计时行为。
4. 强制杀掉 App，重新启动确认当前局恢复。
5. 用“解法”快速完成一局，检查结算、积分、历史、统计。
6. 再玩同一关，确认不会重复增加总积分。
7. 历史详情检查最终棋盘与操作复盘。
8. 设置里关闭高亮、音效、震动等逐项确认。
9. Android 返回键在“更多”、游戏页、结果页的行为是否符合预期。

如果真机 UI 与参考截图在某个 Android 分辨率上存在尺寸偏差，优先调整组件 SCSS，不要修改 Sudoku Core 或 GameState。
