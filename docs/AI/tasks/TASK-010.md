# TASK-010: TypeScript Viem Chat SDK 强类型绑定与客户端实现

## 1. Objective (目标)

基于 Viem 构建 `@web3-chat/sdk` 强类型客户端，无缝桥接智能合约 ABI，实现用户中心（`sdk.user()`）与群组中心（`sdk.group(groupId)`）两大开发接口，内建多策略 RPC 连接池负载均衡器（支持传入 `rpcUrls: string[]` 自动分流与熔断自愈）与 Multicall3 批量调用聚合器（单次 RPC 往返完成复合状态提取），封装 JSON 状态自动序列化、尺寸预检与 `simulateContract` 链上预模拟执行。

---

## 2. Scope & Boundaries (范围与边界)

- **Included**:
  - ABI 自动化同步与强类型 Viem 导出（`ChatStorageFactory`, `UserImplementation`, `GroupImplementation`, `RelationshipManager`）。
  - 实现 **RPC 连接池与高可用负载均衡器 (`RpcPoolManager` / `LoadBalancedTransport`)**：
    - 支持初始化传入 RPC 节点池列表：`rpcUrls: string[]` 或 `nodes: RpcNodeConfig[]`；
    - 支持分发调度策略：`round-robin`（轮询平摊负载）、`latency-ranked`（低延迟优选）；
    - 针对 HTTP 429（Rate Limited）、网络超时及 5xx 服务端异常实现自动熔断剔除、冷却恢复与透明 Failover 重试。
  - 深度集成 **Multicall3 批量调用与请求聚合 (Batch & Multicall3)**：
    - 启用 Viem 微任务自动合并机制（`batch.multicall: { batchSize: 1024, wait: 16 }`）；
    - 在 `getCurrentUser()` 与 `getGroupOverview()` 中实施 Multicall3 原子级批量调用，将多次 `eth_call` 压缩为单笔网络往返（Single Round-Trip）。
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
- **Security & Performance**:
  - 负载均衡分流消除单 RPC 节点限频故障，大幅提升高并发场景可用性；
  - Multicall3 批量调用将 5~10 次独立请求压缩为 1 次 RPC 往返，节省 80%+ 网络延迟与节点消耗；
  - 链下预先校验 `address(0)` 与 JSON 尺寸，强制调用 `simulateContract` 预检，消除必败交易。

---

## 6. Acceptance Criteria (验收标准)

- [ ] `pnpm run build:sdk` 编译成功，输出 CJS、ESM 及 `.d.ts` 类型定义文件；
- [ ] 支持传入 `rpcUrls: string[]` 并提供通过单元测试验证的 `round-robin` 负载均衡与节点健康熔断机制；
- [ ] `getCurrentUser()` 与 `getGroupOverview()` 成功经由 Multicall3 批处理执行，单次 RPC 往返获取完整数据；
- [ ] SDK 提供符合规范的 `sdk.user()` 与 `sdk.group(groupId)` 极简开发体验；
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
