# TASK-006: User 与 Relationship 单元与边界测试套件

## 1. Objective (目标)

为 `UserImplementation` 与 `RelationshipManager` 构建全面的 Foundry 单元与边界测试套件，验证用户资料读写、状态更新、尺寸超限拦截、好友双向握手完整生命周期、黑名单互斥、静音控制及越权防御。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - 用户资料与设置读写、版本号自增、尺寸越界 revert 校验。
  - 好友申请发送、接受、拒绝、取消全流程测试。
  - 好友备注读写与独立性（Alice 备注 Bob，Bob 不受影响且无法改动）。
  - 黑名单拉黑、移出好友、拦截申请测试。
  - 静音到期时间戳与解禁测试。
  - 非法调用（未授权、零地址、重复申请、自我申请）revert 校验。
- **Excluded**:
  - 群组与成员测试（属于 TASK-007）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `test/unit/UserAndRelationship.t.sol`
- `docs/AI/tasks/TASK-006.md`

---

## 4. Dependencies (依赖项)

- [TASK-002] (UserImplementation)
- [TASK-003] (RelationshipManager)

---

## 5. Acceptance Criteria (验收标准)

- [x] 单元测试覆盖所有分支条件与边界；
- [x] `forge test --match-path test/unit/UserAndRelationship.t.sol` 100% 通过；
- [x] 严格断言所有自定义错误与触发事件。

---

## 6. Status

DONE
