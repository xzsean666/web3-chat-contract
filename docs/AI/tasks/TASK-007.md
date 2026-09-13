# TASK-007: Group 成员、角色与批处理单元测试套件

## 1. Objective (目标)

为 `GroupImplementation` 构建全面的 Foundry 单元与边界测试套件，验证群生命周期（ACTIVE/PAUSED/CLOSED）、两步所有权确认、JoinMode 与容量限制、批量操作（加人/踢人/禁言/封禁）、邀请码流转、角色防越权提权与成员群内名片管理。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - 群创建与 `initialMembers` 批量初始化；
  - 权限分级矩阵测试：禁止平级与越级禁言、踢人、封禁；
  - 两步所有权转移与撤销机制测试；
  - 批量操作测试与容量边界触发（`GroupFull`）；
  - 邀请码创建、使用、过期与撤销测试；
  - 尺寸超限测试（Group ≤ 8KB, Member ≤ 2KB）；
  - 生命周期终态（CLOSED 后禁止加人与修改资料）。
- **Excluded**:
  - 跨用户/工厂全局端到端联动（属于 TASK-008）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `test/unit/Group.t.sol`
- `docs/AI/tasks/TASK-007.md`

---

## 4. Dependencies (依赖项)

- [TASK-004] (GroupImplementation)

---

## 5. Acceptance Criteria (验收标准)

- [x] 测试覆盖所有角色等级与越权拦截边界；
- [x] `forge test --match-path test/unit/Group.t.sol` 100% 通过；
- [x] 严格断言所有自定义错误与触发事件。

---

## 6. Status

DONE
