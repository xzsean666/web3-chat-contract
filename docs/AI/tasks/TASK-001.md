# TASK-001: 核心规范、接口定义、数据类型、自定义错误与事件体系

## 1. Objective (目标)

确立 EVM Chat State Storage Protocol 的核心类型体系、所有组件标准接口（Interfaces）、自定义错误（Custom Errors）与全局事件（Events），为后续具体逻辑合约（User, Group, Factory, RelationshipManager）开发提供类型约束与规范基石。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - 定义枚举类型：`UserStatus`、`FriendStatus`、`GroupStatus`、`JoinMode`、`Role`。
  - 定义紧凑结构体：`FriendRecord`、`MemberRecord`、`InviteRecord`、`FriendView`、`MemberView`、`GroupView`。
  - 定义所有 Custom Errors：尺寸超限、权限不足、群满、状态异常、已拉黑、非法参数等。
  - 定义所有生命周期事件：用户、群组、成员资格、好友握手、角色流转事件。
  - 定义核心接口：
    - `src/interfaces/IUserImplementation.sol`
    - `src/interfaces/IGroupImplementation.sol`
    - `src/interfaces/IChatStorageFactory.sol`
    - `src/interfaces/IRelationshipManager.sol`
  - 编写接口与错误类型的编译验证用例。
- **Excluded**:
  - 具体业务逻辑实现（属于 TASK-002 ~ TASK-005）。
  - 链下 SDK 绑定代码（属于后期集成）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `src/interfaces/IChatStorageFactory.sol`
- `src/interfaces/IUserImplementation.sol`
- `src/interfaces/IGroupImplementation.sol`
- `src/interfaces/IRelationshipManager.sol`
- `src/interfaces/ChatDataTypes.sol`
- `src/interfaces/ChatErrors.sol`
- `src/interfaces/ChatEvents.sol`
- `test/unit/InterfacesCompile.t.sol`

---

## 4. Dependencies (依赖项)

- **None**（冷启动首个工程任务，依赖前置环境与规范已完备）

---

## 5. Blockchain & Security Impact (智能合约影响评估)

- **Storage Layout**: 纯接口与类型定义，不占用状态存储槽。结构体遵循 Slot Packing 原则规划字段字节宽度。
- **ABI & Custom Errors**: 确立协议全套规范 ABI；全面弃用 `require("string")`，统一采用高能效自定义错误（如 `error MetadataSizeExceeded(uint256 size, uint256 limit);`）。
- **Security Protections**: 确立严格的参数签名与入参校验规范（拒绝 `address(0)`，限制 `bytes` 最大长度）。
- **Gas Impact**: 自定义错误在 revert 时仅消耗 4 字节 selector + 参数编码，比长字符串节约数千 Gas。

---

## 6. Acceptance Criteria (验收标准)

- [x] 完整定义 `ChatDataTypes.sol`（包含所有枚举与紧凑结构体定义）。
- [x] 完整定义 `ChatErrors.sol`（包含涵盖各种边界条件的自定义错误）。
- [x] 完整定义 `ChatEvents.sol`（包含所有用户、群组、成员、角色变动事件）。
- [x] 完整定义 4 个核心模块的规范接口。
- [x] 执行 `forge build` 静态编译 0 报错、0 警告。
- [x] 执行 `forge fmt --check` 代码风格检查通过。

---

## 7. Verification Commands (验证命令)

```bash
forge build
forge fmt --check
forge test --match-path test/unit/InterfacesCompile.t.sol
```

---

## 8. Risks and Assumptions (风险与假设)

- 接口设计必须全量覆盖 MVP 所要求的全部读写方法，避免后续实现阶段出现破坏性 ABI 调整；
- 结构体字段类型与字节宽度必须与 `docs/AI/ARCHITECTURE.md` 存储紧凑打包规划完全契合。

---

## 9. Status

DONE
