# 数独项目 AI 需求交付

接入日期：2026-10-09。公共工具版本：0.5.1。项目适配在 [project.json](project.json)，协作和权限约定在 [RULES.md](../workflow/RULES.md)。

用户直接描述开发需求或问题，AI 负责收件、计划、实现、检查、复核和交付。之后明确回复“验收通过”“退回修改”或“取消这个需求”，AI 才记录相应决定。普通咨询不建立任务。后续会话是否自动选用技能需在真实需求中观察，也可明确说“使用 $ai-delivery 完成……”。

## 已注册检查

| 检查 | 实际执行 | 作用 |
| --- | --- | --- |
| adapter | `node docs/ai-delivery/check-adapter.mjs` | 检查脚本白名单、npm 别名一致性、必要输入跟踪和检查政策 |
| typecheck | `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` | 对应 `npm run typecheck`，不生成编译产物 |
| unit | `node node_modules/vitest/vitest.mjs run --config docs/validation/vitest.config.ts --outputFile.json <本轮证据目录>/unit-tests.json` | 对应 `npm test`，完整 Node 环境测试，JSON 报告绑定本轮证据 |
| puzzles | `node tools/validate-puzzles.mjs` 与 `node docs/validation/calibrate-puzzles.cjs` | 对应 `npm run puzzle:validate`，校验 75 道保留题唯一解、答案和评分元数据 |
| ui | `node docs/validation/validate-ui.cjs` | 对应 `npm run ui:validate`，内存编译 Vue SFC、检查页面路由及现有题库样本 |

类型、单元、题库和 UI 四项覆盖现有 `npm run check` 的执行范围。全部命令由 Node 直接调用已检查的脚本，不使用 shell，不注册工程启动、watch、构建、Git 或发布。UI 是源码编译与路由检查，不证明设备上的布局或交互体验。

每个任务至少运行适配自检；源码、测试、工程配置、依赖声明、验证工具、题库样本或适配规则变化触发全部五项。纯产品资料变化默认运行适配自检，AI 仍按实际风险追加检查。检查的单条命令超时为 300 秒，首次检查失败后最多修复三轮，不通过减少检查绕过失败。

适配自检使用明确的命令白名单，npm 别名、工具入口、报告参数或门槛变化时会失败，需先阅读新脚本并同步维护配置和自检。公共工具和检查依赖仍来自当前机器，接入没有复制工具或新增 npm 依赖；另一个环境需要 Node 20+、项目现有依赖与公共技能。

## 输入与资料

`watch` 跟踪源码、测试、工具、依赖声明/锁文件、工程配置、项目依据与交付规则。Vue 检查会读取 `docs/generated/pipeline-smoke.json`，所以该样本也作为输入跟踪。仅排除 `docs/validation/results/` 中的生成报告；任务、收件、状态页和运行资料不属于 watch。

所有本次新增文件均在根目录 `docs/`：适配在本目录，收件在 `docs/intake/`，真实任务与证据在 `docs/tasks/<id>/`，状态页在 [STATUS.md](../workflow/STATUS.md)。单元 JSON 报告由适配覆盖既有固定输出路径，直接写入本轮 `evidence`；原有验证脚本和业务源码无需修改。

## AI 命令入口

下面是 AI 使用的入口，用户无需逐阶段操作。每次命令都明确项目路径；移到其他机器后换成实际技能与项目位置。

```bash
node /Users/mac/.agents/skills/ai-delivery/scripts/ai-delivery.mjs --project /Users/mac/Downloads/sudoku-uniapp doctor
node /Users/mac/.agents/skills/ai-delivery/scripts/ai-delivery.mjs --project /Users/mac/Downloads/sudoku-uniapp next
```

真实任务先读 `context <id>`；新需求用 `begin --spec docs/intake/<id>.json`，实施后 `verify <id>`，逐项复核后 `finish <id> --file docs/tasks/<id>/review-input.json`。范围调整用 `amend`，输入或证据过期按技能恢复，不直接改 task.json。仅有明确用户决定时才调用 `decision`。

工具不会启动后台模型、自动验收、自动发布或操作 Git；权限沿用当前用户约定。不要把脚本通过当成设备验证或用户认可。恢复与检查次数以 `next`、`context` 或 `inspect` 的真实回执为准。

本次接入任务：[交付包](../tasks/2026-10-09-ai-delivery-onboarding/delivery.md)。
