# TASK-010: TypeScript Viem Chat SDK 强类型绑定与客户端实现

## 1. Objective (目标)

基于 Viem 构建 `@web3-chat/sdk` 强类型客户端，无缝桥接智能合约 ABI，实现用户中心（`sdk.user()`）与群组中心（`sdk.group(groupId)`）两大开发接口，封装 JSON 状态自动序列化、尺寸预检与 `simulateContract` 链上预模拟执行。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - ABI 自动化同步与强类型 Viem 导出（`ChatStorageFactory`, `UserImplementation`, `GroupImplementation`, `RelationshipManager`）。
  - 实现 `ChatSDK` 主入口：网络切换、PublicClient / WalletClient 注入、合约地址管理。
  - 实现 `UserClient` 门面：
    - `getState()` / `setState(stateObj)`
    - `getMetadata()` / `setMetadata(profileObj)`
    - `getFriends(offset, limit)` / `isFriend(addr)`
    - `setFriendMetadata(friendAddr, noteObj)`
    - `getCurrentUser()` / `getMyOverview()` 一站式聚合个人状态
  - 实现 `GroupClient` 门面：
    - `getState()` / `getMetadata()` / `setMetadata(profileObj)`
    - `getMembers(offset, limit)` / `getMember(addr)`
    - `setMyMetadata(profileObj)`
    - `join()` / `leave()`
    - 批量管理接口封装：`batchAddMembers`, `batchRemoveMembers`, `batchBanMembers`, `batchMuteMembers`
    - `getGroupOverview()` 一站式聚合群全景
  - 实现 `RelationshipClient` 门面：双向申请、接受、拒绝、解除与拉黑
  - 静态尺寸校验拦截器：User/State ≤ 4KB, Group ≤ 8KB, Member/Friend ≤ 2KB
  - 交易预检机制：默认通过 `simulateContract` 提前捕获 Custom Error，防范 Gas 浪费。
- **Excluded**:
  - 链下聊天消息传输（WebSockets / P2P / Waku 等，属于上层消息服务）。

---

## 3. Allowed Files (允许修改的文件白名单)

- `sdk/package.json`
- `sdk/tsconfig.json`
- `sdk/src/**/*`
- `sdk/test/unit/**/*`

---

## 4. Dependencies (依赖项)

- [TASK-005] (ChatStorageFactory 实现完毕)
- [TASK-008] (端到端集成测试通过)

---

## 5. Blockchain & Security Impact (智能合约影响评估)

- **Storage Layout**: 无链上修改，纯链下客户端封装。
- **ABI & Custom Errors**: 严格映射 Solidity Custom Error 为强类型 TypeScript 错误（如 `UserBlockedError`, `GroupFullError`）。
- **Security Protections**: 链下预先校验 `address(0)` 与 JSON 尺寸，强制先调用 `simulateContract`，消除必败交易。

---

## 6. Acceptance Criteria (验收标准)

- [ ] `pnpm run build:sdk` 编译成功，输出 CJS、ESM 及 `.d.ts` 类型定义文件；
- [ ] SDK 提供符合规范的 `sdk.user()` 与 `sdk.group(groupId)` 极简开发体验；
- [ ] 完整覆盖 `getMyOverview()` 与 `getGroupOverview()` 聚合查询；
- [ ] JSON 序列化与尺寸边界检查通过针对性单元测试；
- [ ] 代码通过 ESLint / Prettier 校验。

---

## 7. Verification Commands (验证命令)

```bash
pnpm run build:sdk
pnpm --filter @web3-chat/sdk test
```

---

## 8. Status

TODO
