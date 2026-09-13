# EVM Chat State Storage Protocol - Deployment & Operation Guide

## 1. 部署架构概述 (Deployment Architecture)

EVM Chat State Storage Protocol 采用轻量化工厂克隆模式（Factory + Clones / ERC-1167），多合约协同拓扑如下：

```text
1. Deploy UserImplementation (Logic V1)    ──┐
2. Deploy GroupImplementation (Logic V1)   ──┼──> 4. Deploy ChatStorageFactory
3. Deploy RelationshipManager              ──┘
```

- **UserImplementation**: 共享逻辑合约。构造函数中调用 `_disableInitializers()` 封禁逻辑实例。
- **GroupImplementation**: 共享逻辑合约。构造函数中调用 `_disableInitializers()` 封禁逻辑实例。
- **RelationshipManager**: 状态协调合约，管理 User 间的双向好友申请、接受、拒绝与拉黑。
- **ChatStorageFactory**: 协议全局注册表与索引中心。绑定 Implementation 地址与 RelationshipManager 地址，验证 Clone 合法性，管理用户当前参与的群组索引。

---

## 2. 目标网络配置 (Target Networks)

| Network | Chain ID | Currency | Block Explorer | Configured RPC Env |
|---|---|---|---|---|
| Hardhat / Localhost | 31337 | ETH | N/A | `http://127.0.0.1:8545` |
| Ethereum Sepolia | 11155111 | SepoliaETH | https://sepolia.etherscan.io | `SEPOLIA_RPC_URL` |
| Base Sepolia | 84532 | ETH | https://sepolia.basescan.org | `BASE_SEPOLIA_RPC_URL` |
| Base Mainnet | 8453 | ETH | https://basescan.org | `BASE_RPC_URL` |
| Arbitrum One | 42161 | ETH | https://arbiscan.io | `ARBITRUM_RPC_URL` |
| Optimism | 10 | ETH | https://optimistic.etherscan.io | `OPTIMISM_RPC_URL` |

---

## 3. 部署前检查清单 (Pre-flight Checklist)

1. **环境与私钥安全**：
   - 确认 `.env` 中已注入 `PRIVATE_KEY` 与对应网络的 RPC URL 及 Explorer API Key。
   - 确认部署账户在目标链上具有充足的原生代币（建议至少 0.05 ~ 0.2 ETH 用于覆盖 Gas 费）。
2. **代码与编译验证**：
   - 执行 `pnpm run build` 确保 0 警告 0 报错。
   - 执行 `pnpm run test:all` 确保合约 Hardhat 测试与 SDK 测试 100% 通过。
3. **本地模拟演练**：
   - 运行本地部署模拟（Dry-Run）验证部署脚本的幂等性与产物输出：
     ```bash
     node scripts/deploy.ts
     ```

---

## 4. 自动化部署流程 (Execution Steps)

### 4.1 本地部署模拟 (Localhost Simulation)
```bash
node scripts/deploy.ts
```

### 4.2 测试网/生产网部署
```bash
# 执行 TypeScript 部署脚本
node scripts/deploy.ts
```

---

## 5. 合约验证与元数据持久化 (Verification & Manifests)

部署脚本自动输出部署元数据至 `deployments/<chainId>.json`，包含：
- `network`: 网络名称
- `chainId`: 链 ID
- `timestamp`: 部署时间戳
- `deployer`: 部署者地址
- `contracts`:
  - `UserImplementation`: 逻辑合约地址
  - `GroupImplementation`: 逻辑合约地址
  - `ChatStorageFactory`: 全局注册表地址
  - `RelationshipManager`: 好友关系协调器地址

---

## 6. Implementation 升级与版本迭代 (Version Migration)

- 协议 Clone 实例默认指向特定版本 Implementation（如 V1）。
- 升级策略：
  1. 部署新的 `UserImplementationV2` 或 `GroupImplementationV2`。
  2. Factory 治理接口更新缺省实现的引用地址。
  3. 新创建的 Clone 将基于新版 Implementation；历史 Clone 保留原有逻辑与稳定状态空间。
