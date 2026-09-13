/**
 * @web3-chat/sdk
 * TypeScript SDK for EVM Chat State Storage Protocol
 * High-performance, load-balanced, Multicall3-batched client
 */

import type { Address, Chain, Transport } from "viem";

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
  /** Batching options (Multicall3) */
  batch?: {
    multicall?: {
      batchSize?: number;
      wait?: number;
    };
  };
}

export interface ChatUserOverview {
  address: Address;
  cloneAddress: Address;
  status: number;
  metadata: Record<string, any>;
  state: Record<string, any>;
  metadataVersion: number;
  stateVersion: number;
  friends: Address[];
  groups: bigint[];
}

export interface ChatGroupOverview {
  groupId: bigint;
  groupAddress: Address;
  owner: Address;
  status: number;
  joinMode: number;
  maxMembers: bigint;
  memberCount: bigint;
  metadataVersion: number;
  metadata: Record<string, any>;
}

export class ChatSDK {
  public readonly factoryAddress: Address;
  public readonly chain: Chain;

  constructor(options: ChatSDKOptions) {
    this.factoryAddress = options.factoryAddress;
    this.chain = options.chain;
    // Implemented in TASK-010: RpcPoolManager & Client Initialization
  }
}
