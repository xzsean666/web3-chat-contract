# TASK-003: RelationshipManager 双向握手与协同实现

## 1. Objective (目标)

实现 `RelationshipManager.sol`，负责两个独立 UserClone 之间的跨合约双向社交关系状态机协同：包括好友申请发送、接受、拒绝、取消、解除好友，以及在流转前的黑名单互斥检测。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - `sendFriendRequest(address target)`: 校验未被对方拉黑、非自身、当前非好友且无进行中申请，同时变更 Alice 为 PENDING_OUT，Bob 为 PENDING_IN。
  - `acceptFriendRequest(address requester)`: Bob 接受 Alice 的申请，双方同步跃迁为 FRIEND，更新 `since` 时间戳并加入双方的好友列表。
  - `rejectFriendRequest(address requester)`: Bob 拒绝 Alice 申请，双方重置为 NONE。
  - `cancelFriendRequest(address target)`: Alice 撤销发给 Bob 的申请，双方重置为 NONE。
  - `removeFriend(address friend)`: 任意一方主动解除好友关系，双方均移出好友列表并重置为 NONE。
  - 防御性检查：校验 Alice 和 Bob 在 Factory 中均已注册为合法 UserClone。
- **Excluded**:
  - 个人资料与偏好设置（属于 TASK-002）。
  - 群组关系（属于 TASK-004）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `src/RelationshipManager.sol`
- `docs/AI/tasks/TASK-003.md`

---

## 4. Dependencies (依赖项)

- [TASK-001] (核心接口与错误定义)
- [TASK-002] (UserImplementation 存储模型与状态实现)

---

## 5. Blockchain & Security Impact (智能合约影响评估)

- **Access Control**: 仅代理经过验证的 UserClone 之间的关系变更；
- **Reentrancy**: 遵循 CEI 原则，先校验状态再调用目标 Clone 更新；
- **State Invariants**: 确保双方关系对称（Alice FRIEND <=> Bob FRIEND）。

---

## 6. Acceptance Criteria (验收标准)

- [x] 实现 `IRelationshipManager` 全部接口；
- [x] 发射完整的关系生命周期事件；
- [x] 严格防范拉黑后申请、重复申请、自我申请；
- [x] `forge build` 静态编译 0 报错。

---

## 7. Status

DONE
