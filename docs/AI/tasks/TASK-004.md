# TASK-004: GroupImplementation 群组状态、成员与角色实现

## 1. Objective (目标)

实现 `GroupImplementation.sol`，作为独立的群组容器逻辑合约。管理群组核心元数据（≤ 8KB）、生命周期状态（ACTIVE/PAUSED/CLOSED）、JoinMode、MaxMembers、两步所有权（pendingOwner）、分级角色体系（OWNER > ADMIN > MODERATOR > MEMBER）、批量加入/踢出/禁言/封禁、邀请码机制、群内成员个人名片（≤ 2KB）以及向 Factory 索引上报回调。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - `initialize(uint256 groupId, address owner, bytes calldata metadata, address[] calldata initialMembers, JoinMode joinMode, uint256 maxMembers, address factory)`
  - 构造函数封禁 Implementation 初始化（`_disableInitializers()`）。
  - 两步所有权确认：`transferOwnership` -> `acceptOwnership`。
  - 生命周期切换：`pause`, `resume`, `close`。
  - JoinMode 与容量控制：PUBLIC, INVITE_ONLY, ADMIN_ONLY, CLOSED；`maxMembers` 校验。
  - 成员维护：`_memberList` 紧凑连续数组与 O(1) swap-and-pop。
  - 角色鉴权：严格校验 `Caller Role > Target Role` 且 `Caller Role >= New Role`，防止越权提权。
  - 批量操作：`batchAddMembers`, `batchRemoveMembers`, `batchMuteMembers`, `batchBanMembers`, `batchUnbanMembers`。
  - 邀请码管理：`createInvite`, `revokeInvite`, `useInvite`。
  - 成员群内名片：`setMyMetadata`（≤ 2KB，仅本人可改）。
  - 工厂联动：在成员加入/退出时安全调用 Factory 的 `onUserJoinedGroup` / `onUserLeftGroup`。
- **Excluded**:
  - 工厂部署克隆逻辑（属于 TASK-005）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `src/GroupImplementation.sol`
- `docs/AI/tasks/TASK-004.md`

---

## 4. Dependencies (依赖项)

- [TASK-001] (核心接口与错误定义)

---

## 5. Blockchain & Security Impact (智能合约影响评估)

- **Storage Layout**: 遵循紧凑打包规范（Slot 1 打包 owner, status, joinMode；MemberRecord 恰好 1 个 Slot 26B）。
- **Role Boundary**: 禁止平级或越级操作，防范权限越权与死锁。
- **Reentrancy**: 遵循 CEI 原则。

---

## 6. Acceptance Criteria (验收标准)

- [x] 实现 `IGroupImplementation` 接口全部定义；
- [x] 构造函数中调用 `_disableInitializers()`；
- [x] 严格对元数据执行尺寸限制（Group ≤ 8KB, Member ≤ 2KB）；
- [x] 连续性保持：`memberCount == _memberList.length`；
- [x] `forge build` 静态编译 0 报错。

---

## 7. Status

DONE
