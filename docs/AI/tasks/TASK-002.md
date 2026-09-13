# TASK-002: UserImplementation 存储模型与个人状态实现

## 1. Objective (目标)

实现 `UserImplementation.sol`，作为轻量代理 (ERC-1167 Minimal Proxy) 的核心逻辑合约。管理用户的独立状态空间：包括个人核心状态、资料（Metadata JSON，≤ 4KB）、偏好设置（State JSON，≤ 4KB）、好友列表与紧凑关系映射、好友个人备注（≤ 2KB）、好友静音以及黑名单管理。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - 实现 `initialize(address account, address relationshipManager, address factory)`，并在构造函数中调用 `_disableInitializers()` 封禁 Implementation 攻击。
  - 存储槽位紧凑打包，严格遵循 `docs/AI/ARCHITECTURE.md` 第 2.1 节规划。
  - 实现个人资料与设置的读写（`setMetadata`, `setState`），带严格尺寸限制与版本号递增。
  - 维护有效好友列表 `_friendList`，使用 1-based `_friendIndex` 实现 O(1) swap-and-pop 维护与紧凑数组连续性。
  - 好友查询与带分页数组检索（`getFriends(offset, limit)`）。
  - 本地好友备注设置与版本递增（`setFriendMetadata`）。
  - 好友静音控制（`muteFriend`, `unmuteFriend`）。
  - 黑名单管理（`block`, `unblock`, `isBlocked`）：拉黑时若为好友需自动移出有效好友列表。
  - 协作接口：仅允许 `relationshipManager` 调用的双向关系变更接口（`setRelationshipFromManager`）。
- **Excluded**:
  - 双向好友握手逻辑（由 `RelationshipManager` 统一调度，属于 TASK-003）。
  - 工厂部署逻辑（属于 TASK-005）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `src/UserImplementation.sol`
- `docs/AI/tasks/TASK-002.md`

---

## 4. Dependencies (依赖项)

- [TASK-001] (核心接口与错误定义)

---

## 5. Blockchain & Security Impact (智能合约影响评估)

- **Storage Layout**: 严格紧凑打包（Slot 0 打包 account, status, metadataVersion, stateVersion；FriendRecord 恰好打包在单个 32 字节槽位中）。
- **Reentrancy**: 遵循 CEI，无任意外部调用。
- **Access Control**: 资料修改仅限本人（`account`）；关系变更由本人或受信的 `relationshipManager` 触发。
- **Gas Impact**: 采用 O(1) swap-and-pop，杜绝无界循环；分页查询防止 RPC 耗尽。

---

## 6. Acceptance Criteria (验收标准)

- [x] 实现 `IUserImplementation` 接口全部定义；
- [x] 构造函数中包含 `_disableInitializers()`；
- [x] 严格对元数据执行尺寸检查（≤ 4KB / ≤ 2KB）；
- [x] `_friendList` 元素增删维持严格连续性，`friendCount()` 恒等于 `_friendList.length`；
- [x] `forge build` 静态编译 0 报错、0 警告。

---

## 7. Status

DONE
