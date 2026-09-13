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
                         Chat Application
                                │
                                ▼
                           Chat SDK
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
           User               Group              Registry
            │                   │                   │
            ▼                   ▼                   ▼
        User Clone          Group Clone       Global Index
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
                                ▼
                            EVM Chain
                                │
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
              Chat Backend             Off-chain Storage
                    │                       │
                    ├── Messages            ├── Voice
                    ├── Realtime            ├── Files
                    └── Business Logic      └── Large Data
```

---

## 3. 核心设计原则 (Design Principles)

1. **轻量克隆模式 (Factory + Clones / ERC-1167)**：每个 User 和 Group 均为独立 Minimal Proxy，拥有独立状态空间与独立地址，共享经过安全审计的 Implementation 逻辑。
2. **状态与展示解耦 (JSON Metadata Paradigm)**：核心状态与权限采用强类型校验；展示型数据（Avatar、Bio、Group Rules、Titles 等）采用 UTF-8 JSON `bytes` 统一存储，避免合约频繁升级。
3. **数据主权隔离 (Data Sovereignty)**：个人数据归个人，群数据归群主，群内名片归成员本人，好友备注归备注人本人。
4. **Current State 与 History 分离**：链上合约仅存储当前最新有效状态，完整历史变更由标准 Events 抛出由链下 Indexer 重建。
5. **极速检索与防 DoS**：所有列表结构均基于映射索引与 Swap-and-Pop 实现 O(1) 删除，所有读取接口强制支持 `(offset, limit)` 分页截断。

---

## 4. 目录结构规范 (Project Structure)

```text
.
├── src/                           # 智能合约源码
│   ├── interfaces/                # 规范接口定义 (IChatStorageFactory, IUserImplementation...)
│   ├── UserImplementation.sol     # 用户状态容器共享逻辑 (V1)
│   ├── GroupImplementation.sol    # 群组状态容器共享逻辑 (V1)
│   ├── RelationshipManager.sol    # 双向好友协调器
│   └── ChatStorageFactory.sol     # 全局工厂与注册索引
├── test/                          # 测试套件
│   ├── unit/                      # 单元与边界测试
│   ├── fuzz/                      # 模糊测试与不变量测试
│   └── integration/               # 端到端集成测试
├── script/                        # 部署与运维脚本
│   └── Deploy.s.sol               # 幂等自动化部署脚本
├── docs/                          # 工程文档体系
│   ├── AI_BLOCKCHAIN_AGENT_PROMPT.md  # 智能合约 Agent 研发铁律
│   ├── DEPLOYMENT.md                  # 多链部署与运维指南
│   └── AI/
│       ├── GOAL.md                    # 协议愿景与 MVP 范围
│       ├── ARCHITECTURE.md            # 系统拓扑、存储布局与安全规范
│       ├── DECISIONS.md               # 架构决策记录 (ADR-001 ~ ADR-006)
│       ├── TASK_INDEX.md              # 任务依赖拓扑与索引表
│       ├── SESSION_STATE.md           # 跨会话执行状态持久化
│       └── tasks/
│           └── TASK-001.md            # 任务卡片
├── foundry.toml                   # Foundry 核心配置文件
├── AGENTS.md                      # 仓库规则与 GitHub 账号路由规范
├── package.json                   # pnpm 脚本配置
└── .env.example                   # 环境变量模板
```

---

## 5. 开发与测试指令 (Development & Testing)

```bash
# 依赖安装
pnpm install

# 编译合约
forge build

# 运行完整测试套件
forge test -vvv

# 查看 Gas 消耗报告
forge test --gas-report

# 代码风格格式化
forge fmt

# 风格检查
forge fmt --check
```

---

## 6. 许可证 (License)

[MIT](LICENSE)
