# APK 启动图与棋盘老设备降级：交付包

状态：待用户验收；本次交付不代表发布。

原始需求：用户原话："你最后提到的这两点短板，你马上修改一下，对于启动图，你可以自行设计一下，要贴合当前的数独以及整体样式风格"。背景：本地 Capacitor 打包的 APK 使用默认白色启动图（带 Capacitor 标志），且主棋盘依赖 aspect-ratio 保持正方形，在老系统 WebView 上可能布局塌陷。

## 验收结果

- 已复核：启动主题引用自定义背景与居中的数独标志图，配色取自应用现有变量（board-green 画布 #F4F8EF、棋盘线 #354D36、重点色 #0864CF），不再使用 Capacitor 默认 splash 图；横竖屏与各密度下标志居中且不拉伸。
- 已复核：主棋盘与引导棋盘在 @supports not (aspect-ratio) 分支下通过容器 padding-top:100% + 绝对定位保持正方形；历史缩略棋盘设置最小行高，不支持 aspect-ratio 时不塌陷为一条线。
- 已复核：项目注册检查（adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence）全部通过。
- 已复核：重新构建的 release APK 签名校验通过，包名 com.family.sudoku、versionCode 10000 保持不变，且 APK 内含自定义启动图资源。

## 检查证据

- adapter：通过，59 ms；[日志](evidence/2026-10-23T08-01-02-038Z-61d21cf0/adapter.log)
- adapter-tests：通过，395 ms；[日志](evidence/2026-10-23T08-01-02-038Z-61d21cf0/adapter-tests.log)
- typecheck：通过，2336 ms；[日志](evidence/2026-10-23T08-01-02-038Z-61d21cf0/typecheck.log)
- unit：通过，44009 ms；[日志](evidence/2026-10-23T08-01-02-038Z-61d21cf0/unit.log)
- puzzles：通过，485 ms；[日志](evidence/2026-10-23T08-01-02-038Z-61d21cf0/puzzles.log)
- ui：通过，889 ms；[日志](evidence/2026-10-23T08-01-02-038Z-61d21cf0/ui.log)
- risk-evidence：通过，40 ms；[日志](evidence/2026-10-23T08-01-02-038Z-61d21cf0/risk-evidence.log)

[完整检查结果](evidence/2026-10-23T08-01-02-038Z-61d21cf0/result.json) · [复核记录](review.json) · [实施计划](plan.md)

## 从任务收件后检测到的文件变化

- src/components/common/OnboardingGuide.vue
- src/components/sudoku/SudokuBoard.vue
- src/pages/history/index.vue

## 未验证或未执行

- 未连接真机或模拟器，启动图实际显示效果与老 WebView 降级效果未做设备验证；仅做静态与构建校验。

## 放行与恢复

请审阅计划中的具体实现和恢复步骤；需要调整时退回当前任务。只有收到用户明确确认，AI 才记录交付已接受。发布、Git 和设备操作另按授权执行。

检查输入指纹：e89fc95b8036bde162a4eeff3ad9793ae8951663256afaa4885af89558d1776c

生成时间：2026-10-23T08:03:13.638Z
