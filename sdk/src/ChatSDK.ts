// SPDX-License-Identifier: MIT
import {
  createPublicClient,
  type Address,
  type Chain,
  type Hash,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { ChatStorageFactoryABI } from "./abi/ChatStorageFactory";
import { GroupClient } from "./GroupClient";
import { RelationshipClient } from "./RelationshipClient";
import {
  JoinMode,
  MAX_GROUP_METADATA_SIZE,
  type ChatGroupOverview,
  type ChatSDKOptions,
  type ChatUserOverview,
  type GroupStatus,
  type UserStatus,
} from "./types";
import { UserClient } from "./UserClient";
import { parseMetadata, serializeMetadata } from "./utils/json";
import { RpcPoolManager } from "./utils/rpcPool";

export class ChatSDK {
  public readonly factoryAddress: Address;
  public readonly chain: Chain;
  public readonly publicClient: PublicClient;
  public walletClient?: WalletClient;

  private relationshipManagerAddress?: Address;
  private relationshipClientInstance?: RelationshipClient;

  constructor(options: ChatSDKOptions) {
    this.factoryAddress = options.factoryAddress;
    this.chain = options.chain;
    this.walletClient = options.walletClient;

    if (options.publicClient) {
      this.publicClient = options.publicClient;
    } else {
      let transport: Transport;
      if (options.transport) {
        transport = options.transport;
      } else if (options.rpcPool) {
        const poolManager = new RpcPoolManager(options.rpcPool);
        transport = poolManager.toTransport();
      } else {
        throw new Error("Either publicClient, transport, or rpcPool must be provided in ChatSDKOptions");
      }

      this.publicClient = createPublicClient({
        chain: this.chain,
        transport,
        batch: {
          multicall: {
            batchSize: options.batch?.multicall?.batchSize ?? 1024,
            wait: options.batch?.multicall?.wait ?? 16,
          },
        },
      });
    }
  }

  public setWalletClient(wallet: WalletClient): void {
    this.walletClient = wallet;
    this.relationshipClientInstance = undefined;
  }

  // --- Relationship Coordination ---

  public async getRelationshipManagerAddress(): Promise<Address> {
    if (!this.relationshipManagerAddress) {
      this.relationshipManagerAddress = (await this.publicClient.readContract({
        address: this.factoryAddress,
        abi: ChatStorageFactoryABI,
        functionName: "relationshipManager",
      })) as Address;
    }
    return this.relationshipManagerAddress;
  }

  public async relationship(): Promise<RelationshipClient> {
    if (!this.relationshipClientInstance) {
      const addr = await this.getRelationshipManagerAddress();
      this.relationshipClientInstance = new RelationshipClient(addr, this.publicClient, this.walletClient);
    }
    return this.relationshipClientInstance;
  }

  // --- User Facade ---

  public async getUserContract(userAddress: Address): Promise<Address> {
    return (await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: ChatStorageFactoryABI,
      functionName: "getUserContract",
      args: [userAddress],
    })) as Address;
  }

  public async user(userAddress?: Address): Promise<UserClient> {
    const target = userAddress || this.walletClient?.account?.address;
    if (!target) {
      throw new Error("User address must be provided or walletClient must have an active account");
    }

    const cloneAddr = await this.getUserContract(target);
    if (!cloneAddr || cloneAddr === "0x0000000000000000000000000000000000000000") {
      throw new Error(`User ${target} is not registered in ChatStorageFactory`);
    }

    return new UserClient(target, cloneAddr, this.factoryAddress, this.publicClient, this.walletClient);
  }

  // --- Group Facade ---

  public async getGroup(groupId: bigint): Promise<Address> {
    return (await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: ChatStorageFactoryABI,
      functionName: "getGroup",
      args: [groupId],
    })) as Address;
  }

  public async group(groupId: bigint): Promise<GroupClient> {
    const groupAddr = await this.getGroup(groupId);
    if (!groupAddr || groupAddr === "0x0000000000000000000000000000000000000000") {
      throw new Error(`Group ${groupId} does not exist`);
    }

    return new GroupClient(groupId, groupAddr, this.publicClient, this.walletClient);
  }

  // --- Factory Operations ---

  private ensureWallet(): WalletClient {
    if (!this.walletClient || !this.walletClient.account) {
      throw new Error("WalletClient with account is required for write operations");
    }
    return this.walletClient;
  }

  public async createUser(): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.factoryAddress,
      abi: ChatStorageFactoryABI,
      functionName: "createUser",
    });

    return wallet.writeContract(request);
  }

  public async createGroup(
    metadataObj: any,
    initialMembers: Address[] = [],
    joinMode: JoinMode = JoinMode.PUBLIC,
    maxMembers = 0n
  ): Promise<Hash> {
    const wallet = this.ensureWallet();
    const metaHex = serializeMetadata(metadataObj, MAX_GROUP_METADATA_SIZE);

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.factoryAddress,
      abi: ChatStorageFactoryABI,
      functionName: "createGroup",
      args: [metaHex, initialMembers, joinMode, maxMembers],
    });

    return wallet.writeContract(request);
  }

  public async groupCount(): Promise<bigint> {
    const count = await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: ChatStorageFactoryABI,
      functionName: "groupCount",
    });
    return BigInt(count);
  }

  public async getGroups(offset = 0n, limit = 50n): Promise<Address[]> {
    const groups = (await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: ChatStorageFactoryABI,
      functionName: "getGroups",
      args: [offset, limit],
    })) as Address[];
    return [...groups];
  }

  public async getUserGroups(user: Address, offset = 0n, limit = 50n): Promise<bigint[]> {
    const groups = (await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: ChatStorageFactoryABI,
      functionName: "getUserGroups",
      args: [user, offset, limit],
    })) as bigint[];
    return groups.map((g) => BigInt(g));
  }

  // --- Multicall3 Aggregated Overview Reads ---

  public async getCurrentUser(userAddress?: Address): Promise<ChatUserOverview> {
    const target = userAddress || this.walletClient?.account?.address;
    if (!target) {
      throw new Error("User address must be provided or walletClient must have an active account");
    }

    const overview = (await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: ChatStorageFactoryABI,
      functionName: "getUserOverview",
      args: [target],
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

  public async getGroupOverview(groupId: bigint): Promise<ChatGroupOverview> {
    const overview = (await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: ChatStorageFactoryABI,
      functionName: "getGroupOverview",
      args: [groupId],
    })) as any;

    return {
      groupId: BigInt(overview.groupId),
      groupAddress: overview.groupAddress,
      owner: overview.owner,
      pendingOwner: overview.pendingOwner,
      status: overview.status as GroupStatus,
      joinMode: overview.joinMode as JoinMode,
      maxMembers: BigInt(overview.maxMembers),
      memberCount: BigInt(overview.memberCount),
      metadataVersion: Number(overview.metadataVersion),
      metadata: parseMetadata(overview.metadata),
    };
  }
}
