# TASK-009: 自动化部署脚本、本地模拟与发布验证

## 1. Objective (目标)

编写 Foundry 部署与初始化脚本（`script/Deploy.s.sol`），完成 UserImplementation、GroupImplementation、ChatStorageFactory 与 RelationshipManager 的幂等部署、相互关联与初始化，支持本地 Anvil 模拟广播（Dry Run）并输出标准部署产物（`deployments/`）。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - `script/Deploy.s.sol`:
    1. 部署 `UserImplementation` (logic)；
    2. 部署 `GroupImplementation` (logic)；
    3. 部署 `ChatStorageFactory(userImpl, groupImpl)`；
    4. 部署 `RelationshipManager(factory)`；
    5. 调用 `factory.setRelationshipManager(relationshipManager)` 完成绑定；
  - 导出部署日志并持久化部署地址（JSON 格式）。
  - 支持 `forge script` 本地模拟与广播验证。
- **Excluded**:
  - 未授权广播到公网主网。

---

## 3. Allowed Files (允许修改的文件白名单)

- `script/Deploy.s.sol`
- `docs/AI/tasks/TASK-009.md`

---

## 4. Dependencies (依赖项)

- [TASK-008] (集成测试通过)

---

## 5. Acceptance Criteria (验收标准)

- [x] `forge script script/Deploy.s.sol` 本地执行成功；
- [x] 部署脚本完全幂等且包含正确配置绑定；
- [x] 导出部署元数据供 SDK 读取。

---

## 6. Status

DONE
