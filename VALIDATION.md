# V1.0.0 Validation Report

生成交付包前已执行的离线检查：

- [x] 所有 JSON 文件可解析
- [x] `src/core/sudoku/*.ts` 通过 TypeScript strict 编译检查
- [x] 项目 TypeScript 源文件通过临时 uni/Pinia 类型桩 strict 检查
- [x] 所有 Vue `<script setup lang="ts">` 抽取后通过 strict TypeScript 检查
- [x] Sudoku Core 编译为 CommonJS 后执行运行时 smoke test
- [x] 75 道生产题逐题校验初盘合法性
- [x] 75 道生产题逐题校验唯一解
- [x] 75 道题 Solver 结果与固化 solution 一致
- [x] Generator 使用固定 seed 成功生成唯一解题目
- [x] 零依赖 Node 题库生成工具可生成 3 × 25 道题
- [x] 零依赖 Node 题库验证工具通过
- [x] Naked/Hidden Single 逻辑求解 smoke test 通过
- [x] 难度评分在逻辑无法完全求解时可安全降级到 Backtracking 标记

当前执行环境无法稳定连接 npm registry，因此没有生成 `node_modules` / `package-lock.json`，也不能在此环境完成 `vue-tsc`、Vitest 和 uni-app Android 实际构建。下载后请先运行：

```bash
npm install
npm run check
npm run dev:h5
```

然后使用 HBuilderX 运行到 Android 真机或模拟器。首次成功 `npm install` 后建议提交 `package-lock.json`。
