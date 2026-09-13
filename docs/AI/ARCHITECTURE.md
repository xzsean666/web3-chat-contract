# EVM Chat State Storage Protocol - 系统架构与安全规范 (ARCHITECTURE.md)

## 1. System Topology (系统拓扑与调用流向)

### 1.1 总体分层架构
```mermaid
flowchart TD
    subgraph ClientLayer["客户端交互层 (Client & SDK)"]
        UI["Web3 Chat Application / Mobile App"]
        SDK["Chat SDK (Viem / Ethers)"]
        UI --> SDK
    end

    subgraph FactoryLayer["全局索引层 (Factory & Registry)"]
        Factory["ChatStorageFactory\n(Clone 注册表 / User->Group 索引 / 合法性验证)"]
    end

    subgraph StateContainers["状态容器层 (Isolated Clones - EIP-1167)"]
        UserClones["UserClone [Alice, Bob, Charlie...]\n(独立存储 / 个人资料 / 社交关系 / 好友备注)"]
        GroupClones["GroupClone [Group 1, Group 2...]\n(独立存储 / 群资料 / 成员列表 / 角色 / 封禁)"]
    end

    subgraph Coordination["双向协作层 (Coordination)"]
        RelMgr["RelationshipManager\n(双向好友握手 / 申请流转 / 黑名单核验)"]
    end

    subgraph LogicLayer["共享逻辑层 (Shared Implementations)"]
        UserImpl["UserImplementation (V1)"]
        GroupImpl["GroupImplementation (V1)"]
    end

    SDK -->|发现 & 创建| Factory
    SDK -->|读写个人状态| UserClones
    SDK -->|读写群组状态| GroupClones
    SDK -->|发起双向好友操作| RelMgr

    Factory -.->|轻量克隆| UserClones
    Factory -.->|轻量克隆| GroupClones
    UserClones -.->|共享代码| UserImpl
    GroupClones -.->|共享代码| GroupImpl

    RelMgr -->|受权修改关系| UserClones
    GroupClones -->|上报成员变动| Factory
```

### 1.2 好友建立流向图 (Bidirectional Friend Handshake)
```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (User)
    participant SDK as Chat SDK
    participant RelMgr as RelationshipManager
    participant AliceClone as Alice UserClone
    participant BobClone as Bob UserClone
    actor Bob as Bob (User)

    Alice->>RelMgr: sendFriendRequest(bobAddress)
    RelMgr->>BobClone: checkBlocked(aliceAddress)
    BobClone-->>RelMgr: not blocked
    RelMgr->>AliceClone: setRelationship(bob, PENDING_OUT)
    RelMgr->>BobClone: setRelationship(alice, PENDING_IN)
    Note over RelMgr: 触发 FriendRequestSent 事件

    Bob->>RelMgr: acceptFriendRequest(aliceAddress)
    RelMgr->>AliceClone: setRelationship(bob, FRIEND, since=now)
    RelMgr->>BobClone: setRelationship(alice, FRIEND, since=now)
    Note over RelMgr: 触发 FriendRequestAccepted 事件
```

### 1.3 群组成员加入与索引联动图 (Group Join & Index Sync)
```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant GroupClone as GroupClone
    participant Factory as ChatStorageFactory

    User->>GroupClone: join() / useInvite(code)
    Note over GroupClone: 校验 JoinMode、MaxMembers、Ban 状态
    GroupClone->>GroupClone: 添加进 _memberList，更新 _members[user]
    GroupClone->>Factory: onUserJoinedGroup(user, groupId)
    Note over Factory: 仅接受合法 GroupClone 调用<br/>将 groupId 追加至 _userGroups[user] (O(1))
    Note over GroupClone: 触发 MemberJoined 事件
```

---

## 2. Storage Model & Slot Packing (存储模型与紧凑打包)

为了达到极致 Gas 优化并防止存储槽对齐开销，所有结构体均按 32 字节紧凑排列（Slot Packing）。

### 2.1 UserImplementation 存储布局
```text
Slot 0: [address account (20B)] [uint8 status (1B)] [uint32 metadataVersion (4B)] [uint32 stateVersion (4B)] (剩余 3B 预留)
Slot 1: bytes internal _metadata; (可扩展 UTF-8 JSON，上限 4KB)
Slot 2: bytes internal _state; (可扩展 UTF-8 JSON，上限 4KB)
Slot 3: mapping(address => FriendRecord) internal _friends;
Slot 4: address[] internal _friendList; (仅存放当前有效 FRIEND 地址)
Slot 5: mapping(address => uint256) internal _friendIndex; (1-based index 用于 O(1) swap-and-pop)
Slot 6: mapping(address => bytes) internal _friendMetadata; (对好友的个人备注，上限 2KB)
Slot 7: mapping(address => uint32) internal _friendMetadataVersion;
```

#### FriendRecord 结构体紧凑打包 (恰好 1 个 Slot / 25 Bytes)：
```solidity
struct FriendRecord {
    FriendStatus status;   // uint8 (1 byte): NONE(0), PENDING_IN(1), PENDING_OUT(2), FRIEND(3), BLOCKED(4)
    uint64 since;          // uint64 (8 bytes): 好友建立时间戳
    uint64 mutedUntil;     // uint64 (8 bytes): 静音到期时间戳 (0 = 未静音)
    uint64 expiresAt;      // uint64 (8 bytes): 好友申请过期时间戳
}
```

### 2.2 GroupImplementation 存储布局
```text
Slot 0: uint256 public groupId;
Slot 1: [address owner (20B)] [uint8 status (1B)] [uint8 joinMode (1B)] (剩余 10B 预留)
Slot 2: address public pendingOwner; (两步所有权确认)
Slot 3: uint256 public maxMembers; (0 = 无上限)
Slot 4: uint256 public memberCount;
Slot 5: uint32 public metadataVersion;
Slot 6: bytes internal _metadata; (群公共资料 UTF-8 JSON，上限 8KB)
Slot 7: mapping(address => MemberRecord) internal _members;
Slot 8: address[] internal _memberList; (仅存放当前有效成员地址)
Slot 9: mapping(address => uint256) internal _memberIndex; (1-based index 用于 O(1) swap-and-pop)
Slot 10: mapping(address => bytes) internal _memberMetadata; (成员在群内的名片，上限 2KB)
Slot 11: mapping(address => uint32) internal _memberMetadataVersion;
Slot 12: mapping(bytes32 => InviteRecord) internal _invites;
```

#### MemberRecord 结构体紧凑打包 (恰好 1 个 Slot / 26 Bytes)：
```solidity
struct MemberRecord {
    MemberStatus status;   // uint8 (1 byte): NONE(0), MEMBER(1), BANNED(2)
    Role role;             // uint8 (1 byte): MEMBER(0), MODERATOR(1), ADMIN(2)
    uint64 joinedAt;       // uint64 (8 bytes): 入群时间戳
    uint64 muteUntil;      // uint64 (8 bytes): 禁言到期时间戳
    uint64 banUntil;       // uint64 (8 bytes): 封禁到期时间戳 (type(uint64).max = 永久)
}
```

#### InviteRecord 结构体紧凑打包 (1 个 Slot / 29 Bytes + 8 Bytes = 2 Slots)：
```solidity
struct InviteRecord {
    address inviter;       // 20 bytes
    uint32 maxUses;        // 4 bytes
    uint32 usedCount;      // 4 bytes
    bool active;           // 1 byte
    uint64 expiresAt;      // 8 bytes (放入下个槽位或合并)
}
```

### 2.3 ChatStorageFactory 存储布局
```text
Slot 0: address public immutable userImplementation;
Slot 1: address public immutable groupImplementation;
Slot 2: address public relationshipManager;
Slot 3: address public owner;
Slot 4: mapping(address => address) internal _userClones; (userAddress => cloneAddress)
Slot 5: mapping(address => bool) internal _isUserClone;
Slot 6: mapping(uint256 => address) internal _groupClones; (groupId => cloneAddress)
Slot 7: mapping(address => uint256) internal _groupCloneToId; (cloneAddress => groupId)
Slot 8: mapping(address => bool) internal _isGroupClone;
Slot 9: address[] internal _allGroups;
Slot 10: mapping(address => uint256[]) internal _userGroups; (userAddress => groupIds)
Slot 11: mapping(address => mapping(uint256 => uint256)) internal _userGroupIndex; (swap-and-pop 索引)
```

---

## 3. Mathematical & State Invariants (核心不变量与数学守恒)

### 3.1 成员数与列表不变量 (Membership Invariants)
$$\text{memberCount} == \text{\_memberList.length}$$
- 任意成员加入时：`memberCount++`，`_memberList.push(user)`；
- 成员被移出（leave / remove / ban）时：`memberCount--`，使用 `swap-and-pop` 保证 `_memberList` 元素连续性与索引对齐；
- 若设置了 `maxMembers > 0`，则在任何加入前必须严格满足：
$$\text{memberCount} < \text{maxMembers}$$

### 3.2 好友列表与状态不变量 (Friend Invariants)
$$\text{friendCount} == \text{\_friendList.length}$$
- 仅当且仅当 `_friends[user].status == FriendStatus.FRIEND` 时，该地址存在于 `_friendList` 中；
- 当状态跃迁为 `BLOCKED`、`NONE` 时，必须从 `_friendList` 剔除；
- 双向关系一致性：Alice 视 Bob 为 FRIEND 时，经由 `RelationshipManager` 协同保证 Bob 必然视 Alice 为 FRIEND。

### 3.3 权限防越权不变量 (Role Monotonicity & Boundary)
$$\text{Caller Role} > \text{Target Current Role}$$
$$\text{Caller Role} \ge \text{Target New Role}$$
- 禁止平级或越级操作（如 Moderator 不能踢出 Moderator 或 Admin，不能修改其角色）；
- Owner 转移必须经过待接收阶段：
$$\text{owner} \to \text{pendingOwner} \xrightarrow{\text{accept}} \text{owner}$$

### 3.4 状态机合法流转图
```text
User Friend Request:
  NONE ──(send)──> PENDING_OUT (Alice) / PENDING_IN (Bob)
  PENDING_IN ──(accept)──> FRIEND
  PENDING ──(reject/cancel)──> NONE
  FRIEND ──(remove)──> NONE
  ANY ──(block)──> BLOCKED
  BLOCKED ──(unblock)──> NONE

Group Status:
  ACTIVE ──(pause)──> PAUSED ──(resume)──> ACTIVE
  ACTIVE / PAUSED ──(close)──> CLOSED (Terminal)
```

---

## 4. Threat Model & Security Controls (威胁模型与防御策略)

| 攻击威胁 / 漏洞类型 | 潜在危害 | 协议防御策略 |
|---|---|---|
| **Logic Implementation 夺权** | 攻击者直接初始化共享 Implementation 合约夺取特权 | 在 Implementation 的构造函数中调用 `_disableInitializers()`，彻底封禁逻辑合约被初始化的可能 |
| **Clone 身份伪造 (Impersonation)** | 恶意合约冒充 GroupClone 调用 Factory 的 `onUserJoinedGroup` 污染索引 | Factory 内部维护严格的 `_isGroupClone[msg.sender]` 白名单校验，非授权地址调用立即 revert `UnauthorizedClone()` |
| **重入与恶意外部调用 (Reentrancy)** | 接收者通过 ERC-721/1155 回调或自定义回退函数重入篡改状态 | 纯状态存储模型，完全不执行外部任意转账或向不可信地址派发未受信 external call；所有状态修改遵循 CEI 模式 |
| **超大 JSON 导致的 DoS / Gas 耗尽** | 攻击者存储兆级 payload 导致节点 RPC 崩溃或读取超时 | 在合约中对写入的 `bytes` 施加严格硬限（User/State ≤ 4KB, Group ≤ 8KB, Member/Friend ≤ 2KB），超限 revert `MetadataSizeExceeded()` |
| **大数组遍历 Gas Limit DoS** | 成员或好友达数万人时，查询导致 Gas 超过区块上限 | 合约禁止任何无界循环遍历；所有批量查询（`getMembers`, `getFriends`, `getUserGroups`, `getGroups`）强制支持 `offset` 与 `limit` 分页 |
| **两步所有权误操作丢失** | 将 Owner 误设为 `address(0)` 或错误地址导致群组永久丧失控制权 | 强制使用 `pendingOwner` 两步确认机制，必须由新地址主动发起 `acceptOwnership()` 方能生效 |
| **零地址 (address(0)) 穿透** | 恶意或失误将 `address(0)` 作为用户或成员登记 | 所有入口函数显式检查 `if (account == address(0)) revert ZeroAddress();` |

---

## 5. Off-chain & Client Integration (链下客户端与强类型 SDK 集成)

### 5.1 @web3-chat/sdk 客户端包架构
```text
@web3-chat/sdk (packages/sdk 或 sdk/)
├── src/
│   ├── ChatSDK.ts            # 主入口单例，管理 PublicClient 与 WalletClient
│   ├── UserClient.ts         # User-centric 门面 (getCurrentUser, getState, getMetadata, getFriends...)
│   ├── GroupClient.ts        # Group-centric 门面 (getGroupOverview, getMembers, moderation, batch...)
│   ├── RelationshipClient.ts # 双向好友流转 (sendRequest, accept, block, mute...)
│   ├── abi/                  # 与 Foundry 编译同步的强类型 Viem ABI 定义
│   ├── types/                # UserMetadata, GroupMetadata, Overview 等 TypeScript 契约
│   └── utils/                # UTF-8 JSON 序列化、字节限制校验、simulateContract 拦截包装
```

### 5.2 核心类职责与调用模式
```mermaid
classDiagram
    class ChatSDK {
        +publicClient: PublicClient
        +walletClient: WalletClient
        +factoryAddress: Address
        +user(userAddress?: Address): UserClient
        +group(groupId: bigint): GroupClient
        +relationship: RelationshipClient
        +getCurrentUser(): Promise~ChatUserOverview~
        +getGroupOverview(groupId: bigint): Promise~ChatGroupOverview~
    }

    class UserClient {
        +address: Address
        +cloneAddress: Address
        +getState(): Promise~any~
        +setState(state: any): Promise~Hash~
        +getMetadata(): Promise~any~
        +setMetadata(profile: any): Promise~Hash~
        +getFriends(offset: bigint, limit: bigint): Promise~Address[]~
        +setFriendMetadata(friend: Address, meta: any): Promise~Hash~
        +block(target: Address): Promise~Hash~
    }

    class GroupClient {
        +groupId: bigint
        +cloneAddress: Address
        +getState(): Promise~any~
        +getMetadata(): Promise~any~
        +setMetadata(profile: any): Promise~Hash~
        +getMembers(offset: bigint, limit: bigint): Promise~MemberView[]~
        +join(): Promise~Hash~
        +leave(): Promise~Hash~
        +batchAddMembers(members: Address[]): Promise~Hash~
        +batchBanMembers(members: Address[], duration: bigint): Promise~Hash~
        +setMyMetadata(profile: any): Promise~Hash~
    }

    class RelationshipClient {
        +sendRequest(target: Address): Promise~Hash~
        +acceptRequest(requester: Address): Promise~Hash~
        +rejectRequest(requester: Address): Promise~Hash~
        +removeFriend(friend: Address): Promise~Hash~
    }

    ChatSDK --> UserClient
    ChatSDK --> GroupClient
    ChatSDK --> RelationshipClient
```

### 5.3 交易预检与本地模拟 (Pre-flight Simulation)
所有具有状态写入的操作，SDK 内部均默认封装以下管道：
1. **尺寸边界静态核验**：在内存中核算 UTF-8 编码字节数，若 `UserMetadata > 4096` 或 `GroupMetadata > 8192` 直接抛出客户端错误，拒绝发送；
2. **链上预执行 (`publicClient.simulateContract`)**：通过本地 RPC 模拟交易，若命中 Custom Error（如 `AlreadyFriends()`, `GroupFull()`, `UserBlocked()`），直接格式化为友好异常，零 Gas 损耗；
3. **真实上链广播 (`walletClient.writeContract`)** 并可选等待回执。

### 5.4 事件驱动增量同步 (Incremental Event Indexing)
SDK 暴露标准 Viem 事件监听接口：
- `sdk.watchFriendEvents(user, callback)`
- `sdk.watchGroupEvents(groupId, callback)`
链下 Chat 消息服务器通过订阅链上日志，无缝维护在线状态与权限校验缓存。
