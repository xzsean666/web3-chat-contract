// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ChatSDK,
  FriendStatus,
  GroupStatus,
  JoinMode,
  UserStatus,
} from "../../src";
import { anvilChain, deployLocalProtocol, type DeployedContracts } from "../fixtures/deploy";

const ANVIL_PORT = 8546;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

describe("E2E Chat SDK with Anvil Sandbox", () => {
  let anvilProcess: ChildProcess;
  let deployed: DeployedContracts;
  let publicClient: PublicClient;

  let aliceWallet: WalletClient;
  let bobWallet: WalletClient;
  let aliceAddress: Address;
  let bobAddress: Address;

  let sdkAlice: ChatSDK;
  let sdkBob: ChatSDK;

  beforeAll(async () => {
    // 1. Spawn Anvil process on custom port
    anvilProcess = spawn("anvil", ["--port", ANVIL_PORT.toString(), "--silent"]);

    // Wait until Anvil responds
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
        });
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (!ready) {
      throw new Error(`Anvil failed to start on port ${ANVIL_PORT}`);
    }

    // 2. Deploy contracts
    deployed = await deployLocalProtocol(RPC_URL);
    publicClient = deployed.publicClient;

    // 3. Setup test wallets
    const aliceAccount = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const bobAccount = privateKeyToAccount(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    );

    aliceAddress = aliceAccount.address;
    bobAddress = bobAccount.address;

    aliceWallet = createWalletClient({
      account: aliceAccount,
      chain: anvilChain,
      transport: http(RPC_URL),
    });

    bobWallet = createWalletClient({
      account: bobAccount,
      chain: anvilChain,
      transport: http(RPC_URL),
    });

    // 4. Initialize SDKs
    sdkAlice = new ChatSDK({
      factoryAddress: deployed.factory,
      chain: anvilChain,
      publicClient,
      walletClient: aliceWallet,
    });

    sdkBob = new ChatSDK({
      factoryAddress: deployed.factory,
      chain: anvilChain,
      publicClient,
      walletClient: bobWallet,
    });
  }, 20_000);

  afterAll(() => {
    if (anvilProcess) {
      anvilProcess.kill();
    }
  });

  it("1. registers UserClone for Alice and Bob", async () => {
    const aliceTx = await sdkAlice.createUser();
    await publicClient.waitForTransactionReceipt({ hash: aliceTx });

    const bobTx = await sdkBob.createUser();
    await publicClient.waitForTransactionReceipt({ hash: bobTx });

    const aliceClone = await sdkAlice.getUserContract(aliceAddress);
    const bobClone = await sdkAlice.getUserContract(bobAddress);

    expect(aliceClone.startsWith("0x")).toBe(true);
    expect(bobClone.startsWith("0x")).toBe(true);
    expect(aliceClone).not.toBe(bobClone);
  });

  it("2. updates Alice's user profile and state", async () => {
    const userAlice = await sdkAlice.user();

    const profile = { displayName: "Alice Web3", avatar: "ipfs://bafy..." };
    const tx1 = await userAlice.setMetadata(profile);
    await publicClient.waitForTransactionReceipt({ hash: tx1 });

    const state = { soundEnabled: false, theme: "cyberpunk" };
    const tx2 = await userAlice.setState(state);
    await publicClient.waitForTransactionReceipt({ hash: tx2 });

    const savedProfile = await userAlice.getMetadata();
    const savedState = await userAlice.getState();
    const metaVer = await userAlice.getMetadataVersion();
    const stateVer = await userAlice.getStateVersion();

    expect(savedProfile).toEqual(profile);
    expect(savedState).toEqual(state);
    expect(metaVer).toBe(1);
    expect(stateVer).toBe(1);
  });

  it("3. handles friend handshake between Alice and Bob", async () => {
    const relAlice = await sdkAlice.relationship();
    const relBob = await sdkBob.relationship();

    // Alice sends friend request to Bob
    const txSend = await relAlice.sendRequest(bobAddress);
    await publicClient.waitForTransactionReceipt({ hash: txSend });

    const userAlice = await sdkAlice.user();
    const userBob = await sdkBob.user();

    const aliceRecord = await userAlice.getFriend(bobAddress);
    const bobRecord = await userBob.getFriend(aliceAddress);

    expect(aliceRecord.status).toBe(FriendStatus.PENDING_OUT);
    expect(bobRecord.status).toBe(FriendStatus.PENDING_IN);

    // Bob accepts friend request
    const txAccept = await relBob.acceptRequest(aliceAddress);
    await publicClient.waitForTransactionReceipt({ hash: txAccept });

    const isFriendAlice = await userAlice.isFriend(bobAddress);
    const isFriendBob = await userBob.isFriend(aliceAddress);
    const countAlice = await userAlice.friendCount();
    const countBob = await userBob.friendCount();

    expect(isFriendAlice).toBe(true);
    expect(isFriendBob).toBe(true);
    expect(countAlice).toBe(1n);
    expect(countBob).toBe(1n);
  });

  it("4. sets private friend metadata for Alice on Bob", async () => {
    const userAlice = await sdkAlice.user();
    const userBob = await sdkBob.user();

    const note = { alias: "Bob (Core Dev)", privateNote: "met at Devcon" };
    const tx = await userAlice.setFriendMetadata(bobAddress, note);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const { metadata, version } = await userAlice.getFriendMetadata(bobAddress);
    expect(metadata).toEqual(note);
    expect(version).toBe(1);

    // Bob does not see or possess Alice's note
    const bobOnAlice = await userBob.getFriendMetadata(aliceAddress);
    expect(bobOnAlice.metadata).toEqual({});
    expect(bobOnAlice.version).toBe(0);
  });

  it("5. Alice creates a group and Bob joins", async () => {
    const groupMeta = { name: "Ethereum Builders", desc: "Contract testing" };
    const tx = await sdkAlice.createGroup(groupMeta, [], JoinMode.PUBLIC, 100n);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    expect(receipt.status).toBe("success");

    const totalGroups = await sdkAlice.groupCount();
    expect(totalGroups).toBe(1n);

    // Group ID is 1
    const groupAlice = await sdkAlice.group(1n);
    const groupBob = await sdkBob.group(1n);

    expect(await groupAlice.owner()).toBe(aliceAddress);
    expect(await groupAlice.memberCount()).toBe(1n); // Alice is initial member

    // Bob joins group
    const txJoin = await groupBob.join();
    await publicClient.waitForTransactionReceipt({ hash: txJoin });

    expect(await groupAlice.memberCount()).toBe(2n);
    expect(await groupAlice.isMember(bobAddress)).toBe(true);

    // Bob updates member metadata in group
    const card = { title: "Lead Protocol Engineer", handle: "@bob_eth" };
    const txCard = await groupBob.setMyMetadata(card);
    await publicClient.waitForTransactionReceipt({ hash: txCard });

    const memberCard = await groupAlice.getMemberMetadata(bobAddress);
    expect(memberCard.metadata).toEqual(card);
  });

  it("6. Alice moderates Bob (mute & remove) in the group", async () => {
    const groupAlice = await sdkAlice.group(1n);

    // Alice mutes Bob
    const txMute = await groupAlice.mute(bobAddress, 3600n);
    await publicClient.waitForTransactionReceipt({ hash: txMute });

    const bobMember = await groupAlice.getMember(bobAddress);
    expect(bobMember.muteUntil).toBeGreaterThan(0n);

    // Alice removes Bob from group
    const txRemove = await groupAlice.removeMember(bobAddress);
    await publicClient.waitForTransactionReceipt({ hash: txRemove });

    expect(await groupAlice.isMember(bobAddress)).toBe(false);
    expect(await groupAlice.memberCount()).toBe(1n);
  });

  it("7. retrieves aggregated Overviews with single Multicall / call", async () => {
    const userOverview = await sdkAlice.getCurrentUser(aliceAddress);
    expect(userOverview.userAddress).toBe(aliceAddress);
    expect(userOverview.friendCount).toBe(1n);
    expect(userOverview.metadata.displayName).toBe("Alice Web3");

    const groupOverview = await sdkAlice.getGroupOverview(1n);
    expect(groupOverview.groupId).toBe(1n);
    expect(groupOverview.owner).toBe(aliceAddress);
    expect(groupOverview.status).toBe(GroupStatus.ACTIVE);
    expect(groupOverview.memberCount).toBe(1n);
    expect(groupOverview.metadata.name).toBe("Ethereum Builders");
  });

  it("8. pre-flight simulation intercepts invalid transactions cleanly", async () => {
    const relAlice = await sdkAlice.relationship();

    // Sending friend request while already friends must be intercepted by simulateContract
    await expect(relAlice.sendRequest(bobAddress)).rejects.toThrow();
  });
});
