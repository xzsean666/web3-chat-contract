# TASK-008: 跨合约端到端联合集成与不变量测试套件

## 1. Objective (目标)

构建跨组件联合集成与不变量测试套件（`test/integration/EndToEndChatFlow.t.sol`），覆盖全链路业务流：Factory 部署 -> UserClone 注册 -> Profile 更新 -> 好友双向握手 -> 建群与初始成员预装 -> 邀请加群 -> Factory 用户群组双向索引同步 -> 退群与踢人索引解除 -> 状态不变量验证。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - 用户注册与群组创建完整端到端流；
  - 群成员变动与 Factory `_userGroups` 索引同步一致性断言；
  - 核心不变量断言（`memberCount == _memberList.length`, `friendCount == _friendList.length`）；
  - 伪造 Clone 攻击 Factory 的安全防御用例；
  - 分页查询在大数据量下的正确性验证。
- **Excluded**:
  - 链下 TypeScript SDK 测试（属于 TASK-011）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `test/integration/EndToEndChatFlow.t.sol`
- `docs/AI/tasks/TASK-008.md`

---

## 4. Dependencies (依赖项)

- [TASK-005] (ChatStorageFactory)
- [TASK-006] (User & Relationship 单元测试)
- [TASK-007] (Group 单元测试)

---

## 5. Acceptance Criteria (验收标准)

- [x] 端到端集成测试 100% 通过；
- [x] 覆盖全协议生命周期与双向索引一致性；
- [x] `forge test --match-path test/integration/EndToEndChatFlow.t.sol` 通过。

---

## 6. Status

DONE
