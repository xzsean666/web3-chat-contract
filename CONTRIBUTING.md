# Contributing to EVM Chat State Storage Protocol

感谢对 EVM Chat State Storage Protocol 的关注。为保证代码库的高质量、安全性与一致性，请严格遵守以下开发规范与流程。

---

## 1. 固定技术栈与工具链要求
- **包管理器**: 统一使用 `pnpm`（版本 >= 9.x / 10.x / 12.x）。严禁使用 `npm` 或 `yarn`。
- **智能合约开发框架**: Hardhat + Solidity (`0.8.24`, EVM target `cancun`)。
- **标准合约库**: OpenZeppelin Contracts (`@openzeppelin/contracts`)。
- **链下交互与测试**: TypeScript + `viem`。
- **严格禁止**: 自行引入或切换至 Foundry / Forge、ethers.js、web3.js 或其他框架。

---

## 2. 仓库 Monorepo 目录结构
```text
contracts/        # 智能合约源码与接口
  ├── ChatStorageFactory.sol
  ├── GroupImplementation.sol
  ├── RelationshipManager.sol
  ├── UserImplementation.sol
  └── interfaces/
test/             # Hardhat 智能合约测试套件 (TypeScript + viem)
scripts/          # 部署、运维脚本 (TypeScript + viem)
deployments/      # 多链部署产物与元数据
sdk/              # 强类型 TypeScript SDK (@web3-chat/sdk, 基于 viem)
docs/             # 系统架构、部署与 AI 事实源规范文档 (docs/AI/)
```

---

## 3. 开发工作流 (Development Workflow)
1. **安装依赖**:
   ```bash
   pnpm install
   ```
2. **编译合约与 SDK**:
   ```bash
   pnpm run build
   ```
3. **运行合约测试 (Hardhat Test)**:
   ```bash
   pnpm run test:contracts
   ```
4. **运行 SDK 测试**:
   ```bash
   pnpm run test:sdk
   ```
5. **一键运行全量测试**:
   ```bash
   pnpm run test:all
   ```

---

## 4. Git 提交与 GitHub 认证路由规范
- 本仓库位于 `/ssd0/git/web3-chat-contract`，必须使用 GitHub 账号 **`xzsean666`**。
- 操作前切换账号：
  ```bash
  gh auth switch --user xzsean666
  ```
- 遵循 Conventional Commits 规范（如 `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`）。
- 禁止使用破坏性 git 指令（如 `git reset --hard`, `git checkout .`）。
