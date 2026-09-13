# TASK-014: 全方位智能合约与 SDK 深度安全审计、性能调优与功能升级

## 1. 任务概述 (Task Overview)
- **Task ID**: TASK-014
- **Title**: 全方位智能合约与 SDK 深度安全审计、性能调优与功能升级
- **Phase**: Phase 11
- **Status**: COMPLETED
- **Dependencies**: TASK-013 (Universal Hardhat + Viem Unification)

## 2. 审计与优化项清单 (Audit Findings & Upgrades)

### 2.1 智能合约层 (Smart Contracts)
1. **分页算术溢出防范 (Low / Robustness)**:
   - 涉及方法: `getFriends`, `getFriendViews`, `getMembers`, `getMemberViews`, `getGroups`, `getUserGroups`。
   - 原逻辑在 `offset + limit` 时，若客户端传入极大 limit（如 `type(uint256).max`），在 Solidity 0.8+ 下将触发 Panic(0x11) 溢出报错。
   - 重构为: `uint256 count = limit > total - offset ? total - offset : limit;`，无加法运算，彻底消除溢出风险，并节省局部变量与 Gas。
2. **UserDisabled 禁用状态全链路封堵 (Medium / Security)**:
   - 原代码中 `UserDisabled` 仅声明未消费。
   - 在 `RelationshipManager.sendFriendRequestWithExpiry` 与 `acceptFriendRequest` 中核验请求方与接收方账户是否处于 `UserStatus.DISABLED`；
   - 在 `UserImplementation.setMetadata` 与 `setState` 中核验账户自身是否处于 `UserStatus.DISABLED`，禁止被禁用用户写入数据。
3. **群内名片防扰与禁言防绕过 (Medium / Business Security)**:
   - 原逻辑允许被禁言成员调用 `setMyMetadata` 修改群内名片用于刷屏广告；且对非群成员禁言未抛出 `MemberNotFound`；
   - 在 `setMyMetadata` 中增加禁言校验，若成员处于有效禁言期，直接 revert `MemberMuted`；
   - `mute`, `unmute`, `batchMuteMembers` 强制要求目标为在群有效成员；
   - 禁言与静音时间戳采用安全上界计算（防止 `uint64` 溢出 revert）。
4. **群主移交角色降级一致性修复 (Medium / State Invariant)**:
   - 当普通成员被升任为群主后，后续若再次向第三方移交所有权，原代码未重写存储记录，导致其意外退回 `Role.MEMBER`；
   - 在 `acceptOwnership()` 中显式将 `_members[previousOwner].role = Role.ADMIN`，保障群主转让后永久保留管理员权限。
5. **双向好友申请对称闭环核验 (Low / Defensive Hardening)**:
   - 在 `acceptFriendRequest` 中对称核验 `requesterClone.getFriend(msg.sender).status == PENDING_OUT`，保障双向状态机零漂移。
6. **Factory 跨合约回调零地址防护 (Low / Defensive)**:
   - 在 `onUserJoinedGroup` 与 `onUserLeftGroup` 中增加 `if (user == address(0)) revert ZeroAddress();` 显式防护。

### 2.2 TypeScript Viem SDK 层 (@web3-chat/sdk)
1. **事件驱动同步机制 (Event Watching)**:
   - 根据架构规范 5.6，在 `ChatSDK`, `UserClient`, `GroupClient`, `RelationshipClient` 补齐 `watchEvents` 强类型 Viem Event Watcher 订阅管道。
2. **密码学邀请码工具 (Invite Cryptography)**:
   - 新增 `generateInviteCode(prefix)` 与 `hashInviteCode(secret)`，提供安全随机生成与 keccak256 计算工具；
   - `GroupClient` 增加 `createInviteWithSecret` 与 `useInviteWithSecret` 便捷方法。
3. **Custom Error 友好解析器 (Chat Error Parser)**:
   - 新增 `parseChatError(error)`，智能解包 Viem Custom Revert Error，并提供 30+ 种合约异常的友好解释与参数结构。
4. **RPC 节点响应体内限流智能自愈 (Resilience)**:
   - 升级 `RpcPoolManager`，智能识别 HTTP 200 响应体中由 Alchemy/Infura 返回的 `-32005 / 429 / rate limit` 错误，自动计入节点失败、触发随机指数退避，并无缝漂移至下一健康节点。

## 3. 验证结果 (Verification Results)
1. 智能合约单元测试: 26/26 项全部通过 (覆盖溢出分页、UserDisabled、禁言名片防护、群主降级保留)。
2. SDK 单元与沙箱测试: 23/23 项全部通过 (覆盖邀请码生成、自定义错误解析、RPC 响应体限流 failover)。
3. 全量测试 `pnpm test:all`: 49/49 项 100% PASS。
4. 本地部署沙箱验证: `pnpm run deploy:local` 部署成功。
