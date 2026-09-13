/**
 * @web3-chat/sdk
 * TypeScript SDK for EVM Chat State Storage Protocol
 */

export interface ChatUserOverview {
  address: `0x${string}`;
  status: number;
  metadata: Record<string, any>;
  state: Record<string, any>;
  metadataVersion: number;
  stateVersion: number;
  friends: `0x${string}`[];
  groups: bigint[];
}

export interface ChatGroupOverview {
  groupId: bigint;
  groupAddress: `0x${string}`;
  owner: `0x${string}`;
  status: number;
  joinMode: number;
  maxMembers: bigint;
  memberCount: bigint;
  metadataVersion: number;
  metadata: Record<string, any>;
}

export class ChatSDK {
  constructor() {
    // Initialized in TASK-010
  }
}
