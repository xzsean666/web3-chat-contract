import type { Address, Hash, PublicClient, WalletClient } from "viem";
import { UserImplementationABI } from "./abi/UserImplementation";
import { ChatStorageFactoryABI } from "./abi/ChatStorageFactory";
import {
  MAX_FRIEND_METADATA_SIZE,
  MAX_USER_METADATA_SIZE,
  MAX_USER_STATE_SIZE,
  type ChatUserOverview,
  type EventWatchOptions,
  type FriendRecordView,
  type FriendStatus,
  type FriendView,
  type UserStatus,
} from "./types";
import { parseMetadata, serializeMetadata } from "./utils/json";

export class UserClient {
  public readonly userAddress: Address;
  public readonly cloneAddress: Address;
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;
  private readonly factoryAddress: Address;

  constructor(
    userAddress: Address,
    cloneAddress: Address,
    factoryAddress: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient
  ) {
    this.userAddress = userAddress;
    this.cloneAddress = cloneAddress;
    this.factoryAddress = factoryAddress;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  // --- Read Operations ---

  public async getStatus(): Promise<UserStatus> {
    const status = await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "status",
    });
    return status as UserStatus;
  }

  public async getMetadata<T = Record<string, any>>(): Promise<T> {
    const hex = await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "getMetadata",
    });
    return parseMetadata<T>(hex);
  }

  public async getMetadataVersion(): Promise<number> {
    const version = await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "metadataVersion",
    });
    return Number(version);
  }

  public async getState<T = Record<string, any>>(): Promise<T> {
    const hex = await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "getState",
    });
    return parseMetadata<T>(hex);
  }

  public async getStateVersion(): Promise<number> {
    const version = await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "stateVersion",
    });
    return Number(version);
  }

  public async friendCount(): Promise<bigint> {
    const count = await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "friendCount",
    });
    return BigInt(count);
  }

  public async isFriend(target: Address): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "isFriend",
      args: [target],
    })) as boolean;
  }

  public async isBlocked(target: Address): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "isBlocked",
      args: [target],
    })) as boolean;
  }

  public async getFriend(target: Address): Promise<FriendRecordView> {
    const rec = (await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "getFriend",
      args: [target],
    })) as any;

    return {
      status: rec.status as FriendStatus,
      since: BigInt(rec.since),
      mutedUntil: BigInt(rec.mutedUntil),
      expiresAt: BigInt(rec.expiresAt),
    };
  }

  public async getFriends(offset = 0n, limit = 50n): Promise<Address[]> {
    const friends = (await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "getFriends",
      args: [offset, limit],
    })) as Address[];
    return [...friends];
  }

  public async getFriendViews(offset = 0n, limit = 50n): Promise<FriendView[]> {
    const views = (await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "getFriendViews",
      args: [offset, limit],
    })) as any[];

    return views.map((v) => ({
      friendAddress: v.friendAddress,
      status: v.status as FriendStatus,
      since: BigInt(v.since),
      mutedUntil: BigInt(v.mutedUntil),
      expiresAt: BigInt(v.expiresAt),
      metadata: parseMetadata(v.metadata),
      metadataVersion: Number(v.metadataVersion),
    }));
  }

  public async getFriendMetadata<T = Record<string, any>>(
    target: Address
  ): Promise<{ metadata: T; version: number }> {
    const [hex, version] = (await this.publicClient.readContract({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "getFriendMetadata",
      args: [target],
    })) as [any, any];

    return {
      metadata: parseMetadata<T>(hex),
      version: Number(version),
    };
  }

  public async getCurrentUser(): Promise<ChatUserOverview> {
    if (this.factoryAddress && this.factoryAddress !== "0x0000000000000000000000000000000000000000") {
      const overview = (await this.publicClient.readContract({
        address: this.factoryAddress,
        abi: ChatStorageFactoryABI,
        functionName: "getUserOverview",
        args: [this.userAddress],
      })) as any;

      return {
        userAddress: overview.userAddress,
        cloneAddress: overview.cloneAddress,
        status: overview.status as UserStatus,
        metadataVersion: Number(overview.metadataVersion),
        metadata: parseMetadata(overview.metadata),
        stateVersion: Number(overview.stateVersion),
        state: parseMetadata(overview.state),
        friendCount: BigInt(overview.friendCount),
        groupCount: BigInt(overview.groupCount),
      };
    }

    const [status, metadataHex, metaVer, stateHex, stateVer, fCount] = await Promise.all([
      this.getStatus(),
      this.publicClient.readContract({
        address: this.cloneAddress,
        abi: UserImplementationABI,
        functionName: "getMetadata",
      }),
      this.getMetadataVersion(),
      this.publicClient.readContract({
        address: this.cloneAddress,
        abi: UserImplementationABI,
        functionName: "getState",
      }),
      this.getStateVersion(),
      this.friendCount(),
    ]);

    return {
      userAddress: this.userAddress,
      cloneAddress: this.cloneAddress,
      status,
      metadataVersion: metaVer,
      metadata: parseMetadata(metadataHex),
      stateVersion: stateVer,
      state: parseMetadata(stateHex),
      friendCount: fCount,
      groupCount: 0n,
    };
  }

  // --- Write Operations (Simulate + Write) ---

  private ensureWallet(): WalletClient {
    if (!this.walletClient || !this.walletClient.account) {
      throw new Error("WalletClient with account is required for write operations");
    }
    return this.walletClient;
  }

  public async setMetadata(metadataObj: any): Promise<Hash> {
    const wallet = this.ensureWallet();
    const hex = serializeMetadata(metadataObj, MAX_USER_METADATA_SIZE);

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "setMetadata",
      args: [hex],
    });

    return wallet.writeContract(request);
  }

  public async setState(stateObj: any): Promise<Hash> {
    const wallet = this.ensureWallet();
    const hex = serializeMetadata(stateObj, MAX_USER_STATE_SIZE);

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "setState",
      args: [hex],
    });

    return wallet.writeContract(request);
  }

  public async setStatus(newStatus: UserStatus): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "setStatus",
      args: [newStatus],
    });

    return wallet.writeContract(request);
  }

  public async setFriendMetadata(target: Address, noteObj: any): Promise<Hash> {
    const wallet = this.ensureWallet();
    const hex = serializeMetadata(noteObj, MAX_FRIEND_METADATA_SIZE);

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "setFriendMetadata",
      args: [target, hex],
    });

    return wallet.writeContract(request);
  }

  public async muteFriend(target: Address, durationSeconds: bigint): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "muteFriend",
      args: [target, durationSeconds],
    });

    return wallet.writeContract(request);
  }

  public async unmuteFriend(target: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "unmuteFriend",
      args: [target],
    });

    return wallet.writeContract(request);
  }

  public async blockUser(target: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "blockUser",
      args: [target],
    });

    return wallet.writeContract(request);
  }

  public async unblockUser(target: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.cloneAddress,
      abi: UserImplementationABI,
      functionName: "unblockUser",
      args: [target],
    });

    return wallet.writeContract(request);
  }

  // --- Event Subscriptions ---

  public watchEvents(options: EventWatchOptions): () => void {
    return this.publicClient.watchContractEvent({
      address: this.cloneAddress,
      abi: UserImplementationABI,
      onLogs: options.onLogs,
      onError: options.onError,
      pollingInterval: options.pollingInterval,
    });
  }
}
