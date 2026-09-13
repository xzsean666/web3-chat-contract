# TASK-013: 架构与工程工具链统一为 Universal Hardhat + TypeScript Viem 规范

## 任务目标
将代码仓库架构与开发工具链严格统一为用户设计的 **Universal Hardhat + SDK Blockchain Engineering Agent Protocol**。
遵循约束：智能合约与 SDK 代码已完成，保持零业务逻辑与代码改动，统一工具链、目录规范与工程文档体系。

## 任务范围
1. **目录体系统一为 Monorepo 标准规范**:
   - `contracts/` (由 `src/` 平移，合约源码与接口保持 100% 原始代码不变)
   - `test/` (Hardhat 智能合约测试套件，全面采用 TypeScript + Viem，严禁 ethers.js / web3.js)
   - `scripts/` (TypeScript 部署与运维脚本，采用 Viem)
   - `deployments/` (多链部署元数据与产物目录)
   - `sdk/` (TypeScript + Viem SDK，保持代码不变)
   - `docs/` (文档与 AI 事实源体系)
2. **固定技术栈落地**:
   - Solidity + Hardhat
   - TypeScript
   - OpenZeppelin Contracts (npm `@openzeppelin/contracts`)
   - SDK: TypeScript + viem
   - 包管理器: pnpm
   - 合约测试: Hardhat Test
   - 彻底清除 Foundry / Forge、ethers.js、web3.js 及遗留文件。
3. **配置文件与测试套件**:
   - 配置 `hardhat.config.ts` (0.8.24, cancun, viem, paths) 与 `tsconfig.json`。
   - 编写 TypeScript + Viem 的 Hardhat 测试套件，覆盖 Factory, User, Group, Relationship 及端到端流程。
   - 配置 `scripts/deploy.ts` 部署脚本。
4. **文档与事实源全面对齐**:
   - `AGENTS.md`
   - `CONTRIBUTING.md`
   - `docs/AI_BLOCKCHAIN_AGENT_PROMPT.md`
   - `docs/AI/GOAL.md`
   - `docs/AI/ARCHITECTURE.md`
   - `docs/AI/DECISIONS.md` (ADR-007)
   - `docs/AI/TASK_INDEX.md`
   - `docs/AI/SESSION_STATE.md`
   - `docs/DEPLOYMENT.md`
   - `README.md`

## 验收标准
1. `pnpm run build:contracts` (使用 Hardhat compile) 编译通过。
2. `pnpm run test:contracts` (使用 Hardhat test) 自动化测试全部通过。
3. `pnpm run build:sdk` 编译成功。
4. `pnpm run test:sdk` (SDK 单元与 E2E 测试) 全部通过。
5. `pnpm run test:all` 一键全量测试全部通过。
6. 无任何 Foundry / Forge / ethers.js / web3.js 遗留依赖。
7. 全套文档和事实源更新完毕。
