# TASK-005: ChatStorageFactory 全局注册表与克隆索引实现

## 1. Objective (目标)

实现 `ChatStorageFactory.sol`，负责全局部署 User 与 Group 的轻量克隆（EIP-1167 Minimal Proxy），建立全局用户与群组注册表、ID 与地址双向映射、全局分页发现机制、以及严格鉴权的用户群组参与索引维护（`_userGroups`）。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - `createUser()`: 为调用者部署专属 UserClone，登记并完成初始化。
  - `createGroup(bytes calldata metadata, address[] calldata initialMembers, JoinMode joinMode, uint256 maxMembers)`: 部署 GroupClone，分配自增 `groupId` 并登记全局索引。
  - 用户/群组映射与存在性校验：`getUserContract`, `isUserClone`, `getGroup`, `getGroupId`, `isGroupClone`。
  - 全局群组发现：`groupCount()`, `getGroups(offset, limit)`。
  - 用户参与群组索引维护与检索：
    - `onUserJoinedGroup(address user, uint256 groupId)` (严格限制仅受权 GroupClone 调用)
    - `onUserLeftGroup(address user, uint256 groupId)` (严格限制仅受权 GroupClone 调用)
    - `getUserGroups(address user, uint256 offset, uint256 limit)`
  - 聚合全景查询视图：`getUserOverview(user)`, `getGroupOverview(groupId)`。
  - 管理员配置：`setRelationshipManager`。
- **Excluded**:
  - 具体业务逻辑（由 User / Group / RelationshipManager 负责）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `src/ChatStorageFactory.sol`
- `docs/AI/tasks/TASK-005.md`

---

## 4. Dependencies (依赖项)

- [TASK-002] (UserImplementation)
- [TASK-003] (RelationshipManager)
- [TASK-004] (GroupImplementation)

---

## 5. Blockchain & Security Impact (智能合约影响评估)

- **Impersonation Defense**: `onUserJoinedGroup` 与 `onUserLeftGroup` 严格检查 `_isGroupClone[msg.sender]`，未授权调用立即 revert `UnauthorizedClone()`。
- **Reentrancy**: 遵循 CEI。
- **Pagination**: 所有列表检索接口强制分页，杜绝 Gas Limit 耗尽。

---

## 6. Acceptance Criteria (验收标准)

- [x] 实现 `IChatStorageFactory` 全部接口；
- [x] 克隆安全创建与初始化，每个用户只允许创建一个 UserContract；
- [x] 严格防范未授权 GroupClone 上报；
- [x] `_userGroups` 在加群/退群时正确保持一致性；
- [x] `forge build` 静态编译 0 报错。

---

## 7. Status

DONE
