# EVM Chat State Storage Protocol

> **A Universal On-chain Chat State Storage Protocol for EVM Networks.**
> 
> *User 自己管理自己的个人状态和社交关系；Group 管理自己的群状态和成员状态；Factory 负责全局索引和对象发现；Metadata 使用可扩展 JSON；消息和实时数据保持在链下。*

---

## 1. 协议概述 (Overview)

**EVM Chat State Storage Protocol** 专为现代 Web3 / 去中心化社交应用提供**权威、持久化、可验证的链上状态存储层**。

本协议**不存储聊天消息或实时多媒体内容**，而是保存 Chat 应用运行不可或缺的核心状态：
- **User Profile & State**: 个人去中心化名片（可扩展 UTF-8 JSON）与隐私状态
- **Social Relationships & Friends**: 经双方确认的双向好友、关系流转与黑名单
- **Friend Metadata**: 仅个人可见的好友备注与自定义标签
- **Groups & Group State**: 独立的群状态容器、两步所有权与生命周期
- **Membership & Permissions**: 群成员资格、多级角色（Owner / Admin / Moderator / Member）、禁言与封禁
- **Global Indexing**: 全局群组发现与用户群组反向索引（`user -> currentGroupIds`）

---

## 2. 架构拓扑 (Architecture Topology)

```text
Application
    ↓
TypeScript SDK (@web3-chat/sdk, viem)
    ↓
Smart Contract (Hardhat + Solidity 0.8.24 cancun)
    ↓
EVM Blockchain
```

---

## 3. 固定技术栈与 Monorepo 规范

项目遵循 **Universal Hardhat + SDK Blockchain Engineering Agent Protocol**：
- **智能合约**: Solidity 0.8.24 (cancun) + Hardhat
- **外部标准库**: OpenZeppelin Contracts (`@openzeppelin/contracts`)
- **客户端 SDK**: TypeScript + viem (`@web3-chat/sdk`)
- **包管理器**: 统一使用 `pnpm`
- **合约测试**: Hardhat Test (TypeScript + viem)
- **严格禁止**: Foundry / Forge、ethers.js、web3.js

---

## 4. 目录结构规范 (Project Structure)

```text
.
├── contracts/                     # 智能合约源码与接口
│   ├── interfaces/                # 规范接口定义 (IChatStorageFactory, IUserImplementation...)
│   ├── UserImplementation.sol     # 用户状态容器共享逻辑 (V1)
│   ├── GroupImplementation.sol    # 群组状态容器共享逻辑 (V1)
│   ├── RelationshipManager.sol    # 双向好友协调器
│   └── ChatStorageFactory.sol     # 全局工厂与注册索引
├── test/                          # Hardhat 测试套件 (TypeScript + viem)
│   ├── unit/                      # 单元与边界测试
│   └── integration/               # 端到端集成测试
├── scripts/                       # 部署与运维任务脚本 (TypeScript + viem)
│   ├── deploy.ts                  # 幂等自动化部署脚本
│   └── sync-artifacts.js          # 编译产物同步工具
├── deployments/                   # 多链部署元数据与产物记录
├── sdk/                           # 强类型 TypeScript SDK (@web3-chat/sdk)
│   ├── src/                       # SDK 核心源码
│   └── test/                      # SDK 单元与 E2E 测试
├── docs/                          # 工程文档体系
│   ├── AI_BLOCKCHAIN_AGENT_PROMPT.md  # 智能合约 Agent 研发铁律
│   ├── DEPLOYMENT.md                  # 多链部署与运维指南
│   └── AI/                            # AI 架构规范与事实源体系
├── hardhat.config.ts              # Hardhat 核心配置
├── tsconfig.json                  # Root TypeScript 配置
├── AGENTS.md                      # 仓库规则与 GitHub 账号路由规范
├── CONTRIBUTING.md                # 贡献者指南
├── package.json                   # pnpm 脚本配置
└── .env.example                   # 环境变量模板
```

---

## 5. 开发与测试指令 (Development & Testing)

```bash
# 依赖安装
pnpm install

# 编译智能合约与 SDK
pnpm run build

# 运行合约测试套件 (Hardhat Test)
pnpm run test:contracts

# 运行 SDK 测试套件
pnpm run test:sdk

# 一键运行全量测试 (49 项合约 + SDK 测试)
pnpm run test:all

# 本地部署模拟
pnpm run deploy:local
```

---

## 6. SDK 核心特性与用法示例 (SDK Quickstart)

```typescript
import { ChatSDK, parseChatError } from "@web3-chat/sdk";
import { mainnet } from "viem/chains";

const sdk = new ChatSDK({
  factoryAddress: "0x...",
  chain: mainnet,
  rpcPool: {
    rpcUrls: ["https://rpc1...", "https://rpc2..."],
    strategy: "latency-ranked",
  },
});

// 1. 获取用户聚合数据 (单次 RTT 读取)
const userOverview = await sdk.getCurrentUser("0xAlice...");

// 2. 密码学邀请码快速生成与加入
const { secret, codeHash } = ChatSDK.generateInviteCode();
const group = await sdk.group(1n);
await group.createInviteWithSecret(secret, 0n, 10); // 10 次有效
await group.useInviteWithSecret(secret);

// 3. 事件驱动监听 (Event Watching)
const unwatch = sdk.watchFactoryEvents({
  onLogs: (logs) => console.log("New factory event:", logs),
});

// 4. 友好错误解析
try {
  await sdk.relationship().sendRequest("0xBob...");
} catch (err) {
  const { errorName, message } = ChatSDK.parseError(err);
  console.error(`${errorName}: ${message}`);
}
```

---

## 7. 许可证 (License)

[MIT](LICENSE)

