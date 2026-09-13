# EVM Chat State Storage Protocol - 架构决策记录 (DECISIONS.md)

本文档记录 EVM Chat State Storage Protocol 在设计与实现过程中的核心架构决策记录 (Architecture Decision Records, ADR)。

---

## ADR-001: 采用轻量克隆模式 (EIP-1167 Clones) 替代单合约大租户模型或独立全量部署

- **状态**: Accepted
- **背景**:
  协议需要支持成千上万的用户与群组。如果为每个用户/群组完整部署一个全量智能合约，Gas 成本极高（单次部署数百至数千美元）；如果采用单一大合约集中存储（Multi-tenant Mapping），则不仅权限与存储边界模糊，而且单点状态膨胀风险极大。
- **备选方案对比**:
  1. *全量独立合约部署*: 隔离性极强，但 Gas 成本极其昂贵，无法商用。
  2. *单一大合约全局多租户存储*: 部署成本低，但存储槽无限膨胀，租户间无独立地址，各模块缺乏清晰的 EVM 边界。
  3. *EIP-1167 Minimal Proxy (Clones)*: 仅需 ~45,000 Gas 即可部署一个独立代理实例，每个代理拥有独立存储空间与唯一地址，同时共享经过充分审计的 Implementation 逻辑。
- **决策**:
  全面采用 OpenZeppelin `Clones`（EIP-1167），Factory 负责部署并注册 UserClone 与 GroupClone。

---

## ADR-002: 非关键展示数据采用 UTF-8 JSON `bytes` 存储替代固定 Solidity 结构体

- **状态**: Accepted
- **背景**:
  社交与聊天应用的 Profile / State 需求变化频繁（如新增 Twitter、Discord、Telegram、自定义社交勋章、主题颜色、通知开关等）。如果将所有字段硬编码在 Solidity 结构体中，任何 UI 字段扩展都需要修改并升级合约，导致存储槽布局升级极其复杂。
- **备选方案对比**:
  1. *Solidity 固定 Struct (如 string name, string avatar...)*: 强类型约束好，但任何新增展示字段均属于破坏性变更，升级维护成本极高。
  2. *字符串 Key-Value 映射 (mapping(string => string))*: 灵活度高，但每次字段读写都需要多次 SLOAD / SSTORE，Gas 消耗呈倍数增加。
  3. *UTF-8 JSON `bytes` 整体存储*: 结构完全解耦，合约只负责存储、权限控制、尺寸校验与版本号管理；链下 SDK 负责灵活序列化与解析。
- **决策**:
  采用 UTF-8 JSON `bytes` 统一存储 User Profile、User State、Group Profile、Member Group Profile 与 Friend Metadata，并在合约中强制设定尺寸上限（2KB ~ 8KB）。

---

## ADR-003: 引入独立的 RelationshipManager 协调双向好友握手

- **状态**: Accepted
- **背景**:
  社交好友必须是双方同意的双向关系（Bob 必须同意 Alice 的好友申请）。若直接由 Alice 的 UserClone 向 Bob 的 UserClone 发起跨合约调用，极易产生复杂的互相鉴权依赖与循环依赖。
- **备选方案对比**:
  1. *Clone 间直接 Peer-to-Peer 调用*: Alice Clone 直接调用 Bob Clone，但需要双方 Clone 互相验证对方是否为合法注册的 Clone，权限逻辑复杂。
  2. *集中在 UserImplementation 内部处理*: 用户每次操作都需要先通过 Factory 解析目标地址，逻辑臃肿。
  3. *独立的 RelationshipManager 协同器*: 由 Factory 认证的 RelationshipManager 统一调度申请、接受、拒绝、解除与黑名单核验，UserClone 仅开放专供 RelationshipManager 调用的状态变更接口。
- **决策**:
  引入 `RelationshipManager` 专门处理双向好友握手生命周期，逻辑高内聚，职责边界清晰。

---

## ADR-004: 数组管理采用 Swap-and-Pop 与全链路强制分页查询

- **状态**: Accepted
- **背景**:
  用户的好友列表、群组的成员列表以及用户的群组参与列表，在真实生产场景中可能达到数千至数万级。Solidity 动态数组若直接全量返回或在中间删除元素，会导致遍历 Gas 消耗突破区块上限（Gas Limit DoS）。
- **备选方案对比**:
  1. *无序数组 + 遍历删除*: 时间复杂度 O(N)，成员量大时直接耗尽 Gas。
  2. *有序链表*: 插入和删除消耗较多存储槽。
  3. *地址映射索引 + 数组 Swap-and-Pop + 分页 Getter*: 删除操作 O(1)（将末尾元素搬移到待删除位置并 `pop()`），查询强制提供 `(offset, limit)`。
- **决策**:
  所有列表数据结构均采用 `address[] / uint256[]` + `mapping(...)` 索引，删除采用 Swap-and-Pop 达到 O(1) Gas 消耗；对外读取接口强制实施 `(offset, limit)` 分页截断。

---

## ADR-005: 采用两步确认的所有权转移机制 (Ownable2Step Pattern)

- **状态**: Accepted
- **背景**:
  群组拥有最高管理特权（设置资料、任命管理员、解散群组）。若单步 `transferOwnership` 误传了无效地址或非预期地址，将导致群组所有权永久灭失。
- **决策**:
  采用 `transferOwnership(newOwner)`（登记为 `pendingOwner`）+ `acceptOwnership()`（新所有者主动接受）的两步确认模式，彻底杜绝误设黑洞地址。

---

## ADR-006: Factory 对 GroupClone 实施强鉴权与白名单保护

- **状态**: Accepted
- **背景**:
  Factory 维护了全局 `user => currentGroupIds` 索引。当用户加入或退出群组时，需要通知 Factory 增删该索引。如果该接口无权限保护，恶意第三方可伪造群组调用 Factory 篡改任意用户的群组列表。
- **决策**:
  Factory 在 `createGroup` 时将部署的 GroupClone 记录到 `_isGroupClone[cloneAddress] = true`；内部回调接口（`onUserJoinedGroup`, `onUserLeftGroup`）必须校验 `require(_isGroupClone[msg.sender])`，严格阻断伪造调用。
