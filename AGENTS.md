# AGENTS.md - web3-chat-contract 仓库规范与开发准则

## 1. 账号与认证路由规范 (GitHub CLI & Git Account Routing)
- 本仓库位于 `/ssd0/git/web3-chat-contract`，绑定的 GitHub 账号必须严格为 **`xzsean666`**。
- 执行任何 `gh` 命令（如 `gh pr create`、`gh issue`、`gh repo` 等）或需要 GitHub 认证的 Git 操作前，必须确保 `gh` 当前活跃账号为 `xzsean666`：
  ```bash
  gh auth switch --user xzsean666
  ```
- 提交前可通过 `gh auth status` 进行检查。

## 2. 工具链与环境铁律
- **Node.js 包管理器**: 一律使用 `pnpm`（严禁使用 `npm` 或 `yarn`）。
- **Python 脚本与环境**: 一律使用 `uv`。
- **Git / PR 管理**: 一律使用 `gh` CLI。
- **智能合约开发框架**: 使用 Foundry（`forge`, `cast`, `anvil`），编译器采用 Solidity `0.8.24` (EVM target `cancun`)。

## 3. 智能合约开发纪律
- 严格遵循《通用区块链智能合约项目 AI Agent 开发规范与提示词》（详见 `docs/AI_BLOCKCHAIN_AGENT_PROMPT.md`）。
- 单任务单 Session 原则：一次只处理一个 Task，杜绝随手改动非白名单文件。
- CEI 模式与防重入：状态更改优先于外部交互，防止重入攻击与非法回调。
- 零破坏性操作：严禁 `git reset --hard`、`git checkout .` 等破坏性指令。
- 事实来源：以 `docs/AI/GOAL.md`、`docs/AI/ARCHITECTURE.md`、`docs/AI/DECISIONS.md`、`docs/AI/TASK_INDEX.md`、`docs/AI/SESSION_STATE.md` 为核心事实依据。
