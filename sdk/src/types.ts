// SPDX-License-Identifier: MIT
import type { Address, Chain, PublicClient, Transport, WalletClient } from "viem";

export const MAX_USER_METADATA_SIZE = 4096;
export const MAX_USER_STATE_SIZE = 4096;
export const MAX_GROUP_METADATA_SIZE = 8192;
export const MAX_MEMBER_METADATA_SIZE = 2048;
export const MAX_FRIEND_METADATA_SIZE = 2048;

export enum UserStatus {
  ACTIVE = 0,
  DISABLED = 1,
}

export enum FriendStatus {
  NONE = 0,
  PENDING_IN = 1,
  PENDING_OUT = 2,
  FRIEND = 3,
  BLOCKED = 4,
}

export enum GroupStatus {
  ACTIVE = 0,
  PAUSED = 1,
  CLOSED = 2,
}

export enum JoinMode {
  PUBLIC = 0,
  INVITE_ONLY = 1,
  ADMIN_ONLY = 2,
  CLOSED = 3,
}

export enum MemberStatus {
  NONE = 0,
  MEMBER = 1,
  BANNED = 2,
}

export enum Role {
  MEMBER = 0,
  MODERATOR = 1,
  ADMIN = 2,
  OWNER = 3,
}

export interface FriendRecordView {
  status: FriendStatus;
  since: bigint;
  mutedUntil: bigint;
  expiresAt: bigint;
}

export interface FriendView {
  friendAddress: Address;
  status: FriendStatus;
  since: bigint;
  mutedUntil: bigint;
  expiresAt: bigint;
  metadata: Record<string, any> | string;
  metadataVersion: number;
}

export interface MemberRecordView {
  status: MemberStatus;
  role: Role;
  joinedAt: bigint;
  muteUntil: bigint;
  banUntil: bigint;
}

export interface MemberView {
  memberAddress: Address;
  status: MemberStatus;
  role: Role;
  joinedAt: bigint;
  muteUntil: bigint;
  banUntil: bigint;
  metadata: Record<string, any> | string;
  metadataVersion: number;
}

export interface ChatUserOverview {
  userAddress: Address;
  cloneAddress: Address;
  status: UserStatus;
  metadataVersion: number;
  metadata: Record<string, any>;
  stateVersion: number;
  state: Record<string, any>;
  friendCount: bigint;
  groupCount: bigint;
}

export interface ChatGroupOverview {
  groupId: bigint;
  groupAddress: Address;
  owner: Address;
  pendingOwner: Address;
  status: GroupStatus;
  joinMode: JoinMode;
  maxMembers: bigint;
  memberCount: bigint;
  metadataVersion: number;
  metadata: Record<string, any>;
}

export type LoadBalancingStrategy = "round-robin" | "latency-ranked" | "fallback";

export interface RpcNodeConfig {
  url: string;
  weight?: number;
  timeoutMs?: number;
}

export interface RpcPoolConfig {
  /** List of RPC HTTP endpoints for load balancing */
  rpcUrls?: string[];
  /** Detailed RPC node configurations with weights/timeouts */
  nodes?: RpcNodeConfig[];
  /** Load balancing strategy: 'round-robin' | 'latency-ranked' | 'fallback' (default: 'round-robin') */
  strategy?: LoadBalancingStrategy;
  /** Maximum consecutive failures before triggering circuit breaker cooldown (default: 3) */
  maxFailures?: number;
  /** Cooldown duration in milliseconds before retrying an evicted node (default: 15_000) */
  cooldownMs?: number;
}

export interface ChatSDKOptions {
  /** ChatStorageFactory contract address */
  factoryAddress: Address;
  /** Target EVM Chain definition */
  chain: Chain;
  /** Custom Viem Transport (optional, overrides rpcPool) */
  transport?: Transport;
  /** RPC pool and load balancing options */
  rpcPool?: RpcPoolConfig;
  /** Pre-configured Viem PublicClient */
  publicClient?: PublicClient;
  /** Pre-configured Viem WalletClient for write operations */
  walletClient?: WalletClient;
  /** Batching options (Multicall3) */
  batch?: {
    multicall?: {
      batchSize?: number;
      wait?: number;
    };
  };
}
