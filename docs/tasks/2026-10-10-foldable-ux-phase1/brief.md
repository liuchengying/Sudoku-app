# 首批折叠屏适配与游戏交互优化

原始需求：用户在功能与交互评估后要求“好的，开始执行吧”。关联评估 docs/tasks/2026-10-10-feature-ux-review/assessment.md。用户重点：“尽量也要兼容android的折叠屏，因为我的折叠屏使用场景会比较多”；范围澄清：“就是市面上几款主流的折叠屏，捏外屏，横向折叠，竖向折叠，还有阔折叠”。实施评估首批：普通窗口适配与状态连续性、UX-01/02/03/04/05。 验收阶段 amendment：任务交付后工程发生工具链迁移（ai/、.ai-agent/、AGENTS.md）与后续已验收任务（备份功能、弹窗中文化）对共享路径的演进，输入指纹失效。将监控全量路径纳入范围，按当前工作区重新检查后交付验收；原需求与既有验收条件不变。

## 验收条件

- adaptive-window：支持动态窗口宽高与安全区刷新、返回前台补读、监听清理及 API 缺失回退；允许 Android 横竖屏，按实际空间适配外屏/内屏、阔折叠和分屏。
- adaptive-layout：棋盘保持完整正方形；窄窗口单列，宽且空间足够时棋盘与操作区并排，短窗口可滚动访问动作；公共头部、弹层、引导和内容宽度避免大屏过度放大，保留主题与大字。
- state-continuity：纯窗口变化不创建新游戏、不改变填写/笔记/选中格/撤销重做/书签/计数及运行暂停状态，切换前后台按既有偏好保存与暂停；验证重复尺寸变化的监听和计时器不重复。
- pause-and-continue：更多菜单及检查/书签/候选动作完成或取消后保留原运行暂停状态，确认框显示期间暂停；首页、关卡与每日的继续入口一致恢复，导航失败暂停兜底。
- daily-date：默认今日选择跨日/月更新日期与月份；主动补玩选择保留，有回到今天入口，日期/开始继续文案与启动题目一致。
- hint-disclosure：打开关闭说明不计提示、不泄露提示目标；显式查看有效推导才计一次，同一有效提示重复展开不重复计数，保持应用提示安全与奖牌规则；文案明确是全盘下一步。
- independent-reasoning：提供明确自主推理偏好并兼容旧设置；自主模式不通过即时错误、数字余数/禁用、候选与自动清理隐式查询答案。手动检查与解法作为显式求助，错误/提示成绩累计规则不变。
- delivery-evidence：通过五项项目脚本与针对窗口/真实组件动作的回归，保留原始证据；说明真实安装、厂商内外屏与半折叠铰链验证边界，全部产出资料在 docs，未进行 Git、工程启动或电脑/浏览器操作。
- rework-recertified：任务交付后共享路径（src/repositories、src/stores 等）的后续变化全部来自后续已验收任务与工具链迁移；本任务按当前工作区重新通过全部注册检查，未回退或改写本任务交付的折叠屏适配行为。

## 修改范围

- .ai-agent
- AGENTS.md
- README.md
- ai
- docs/ARCHITECTURE.md
- docs/PROJECT_OVERVIEW.md
- docs/design
- docs/generated/pipeline-smoke.json
- docs/implementation
- docs/reviews
- docs/tasks/2026-10-10-foldable-ux-phase1
- docs/validation
- docs/validation/foldable-window.spec.ts
- docs/validation/game-flows.spec.ts
- docs/workflow/RULES.md
- index.html
- package-lock.json
- package.json
- src
- tests
- tools
- tsconfig.json
- vite.config.ts

## 允许的检查

adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence

## 未纳入本次自动验收

- 普通窗口响应与业务脚本可验证；真实 Android 安装、系统配置重建、触控、内外屏/半折叠姿态与厂商外屏运行能力尚需后续获授权的真机验收。
- 本项目尚无原生折叠姿态桥接；本轮核查能力并记录限制，不增加未经核实的第三方插件，不把宽窗口等同于铰链识别。
