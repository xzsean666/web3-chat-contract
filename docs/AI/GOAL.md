# EVM Chat State Storage Protocol - 目标与范围规范 (GOAL.md)

## 1. Project Overview (项目愿景与定位)

**EVM Chat State Storage Protocol** 是一个基于 EVM 智能合约的通用聊天状态存储协议（Chat State Storage Protocol）。

该协议**不负责聊天消息的存储与传输**，而是为去中心化与 Web3 聊天应用提供一个**链上可信、持久化、可防篡改且可验证的状态中枢**。核心愿景是让上层应用或强类型 Chat SDK 能够通过标准化的链上接口无缝获取：
- **Current User**: 用户核心标识与当前状态
- **User Profile & State**: 个人展示资料与隐私/通知等配置状态（通过可扩展 UTF-8 JSON 表达）
- **Social Relationships & Friends**: 双向确认的好友关系、申请流转、静音与黑名单
- **Friend Metadata**: 用户对好友的本地化个人备注与标签
- **Groups & Group State**: 独立的群组容器、群配置与生命周期状态
- **Group Membership & Permissions**: 结构化的群成员资格、精细化角色（Owner / Admin / Moderator / Member）与风控（Ban / Mute）
- **Global Discovery**: 全局用户与群组发现、双向映射与成员资格索引

### 核心设计哲学
> **“User 自己管理自己的个人状态和社交关系；Group 管理自己的群状态和成员状态；Factory 负责全局索引和对象发现；Metadata 使用可扩展 JSON；消息和实时数据保持在链下。”**

---

## 2. Core Design Goals (核心技术目标)

1. **轻量化克隆模式 (Factory + Clones / ERC-1167)**：
   - User 与 Group 均通过 Factory 创建轻量级 Minimal Proxy (Clone)。
   - 每个 Clone 拥有独立的 EVM 存储槽与隔离状态空间，同时共享 `UserImplementation` 与 `GroupImplementation` 逻辑字节码，大幅降低创建 Gas（创建成本降低 90%+）。
2. **状态与展示分离 (JSON Metadata Paradigm)**：
   - 核心业务、权限和关系校验使用强类型 Solidity 状态变量；
   - 展现层数据（Avatar、Bio、Social Links、Group Rules、Member Group Titles）统一使用 UTF-8 JSON `bytes` 存储，避免因前端 UI 需求变更加剧合约升级。
   - 施加严格的字节尺寸限制（User/State ≤ 4KB, Group ≤ 8KB, Member/Friend ≤ 2KB），防止被滥用为通用网盘。
3. **数据主权与最小特权原则 (Data Sovereignty)**：
   - 个人全局数据仅允许 User 自己修改；
   - 好友备注（Friend Metadata）仅归属于备注人自己，对方无权篡改；
   - 群内个人资料（Member Metadata）仅该成员本人可修改，Admin 无权代改；
   - 群公共元数据（Group Metadata）与设置由 Group Owner 管理；
   - 封禁与静音权限受层级角色保护（Admin/Moderator）。
4. **Current State 与 History 分离 (State vs Event)**：
   - 合约存储仅维护“当前最新有效状态”（如当前好友列表、当前有效群成员、当前未关闭群组）；
   - 状态流转全过程发射标准化高信息量 Event，供链下 Indexer / Subgraph 重建完整历史时间线，大幅减少存储开销。
5. **用户/群组双向中心化查询接口 (User-centric & Group-centric Query API)**：
   - 支持 SDK 一站式拼装 `getCurrentUser()` 与 `getGroupOverview()`；
   - 全链路数组查询强制支持分页（`offset`, `limit`），彻底杜绝大数组遍历导致的 Gas 耗尽。
6. **Gas 优化与批处理能力 (Batch Operations)**：
   - 针对群主/管理员高频运维场景，原生支持批量加人、批量踢人、批量禁言、批量封禁，并在群组创建时支持 `initialMembers[]` 预装载。

---

## 3. MVP Scope (功能范围划定)

### 3.1 Included in MVP (首期明确实现范围)

#### A. ChatStorageFactory (全局工厂与注册表)
- [x] `createUser()`: 为调用者部署其专属 UserClone 并完成绑定注册
- [x] `createGroup(metadata, initialMembers, joinMode, maxMembers)`: 部署 GroupClone 并登记全局索引
- [x] `getUserContract(address user)`: 查询用户对应的 UserClone 合约地址
- [x] `getGroup(uint256 groupId)`: 查询指定群 ID 对应的 GroupClone 合约地址
- [x] `getGroupId(address groupAddress)`: 查询指定 GroupClone 对应的群 ID
- [x] `groupCount()` 与 `getGroups(offset, limit)`: 全局群组发现与分页检索
- [x] `getUserGroups(user, offset, limit)`: 维护用户当前参与的有效群组列表（支持高效 swap-and-pop 维护）
- [x] Clone 鉴权：仅接受 Factory 生产的合法 Clone 上报成员资格变更通知

#### B. User Object (个人状态与社交容器)
- [x] **Core State**: 账号地址 `account`、状态 `status` (`ACTIVE`, `DISABLED`)
- [x] **User Metadata**: 全局展示资料（UTF-8 JSON，≤ 4KB，受版本号 `metadataVersion` 管理）
- [x] **User State**: 个人偏好与设置（UTF-8 JSON，≤ 4KB，受版本号 `stateVersion` 管理）
- [x] **Friends Management**:
  - 好友记录：状态 (`NONE`, `PENDING_IN`, `PENDING_OUT`, `FRIEND`, `BLOCKED`)、`since`、`mutedUntil`
  - 好友查询：`isFriend(addr)`、`getFriend(addr)`、`getFriends(offset, limit)`、`friendCount()`
  - 好友备注：`setFriendMetadata(friend, bytes)`（≤ 2KB）
  - 好友静音：`muteFriend(friend, duration)`、`unmuteFriend(friend)`
- [x] **Block Management**:
  - `block(address)`：解除好友关系、移出好友列表、加入黑名单、阻止再次申请
  - `unblock(address)`：恢复为 NONE 状态（不自动恢复好友）
  - `isBlocked(address)`：黑名单判定

#### C. RelationshipManager (双向好友协调器)
- [x] 协调 Alice 与 Bob 之间的双向状态机流转：
  - `sendFriendRequest(target)`: Alice 发送申请（Alice: PENDING_OUT, Bob: PENDING_IN）
  - `acceptFriendRequest(requester)`: Bob 接受申请（双方跃迁为 FRIEND，记录 since）
  - `rejectFriendRequest(requester)`: Bob 拒绝申请（双方重置为 NONE）
  - `cancelFriendRequest(target)`: Alice 撤销申请（双方重置为 NONE）
  - `removeFriend(friend)`: 单方解除好友关系（双方均从当前好友列表中移出）
- [x] 黑名单前置校验：若被对方拉黑，直接拦截好友申请

#### D. Group Object (群组容器与成员管理)
- [x] **Core State**: `groupId`, `owner`, `pendingOwner`, `status` (`ACTIVE`, `PAUSED`, `CLOSED`), `memberCount`, `joinMode` (`PUBLIC`, `INVITE_ONLY`, `ADMIN_ONLY`, `CLOSED`), `maxMembers`
- [x] **Group Metadata**: 公共资料（UTF-8 JSON，≤ 8KB，仅 Owner 可写）
- [x] **Membership Management**:
  - `join()`, `leave()`
  - `addMember(user)`, `removeMember(user)`
  - 批量操作：`batchAddMembers(users[])`, `batchRemoveMembers(users[])`
  - 成员状态：`NONE`, `MEMBER`, `BANNED`
  - 成员查询：`isMember(user)`, `getMember(user)`, `getMembers(offset, limit)`
- [x] **Roles & Permissions**:
  - 角色等级：`OWNER` > `ADMIN` > `MODERATOR` > `MEMBER`
  - `grantRole(user, role)`, `revokeRole(user)`
  - 严格防范权限提升越权（禁止低角色向高角色提权）
  - 两步所有权转移：`transferOwnership(newOwner)` -> `acceptOwnership()`
- [x] **Moderation (风控管控)**:
  - 禁言：`mute(user, duration)`, `unmute(user)`, `batchMuteMembers(users[], duration)`
  - 封禁：`ban(user, duration)`, `unban(user)`, `batchBanMembers(users[], duration)`, `batchUnbanMembers(users[])`
- [x] **Member Metadata**: 成员在特定群内的个人名片（UTF-8 JSON，≤ 2KB，仅成员本人可写）
- [x] **Invites**:
  - `createInvite(code, expiresAt, maxUses)`, `useInvite(code)`, `revokeInvite(code)`
- [x] **Group Lifecycle**:
  - `pause()`, `resume()`, `close()`（关闭为终态，不强制链上全量遍历清理成员，保留低 Gas 表现）

---

### 3.2 Excluded from MVP (明确排除的非本期内容)

1. **聊天消息与多媒体存储**：消息正文、语音、视频、文件等保持在链下（IPFS / Arweave / 业务后端）。
2. **实时通信与连接层**：WebSocket 会话管理、在线状态（Online Status）、正在输入（Typing Indicator）。
3. **消息已读与送达回执**：Read Receipts, Delivery Acknowledgements。
4. **复杂端到端密钥分发协议**：Double Ratchet 等前向安全密钥协商机制留给上层密码学模块。
5. **DAO 链上投票治理与代币经济模型**：不发行代币，暂不引入 ERC-20 质押机制。
6. **跨链状态自动同步**：首期部署于单个 EVM 网络，暂不包含多链跨链桥或 CCIP 状态同步。
