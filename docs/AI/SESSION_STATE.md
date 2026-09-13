# EVM Chat State Storage Protocol - 会话状态记录 (SESSION_STATE.md)

## 1. 当前基本状态 (Session Basics)

- **Current Goal**: EVM Chat State Storage Protocol 冷启动与文档规范确立 (Bootstrap Protocol)
- **Current Task**: TASK-001 (核心规范、接口定义、数据类型、自定义错误与事件体系)
- **Current Status**: `TODO` (冷启动文档与脚手架已就绪，TASK-001 前置依赖已满足)
- **Updated Timestamp**: 2026-09-13

---

## 2. 本次实质产物 (Completed Content in Phase 0)

1. **工程环境与依赖脚手架建立**：
   - 初始化标准 Foundry 工程，安装 `forge-std` 与 `@openzeppelin/contracts` (v5.7.0)；
   - 建立 `foundry.toml`：配置 Solidity `0.8.24`、EVM target `cancun`、优化器 runs=200、多链 RPC 与格式化规范；
   - 建立 `AGENTS.md`：严格落实 `/ssd0/git` 账号路由规则（指定 GitHub 账号 `xzsean666`，遵循 `pnpm` / `uv` / `gh` 铁律）；
   - 建立 Monorepo 协同架构：`pnpm-workspace.yaml`、根目录 `package.json` 及 `sdk/` 子包（`@web3-chat/sdk`），配置 `viem` + `tsup` + `vitest`；
   - 建立 `.env.example` 与 `.gitignore`。
2. **AI 标准工程文档体系 (Source of Truth)**：
   - `docs/AI_BLOCKCHAIN_AGENT_PROMPT.md`: 通用区块链智能合约 AI Agent 研发规范全集；
   - `docs/DEPLOYMENT.md`: 多链部署架构、Anvil 本地沙箱演练与验证指南；
   - `docs/AI/GOAL.md`: 协议目标、技术原则、包含 `@web3-chat/sdk` 的完整 MVP 范围划定；
   - `docs/AI/ARCHITECTURE.md`: 系统拓扑、存储紧凑打包（Slot Packing）、数学不变量、威胁模型及 SDK 门面类图；
   - `docs/AI/DECISIONS.md`: ADR-001 ~ ADR-008 架构决策记录（含 SDK 架构、RPC 池负载均衡与 Multicall3 批量调用选型）；
   - `docs/AI/TASK_INDEX.md`: TASK-001 至 TASK-011 依赖拓扑与任务清单；
   - `docs/AI/tasks/TASK-001.md`, `TASK-010.md`, `TASK-011.md`: 任务卡片。

---

## 3. 变更与新建文件清单 (File Registry)

- **新建文件**:
  - `AGENTS.md`
  - `package.json`
  - `pnpm-workspace.yaml`
  - `.gitignore`
  - `foundry.toml`
  - `.env.example`
  - `sdk/package.json`
  - `sdk/tsconfig.json`
  - `sdk/src/index.ts`
  - `docs/AI_BLOCKCHAIN_AGENT_PROMPT.md`
  - `docs/DEPLOYMENT.md`
  - `docs/AI/GOAL.md`
  - `docs/AI/ARCHITECTURE.md`
  - `docs/AI/DECISIONS.md`
  - `docs/AI/TASK_INDEX.md`
  - `docs/AI/tasks/TASK-001.md`
  - `docs/AI/tasks/TASK-010.md`
  - `docs/AI/tasks/TASK-011.md`
  - `docs/AI/SESSION_STATE.md`
- **清理文件**:
  - 清理 Foundry 默认模板（`src/Counter.sol`, `script/Counter.s.sol`, `test/Counter.t.sol`）

---

## 4. 运行验证命令与结果 (Verification Evidence)

```bash
# 1. 验证 Foundry 编译与工具链可用性
$ forge --version
forge Version: 1.8.1 (982849d314 2026-08-28T17:46:00.964391484Z)
✔ Exit code: 0

# 2. 验证 OpenZeppelin 依赖与 remappings
$ forge remappings
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
✔ Exit code: 0

# 3. 验证当前编译状态
$ forge build
Compiler run successful!
✔ Exit code: 0
```

---

## 5. 存储与网络状态 (Storage & Network State)

- **Storage Layout**: 处于冷启动阶段，具体存储布局已在 `docs/AI/ARCHITECTURE.md` 完成规划。
- **Networks**: 本地 Anvil (31337) 与主流 EVM 网络已在 `foundry.toml` 预置。

---

## 6. 未决问题与风险假设 (Risks & Open Questions)

- **暂无阻塞项**。接口实现时需严格对齐 `docs/AI/ARCHITECTURE.md` 中的字节打包与尺寸限制（User 4KB, Group 8KB, Member 2KB）。

---

## 7. 下一步任务与交接指引 (Next Step)

- **Next Task**: `TASK-001: 核心规范、接口定义、数据类型、自定义错误与事件体系`
- **Next Files to Read**:
  - `docs/AI/GOAL.md`
  - `docs/AI/ARCHITECTURE.md`
  - `docs/AI/tasks/TASK-001.md`
