// SPDX-License-Identifier: MIT
import type { Address, Hash, Hex, PublicClient, WalletClient } from "viem";
import { GroupImplementationABI } from "./abi/GroupImplementation";
import {
  MAX_GROUP_METADATA_SIZE,
  MAX_MEMBER_METADATA_SIZE,
  type ChatGroupOverview,
  type GroupStatus,
  type JoinMode,
  type MemberRecordView,
  type MemberStatus,
  type MemberView,
  type Role,
} from "./types";
import { parseMetadata, serializeMetadata } from "./utils/json";

export class GroupClient {
  public readonly groupId: bigint;
  public readonly groupAddress: Address;
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;

  constructor(
    groupId: bigint,
    groupAddress: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient
  ) {
    this.groupId = groupId;
    this.groupAddress = groupAddress;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  // --- Reads ---

  public async owner(): Promise<Address> {
    return (await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "owner",
    })) as Address;
  }

  public async pendingOwner(): Promise<Address> {
    return (await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "pendingOwner",
    })) as Address;
  }

  public async status(): Promise<GroupStatus> {
    const s = await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "status",
    });
    return s as GroupStatus;
  }

  public async joinMode(): Promise<JoinMode> {
    const jm = await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "joinMode",
    });
    return jm as JoinMode;
  }

  public async maxMembers(): Promise<bigint> {
    const max = await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "maxMembers",
    });
    return BigInt(max);
  }

  public async memberCount(): Promise<bigint> {
    const count = await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "memberCount",
    });
    return BigInt(count);
  }

  public async metadataVersion(): Promise<number> {
    const v = await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "metadataVersion",
    });
    return Number(v);
  }

  public async getMetadata<T = Record<string, any>>(): Promise<T> {
    const hex = await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "getMetadata",
    });
    return parseMetadata<T>(hex);
  }

  public async isMember(user: Address): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "isMember",
      args: [user],
    })) as boolean;
  }

  public async getMemberRole(user: Address): Promise<Role> {
    const r = await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "getMemberRole",
      args: [user],
    });
    return r as Role;
  }

  public async getMember(user: Address): Promise<MemberRecordView> {
    const rec = (await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "getMember",
      args: [user],
    })) as any;

    return {
      status: rec.status as MemberStatus,
      role: rec.role as Role,
      joinedAt: BigInt(rec.joinedAt),
      muteUntil: BigInt(rec.muteUntil),
      banUntil: BigInt(rec.banUntil),
    };
  }

  public async getMembers(offset = 0n, limit = 50n): Promise<Address[]> {
    const list = (await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "getMembers",
      args: [offset, limit],
    })) as Address[];
    return [...list];
  }

  public async getMemberViews(offset = 0n, limit = 50n): Promise<MemberView[]> {
    const views = (await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "getMemberViews",
      args: [offset, limit],
    })) as any[];

    return views.map((v) => ({
      memberAddress: v.memberAddress,
      status: v.status as MemberStatus,
      role: v.role as Role,
      joinedAt: BigInt(v.joinedAt),
      muteUntil: BigInt(v.muteUntil),
      banUntil: BigInt(v.banUntil),
      metadata: parseMetadata(v.metadata),
      metadataVersion: Number(v.metadataVersion),
    }));
  }

  public async getMemberMetadata<T = Record<string, any>>(
    user: Address
  ): Promise<{ metadata: T; version: number }> {
    const [hex, version] = (await this.publicClient.readContract({
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "getMemberMetadata",
      args: [user],
    })) as [any, any];

    return {
      metadata: parseMetadata<T>(hex),
      version: Number(version),
    };
  }

  public async getGroupOverview(): Promise<ChatGroupOverview> {
    const [own, pend, stat, jMode, maxM, mCount, metaVer, metaHex] = await Promise.all([
      this.owner(),
      this.pendingOwner(),
      this.status(),
      this.joinMode(),
      this.maxMembers(),
      this.memberCount(),
      this.metadataVersion(),
      this.publicClient.readContract({
        address: this.groupAddress,
        abi: GroupImplementationABI,
        functionName: "getMetadata",
      }),
    ]);

    return {
      groupId: this.groupId,
      groupAddress: this.groupAddress,
      owner: own,
      pendingOwner: pend,
      status: stat,
      joinMode: jMode,
      maxMembers: maxM,
      memberCount: mCount,
      metadataVersion: metaVer,
      metadata: parseMetadata(metaHex),
    };
  }

  // --- Writes ---

  private ensureWallet(): WalletClient {
    if (!this.walletClient || !this.walletClient.account) {
      throw new Error("WalletClient with account is required for write operations");
    }
    return this.walletClient;
  }

  public async setMetadata(metaObj: any): Promise<Hash> {
    const wallet = this.ensureWallet();
    const hex = serializeMetadata(metaObj, MAX_GROUP_METADATA_SIZE);

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "setMetadata",
      args: [hex],
    });

    return wallet.writeContract(request);
  }

  public async setJoinMode(mode: JoinMode): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "setJoinMode",
      args: [mode],
    });

    return wallet.writeContract(request);
  }

  public async setMaxMembers(max: bigint): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "setMaxMembers",
      args: [max],
    });

    return wallet.writeContract(request);
  }

  public async transferOwnership(newOwner: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "transferOwnership",
      args: [newOwner],
    });

    return wallet.writeContract(request);
  }

  public async acceptOwnership(): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "acceptOwnership",
    });

    return wallet.writeContract(request);
  }

  public async pause(): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "pause",
    });

    return wallet.writeContract(request);
  }

  public async resume(): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "resume",
    });

    return wallet.writeContract(request);
  }

  public async close(): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "close",
    });

    return wallet.writeContract(request);
  }

  public async join(): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "join",
    });

    return wallet.writeContract(request);
  }

  public async leave(): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "leave",
    });

    return wallet.writeContract(request);
  }

  public async addMember(user: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "addMember",
      args: [user],
    });

    return wallet.writeContract(request);
  }

  public async removeMember(user: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "removeMember",
      args: [user],
    });

    return wallet.writeContract(request);
  }

  public async batchAddMembers(users: Address[]): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "batchAddMembers",
      args: [users],
    });

    return wallet.writeContract(request);
  }

  public async batchRemoveMembers(users: Address[]): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "batchRemoveMembers",
      args: [users],
    });

    return wallet.writeContract(request);
  }

  public async grantRole(user: Address, role: Role): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "grantRole",
      args: [user, role],
    });

    return wallet.writeContract(request);
  }

  public async revokeRole(user: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "revokeRole",
      args: [user],
    });

    return wallet.writeContract(request);
  }

  public async mute(user: Address, durationSeconds: bigint): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "mute",
      args: [user, durationSeconds],
    });

    return wallet.writeContract(request);
  }

  public async unmute(user: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "unmute",
      args: [user],
    });

    return wallet.writeContract(request);
  }

  public async batchMuteMembers(users: Address[], durationSeconds: bigint): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "batchMuteMembers",
      args: [users, durationSeconds],
    });

    return wallet.writeContract(request);
  }

  public async ban(user: Address, durationSeconds: bigint): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "ban",
      args: [user, durationSeconds],
    });

    return wallet.writeContract(request);
  }

  public async unban(user: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "unban",
      args: [user],
    });

    return wallet.writeContract(request);
  }

  public async batchBanMembers(users: Address[], durationSeconds: bigint): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "batchBanMembers",
      args: [users, durationSeconds],
    });

    return wallet.writeContract(request);
  }

  public async batchUnbanMembers(users: Address[]): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "batchUnbanMembers",
      args: [users],
    });

    return wallet.writeContract(request);
  }

  public async setMyMetadata(profileObj: any): Promise<Hash> {
    const wallet = this.ensureWallet();
    const hex = serializeMetadata(profileObj, MAX_MEMBER_METADATA_SIZE);

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "setMyMetadata",
      args: [hex],
    });

    return wallet.writeContract(request);
  }

  public async createInvite(codeHash: Hex, expiresAt: bigint, maxUses: number): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "createInvite",
      args: [codeHash, expiresAt, maxUses],
    });

    return wallet.writeContract(request);
  }

  public async revokeInvite(codeHash: Hex): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "revokeInvite",
      args: [codeHash],
    });

    return wallet.writeContract(request);
  }

  public async useInvite(codeHash: Hex): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.groupAddress,
      abi: GroupImplementationABI,
      functionName: "useInvite",
      args: [codeHash],
    });

    return wallet.writeContract(request);
  }
}
