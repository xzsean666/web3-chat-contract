# TASK-011: SDK 与本地 Anvil 沙箱端到端联动测试

## 1. Objective (目标)

搭建 TypeScript SDK 与本地 Anvil EVM 节点的自动化端到端 (E2E) 测试流水线，通过真实私钥、测试钱包与合约广播交互，全流程验证 SDK 的封装可靠性、状态同步准确性与异常拦截能力。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - 编写自动化 E2E 脚本：启动/连接本地 Anvil 沙箱节点；
  - 部署全套测试合约并向 SDK 注入测试网络与 Factory 地址；
  - 测试完整业务流水线：
    1. Alice 与 Bob 钱包注册 UserClone；
    2. Alice 更新个人 Profile 与 State；
    3. Alice 向 Bob 发起好友申请，Bob 接受，验证双向 FRIEND 状态与 `since` 时间戳；
    4. Alice 对 Bob 设置私有备注（Friend Metadata），验证 Bob 无法读取亦无法篡改；
    5. Alice 创建群组（GroupClone），设置 JoinMode 与 MaxMembers；
    6. Bob 加入群组，更新自身在群内的名片（Member Metadata）；
    7. Alice 通过 `sdk.group(id)` 批量执行禁言与移除成员；
    8. 验证 `getMyOverview()` 与 `getGroupOverview()` 聚合返回的数据完整性；
    9. 验证异常注入（如群人数超限、黑名单拦截、超大 JSON 拦截）。
- **Excluded**:
  - 主网真实广播（仅在本地沙箱运行）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `sdk/test/e2e/**/*`
- `sdk/test/fixtures/**/*`
- `package.json`

---

## 4. Dependencies (依赖项)

- [TASK-009] (自动化部署脚本已就绪)
- [TASK-010] (SDK 核心实现完成)

---

## 5. Acceptance Criteria (验收标准)

- [ ] 本地沙箱 E2E 测试用例 100% 通过（`pnpm run test:sdk`）；
- [ ] 覆盖用户生命周期、好友握手、群组生命周期与聚合视图；
- [ ] 异常拦截（Revert / Custom Error）经过真实断言验证。

---

## 6. Verification Commands (验证命令)

```bash
pnpm run test:all
```

---

## 7. Status

TODO
