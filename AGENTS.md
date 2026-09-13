# AGENTS.md - web3-chat-contract 仓库规范与开发准则

## 1. 账号与认证路由规范 (GitHub CLI & Git Account Routing)
- 本仓库位于 `/ssd0/git/web3-chat-contract`，绑定的 GitHub 账号必须严格为 **`xzsean666`**。
- 执行任何 `gh` 命令（如 `gh pr create`、`gh issue`、`gh repo` 等）或需要 GitHub 认证的 Git 操作前，必须确保 `gh` 当前活跃账号为 `xzsean666`：
  ```bash
  gh auth switch --user xzsean666
  ```
- 提交前可通过 `gh auth status` 进行检查。

## 2. 固定技术栈与工具链铁律
本项目技术栈固定，不得自行更换：
- **智能合约开发框架**: Solidity (`0.8.24`, EVM target `cancun`) + Hardhat
- **开发语言**: TypeScript
- **标准合约库**: OpenZeppelin Contracts (`@openzeppelin/contracts`)
- **SDK**: TypeScript + viem
- **包管理器**: 统一使用 `pnpm`（严禁使用 `npm` 或 `yarn`）
- **合约测试**: Hardhat Test（基于 TypeScript + viem，严禁 ethers.js / web3.js）
- **Python 脚本与环境**: 一律使用 `uv`
- **Git / PR 管理**: 一律使用 `gh` CLI

**禁止自行引入或切换**:
- Foundry / Forge
- ethers.js
- web3.js
- 其他 Solidity Framework

## 3. 项目 Monorepo 目录结构规范
项目采用统一 Monorepo 规范：
```text
contracts/      # 智能合约源码与接口 (Solidity)
test/           # Hardhat 智能合约测试套件 (TypeScript + viem)
scripts/        # 部署与运维任务脚本 (TypeScript + viem)
deployments/    # 多链部署元数据与产物记录
sdk/            # 强类型 TypeScript SDK (@web3-chat/sdk, 基于 viem)
docs/           # 系统架构与 AI 事实源规范文档 (docs/AI/)
```

## 4. 智能合约与工程开发纪律
1. **严格遵循 Universal Hardhat + SDK Blockchain Engineering Agent Protocol**（详见 `docs/AI_BLOCKCHAIN_AGENT_PROMPT.md`）。
2. **单任务单 Session 原则**：一次只处理一个 Task，杜绝随手改动非白名单文件。
3. **CEI 模式与防重入**：状态更改优先于外部交互（Checks-Effects-Interactions），防止重入与非法调用。
4. **零破坏性操作**：严禁 `git reset --hard`、`git checkout .` 等破坏性指令，严禁覆盖用户已有修改。
5. **事实来源 (Source of Truth)**：
   - `AGENTS.md`、`CONTRIBUTING.md`
   - `docs/AI/GOAL.md`
   - `docs/AI/ARCHITECTURE.md`
   - `docs/AI/DECISIONS.md`
   - `docs/AI/TASK_INDEX.md`
   - `docs/AI/SESSION_STATE.md`
   - `docs/AI/tasks/TASK-xxx.md`
6. **代码修改前强制执行 Pre-Flight Plan**，修改后在终端执行真实验证，Session 结束前严格输出 Session Handover 并更新 `docs/AI/SESSION_STATE.md`。
