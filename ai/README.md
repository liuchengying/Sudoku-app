# sudoku-uniapp 项目 AI 开发入口

本项目维护一个主 Skill：`ai-delivery` 管需求收件、检查、复核与用户验收，随工程分发（公共引擎固定 0.5.1，见 `ai/skills/ai-delivery`）。数独业务的工程约定在 `.ai-agent/RULES.md` 与 `docs/workflow/RULES.md`，不依赖全局安装的技能。你描述需求，AI 整理验收条件、实现、检查和交付；用户处理关键业务决策及最终验收。普通咨询不建任务，只读审查不修改业务。

## 同事首次接入

先取得包含 `ai/`、`.ai-agent/` 的同一工程版本，使用 Node >=20。接入器本身只使用 Node 内置能力，不安装依赖、不启动项目；完整前端检查使用工程已有依赖（vue-tsc、vitest、题库与 SFC 校验脚本）。

在工程根目录运行，选择自己实际使用的工具：

```bash
# 按实际情况改逗号分隔的客户端，不必安装全部工具
node ai/scripts/install-entrypoints.cjs --dry-run --clients zcode
node ai/scripts/install-entrypoints.cjs --install --clients zcode
node ai/scripts/install-entrypoints.cjs --doctor
```

| clients 值      | 技能入口         | 规则与使用注意                                                   |
| --------------- | ---------------- | ---------------------------------------------------------------- |
| codex           | .agents/skills   | AGENTS.md；使用项目技能来源                                      |
| cursor          | .agents/skills   | 当前官方支持共同技能目录；核实实际版本                           |
| copilot         | .agents/skills   | 当前 VS Code Copilot 支持；核实所用 Agent/设置的规则发现         |
| windsurf        | .agents/skills   | 当前官方兼容共同技能目录；旧版本选择下面的适配                   |
| windsurf-legacy | .windsurf/skills | 用于需要原生技能目录的旧版本                                     |
| claude          | .claude/skills   | CLAUDE.md 管理区块导入 AGENTS.md                                 |
| zcode           | .zcode/skills    | 官方明确的工作区入口；刷新并确认启用                             |
| generic         | .agents/skills   | 共用内容；未知工具应显式读取 AGENTS 和 Skill，不承诺自动发现     |

多个工具复用 .agents 时只生成一个技能入口。ZCode 若具体版本已验证可复用 .agents，可选择 generic；不能仅凭文件存在认定客户端发现成功。不支持 Skill 的工具使用自己的项目规则引用 `AGENTS.md` 和 `ai/skills/ai-delivery/SKILL.md`；文件读取与 CLI 都不可用时，无法承担完整自动交付流程。

Windows 默认尝试目录 junction；macOS/Linux 默认使用相对软链接。权限或系统能力不支持时，auto 回退为管理副本。明确需要副本可使用：

```bash
node ai/scripts/install-entrypoints.cjs --install --clients claude --strategy copy
```

已有正确链接会保留，strategy 只决定新建或迁移入口，不擅自转换现有链接。选择 --clients 会更新当前活动接入组合；其他已安装入口不删除，后续重新选择时再同步。没有 --clients 时使用上次选择，新副本默认只接入 codex。

安装前完整预检所有目标；其他技能及规则管理区块外的内容保留。同名不同来源、非管理副本、被手改的管理区块/副本会停止，不覆盖用户修改。备份使用当前时间目录，记录和备份在 `docs/ai-delivery/`。

## 使用和接续

首次在新会话中让 Agent 做只读接入核对：

> 读取 AGENTS.md，确认 ai/skills 下主 Skill 的实际来源；运行项目接入诊断。只报告文件接入、依赖、全局同名及尚未核实的客户端发现状态，不开始需求、不启动工程。

日常直接描述结果和边界：

> 每日挑战完成后，日历当天标记与连续天数同步更新；补玩过去日期不改变已有记录。按项目规范交付并提供证据。

需求可声明授权档位，仅对当前任务有效：默认 A 档为纯静态检查；B 档允许运行注册检查所需的本地编译与测试环境；C 档在 B 档之上允许本任务 Git 分支操作。push 等远端写操作、master 改写等 Git 红线任何档位不解除；合并、发布与 push 由用户完成。边界见 `.ai-agent/RULES.md`《授权档位》。

ZCode 可在选择器提及 `$ai-delivery`；Claude Code 可用 `/ai-delivery`。其他工具用其本地调用方式或自然语言指定实际文件。全局同名的解析顺序不同，不能假设项目版本自动覆盖个人版本；doctor 会列出已知全局目录中的同名来源，保留原配置。

**本项目的状态写入统一使用下面的薄入口。** 它调用同一公共引擎，增加风险检查选择和证据类型复核，没有第二套任务状态：

```bash
node ai/scripts/delivery.cjs next
node ai/scripts/delivery.cjs context 实际任务编号
node ai/scripts/delivery.cjs doctor
```

AI 负责 begin/amend/verify/finish/decision 的内部材料。完整命令协议沿用公共工具；`delivery.cjs` 不接受 --project/--config，避免误用其他项目或全局版本。公共引擎直接 CLI 仅用于诊断/维护，不作为本项目日常状态写入入口。

一个需求由一个主要实现会话修复。换工具但仍在同一 checkout 时给任务编号，读取 context 后接续；不要让多个工具并行改同一范围。收件 JSON 用 `producedBy` 字段记录产出工具与会话（如 "zcode · 2026-10-20 会话"），跨工具或跨机器交接时随任务编号一并提供，便于接收方判断材料来源与接续方式。跨同事或另一台机器时，docs 历史默认不共享，仅给编号不足以接续；交接必须附需求、当前源码版本、交付及必要证据，接收方重新核对有效性，不能把他人的通过记录直接冒充本机检查。

## 按风险验收

每个 criterion 增加 evidenceTypes 与 risks，由 AI 判断和填写，用户无需填表。轻量文案/样式修改可使用 static 和空风险；评分与积分计算（`score-calculation`）、状态转换与存档兼容（`state-transition`）、题库与生成器（`puzzle-data`）要求 logic 证据并落到注册检查。项目入口自动追加检查，并确保已有回归文件实际执行。

公共组件、Store、仓库层及题库结构（`.ai-agent/acceptance-policy.json` 的 sharedPaths）变化要做快照检查（`ui` 校验）和调用方影响记录。逻辑、渲染、真实业务证据分别核对，静态或历史报告不能充当本轮逻辑证据。必需页面/联调证据缺失就保持未完成；用户已认可为范围外的观察项才放入 manualChecks。

政策在 `.ai-agent/acceptance-policy.json`，默认检查注册在 `.ai-agent/project.json`。

接入器、格式、契约、行为测试和风险证据检查都有真实脚本结果；源码风险分类、测试断言、动态调用覆盖和观察记录真实性仍需复核。项目入口不是系统沙箱，直接使用公共 API 或手改本地材料可能绕过扩展；Markdown 也不能替代客户端权限。观察记录格式和哈希不证明执行者身份或截图来源。

## 更新、检查和 CI

维护源更新后，已有软链接直接读到新内容；管理副本重新执行 install 同步。副本漂移会阻止覆盖，先核对实际修改，再决定合并方式。

```bash
# 本地已选择客户端的文件接入与规则检查
node ai/scripts/install-entrypoints.cjs --check
# 维护源/固定公共包检查，不要求客户端入口，可用于 CI
node ai/scripts/install-entrypoints.cjs --check --source-only
# 适配与接入/证据工具回归，不启动工程
node --test ai/checks/adapter.test.cjs ai/checks/entrypoints.test.cjs ai/checks/acceptance.test.cjs
# 公共引擎自身回归
node --test ai/skills/ai-delivery/tests/*.test.mjs
```

CI 可复用上面后三类检查，不要求所有同事安装全部客户端。本轮没有创建特定平台的 CI 配置；通用 Skill 格式按 [Agent Skills](https://agentskills.io/specification) 维护。

工具回归在 docs 内为每次运行创建独立临时目录，结束后清理样例；正式结果由任务 evidence 保存。维护时保留原始检查证据和恢复备份，预检结果已有正式证据替代后可清理，不把测试安装目录当作真实客户端入口。

`doctor` 核对 Node、已知工程依赖、入口、来源和同名；不刷新界面、不启用技能、不修改个人全局配置。团队试用另选列表需求、弹窗修复、公共变化，并验证普通咨询和缺接口场景。脚本回归通过不代表所有工具自动调用或 Windows 实机已验证。

## 维护位置与分发

| 位置                                           | 作用                                     |
| ---------------------------------------------- | ---------------------------------------- |
| .ai-agent/RULES.md                             | 共同规则维护源                           |
| .ai-agent/skills.json                          | 主 Skill 的名称、版本、来源清单          |
| .ai-agent/skill-sources.json                   | 固定公共包的来源与哈希                   |
| .ai-agent/project.json、acceptance-policy.json | 检查注册、选择和风险证据政策             |
| ai/skills、ai/checks、ai/scripts               | Skill、项目适配及持久工具                |
| AGENTS.md、各客户端 skills 目录                | 生成入口，不手工维护第二份规范           |
| docs/ai-delivery/local                         | 本机活动接入组合、拥有文件和管理区块哈希 |
| docs/ai-delivery/backups                       | 原文件及安装更新备份                     |
| docs/intake、docs/tasks、docs/workflow         | 收件、证据、交付和真实状态               |

同一项目优先随工程分发 ai/ 与 .ai-agent/，所有人使用相同版本；多个项目开始复用时再建设通用版本化技能包。工程 Skill 依赖当前仓库，不适合直接复制成全局包。个人辅助 Skill 独立维护。

当前 `.gitignore` 忽略 node_modules、dist、unpackage、.DS_Store 等生成物；`ai/` 与 `.ai-agent/` 应随工程提交，`docs/ai-delivery/` 下的 local 备份与测试产物属于本机资料。把维护源交给同事后，生成入口的处理策略也要一并说明，不能只发送 docs 内的使用手册。

当前用户的 Git、工程启动、电脑/浏览器及发布边界保持原约定。团队推广时按团队授权维护共同规则，每个人的额外限制放自己的客户端配置，不把接入理解为扩大权限。
