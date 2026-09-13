// SPDX-License-Identifier: MIT
import type { Address, Hash, PublicClient, WalletClient } from "viem";
import { RelationshipManagerABI } from "./abi/RelationshipManager";
import type { EventWatchOptions } from "./types";

export class RelationshipClient {
  public readonly address: Address;
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;

  constructor(address: Address, publicClient: PublicClient, walletClient?: WalletClient) {
    this.address = address;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  private ensureWallet(): WalletClient {
    if (!this.walletClient || !this.walletClient.account) {
      throw new Error("WalletClient with account is required for write operations");
    }
    return this.walletClient;
  }

  public async sendRequest(target: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.address,
      abi: RelationshipManagerABI,
      functionName: "sendFriendRequest",
      args: [target],
    });

    return wallet.writeContract(request);
  }

  public async sendRequestWithExpiry(target: Address, expiresAt: bigint): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.address,
      abi: RelationshipManagerABI,
      functionName: "sendFriendRequestWithExpiry",
      args: [target, expiresAt],
    });

    return wallet.writeContract(request);
  }

  public async acceptRequest(requester: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.address,
      abi: RelationshipManagerABI,
      functionName: "acceptFriendRequest",
      args: [requester],
    });

    return wallet.writeContract(request);
  }

  public async rejectRequest(requester: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.address,
      abi: RelationshipManagerABI,
      functionName: "rejectFriendRequest",
      args: [requester],
    });

    return wallet.writeContract(request);
  }

  public async cancelRequest(target: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.address,
      abi: RelationshipManagerABI,
      functionName: "cancelFriendRequest",
      args: [target],
    });

    return wallet.writeContract(request);
  }

  public async removeFriend(friend: Address): Promise<Hash> {
    const wallet = this.ensureWallet();

    const { request } = await this.publicClient.simulateContract({
      account: wallet.account!,
      address: this.address,
      abi: RelationshipManagerABI,
      functionName: "removeFriend",
      args: [friend],
    });

    return wallet.writeContract(request);
  }

  // --- Event Subscriptions ---

  public watchEvents(options: EventWatchOptions): () => void {
    return this.publicClient.watchContractEvent({
      address: this.address,
      abi: RelationshipManagerABI,
      onLogs: options.onLogs,
      onError: options.onError,
      pollingInterval: options.pollingInterval,
    });
  }
}
