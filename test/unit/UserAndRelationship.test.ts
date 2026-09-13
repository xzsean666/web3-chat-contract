import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { stringToHex, toHex, type Address } from "viem";

describe("UserImplementation & RelationshipManager Tests", () => {
  let viem: any;
  let factory: any;
  let relMgr: any;
  let userImpl: any;
  let groupImpl: any;

  let deployer: any;
  let alice: any;
  let bob: any;
  let charlie: any;

  let aliceUser: any;
  let bobUser: any;
  let charlieUser: any;

  beforeEach(async () => {
    const conn = await hre.network.getOrCreate();
    viem = conn.viem;
    const clients = await viem.getWalletClients();
    deployer = clients[0];
    alice = clients[1];
    bob = clients[2];
    charlie = clients[3];

    userImpl = await viem.deployContract("UserImplementation");
    groupImpl = await viem.deployContract("GroupImplementation");
    factory = await viem.deployContract("ChatStorageFactory", [
      userImpl.address,
      groupImpl.address,
    ]);
    relMgr = await viem.deployContract("RelationshipManager", [factory.address]);

    await factory.write.setRelationshipManager([relMgr.address]);

    // Create User Clones
    await factory.write.createUser({ account: alice.account });
    const aliceClone = await factory.read.getUserContract([alice.account.address]);
    aliceUser = await viem.getContractAt("UserImplementation", aliceClone);

    await factory.write.createUser({ account: bob.account });
    const bobClone = await factory.read.getUserContract([bob.account.address]);
    bobUser = await viem.getContractAt("UserImplementation", bobClone);

    await factory.write.createUser({ account: charlie.account });
    const charlieClone = await factory.read.getUserContract([charlie.account.address]);
    charlieUser = await viem.getContractAt("UserImplementation", charlieClone);
  });

  it("initializes clone correctly and prevents double initialization", async () => {
    assert.strictEqual(
      (await aliceUser.read.account()).toLowerCase(),
      alice.account.address.toLowerCase()
    );
    assert.strictEqual(await aliceUser.read.status(), 0); // ACTIVE
    assert.strictEqual(await aliceUser.read.friendCount(), 0n);
    assert.strictEqual(
      (await aliceUser.read.factory()).toLowerCase(),
      factory.address.toLowerCase()
    );
    assert.strictEqual(
      (await aliceUser.read.relationshipManager()).toLowerCase(),
      relMgr.address.toLowerCase()
    );

    // Cannot reinitialize
    await assert.rejects(async () => {
      await aliceUser.write.initialize(
        [alice.account.address, relMgr.address, factory.address],
        { account: alice.account }
      );
    });
  });

  it("updates user metadata and state with length checks", async () => {
    const metaStr = JSON.stringify({ name: "Alice", avatar: "ipfs://alice" });
    const stateStr = JSON.stringify({ theme: "dark" });

    await aliceUser.write.setMetadata([stringToHex(metaStr)], {
      account: alice.account,
    });
    await aliceUser.write.setState([stringToHex(stateStr)], {
      account: alice.account,
    });

    const storedMeta = await aliceUser.read.getMetadata();
    assert.strictEqual(storedMeta, stringToHex(metaStr));
    assert.strictEqual(await aliceUser.read.metadataVersion(), 1);

    const storedState = await aliceUser.read.getState();
    assert.strictEqual(storedState, stringToHex(stateStr));
    assert.strictEqual(await aliceUser.read.stateVersion(), 1);

    // Non-owner cannot update
    await assert.rejects(async () => {
      await aliceUser.write.setMetadata([stringToHex("hack")], {
        account: bob.account,
      });
    });

    // Overflow max metadata (4096 bytes)
    const largeMeta = "x".repeat(4097);
    await assert.rejects(async () => {
      await aliceUser.write.setMetadata([stringToHex(largeMeta)], {
        account: alice.account,
      });
    });
  });

  it("handles friend request, accept, and state synchronization", async () => {
    // Alice sends friend request to Bob
    await relMgr.write.sendFriendRequest([bob.account.address], {
      account: alice.account,
    });

    // Verify Pending states
    const aliceRecordForBob = await aliceUser.read.getFriend([bob.account.address]);
    const bobRecordForAlice = await bobUser.read.getFriend([alice.account.address]);

    assert.strictEqual(aliceRecordForBob.status, 2); // PENDING_OUT
    assert.strictEqual(bobRecordForAlice.status, 1); // PENDING_IN

    // Bob accepts friend request
    await relMgr.write.acceptFriendRequest([alice.account.address], {
      account: bob.account,
    });

    assert.strictEqual(await aliceUser.read.isFriend([bob.account.address]), true);
    assert.strictEqual(await bobUser.read.isFriend([alice.account.address]), true);
    assert.strictEqual(await aliceUser.read.friendCount(), 1n);
    assert.strictEqual(await bobUser.read.friendCount(), 1n);

    // Check pagination
    const friends = await aliceUser.read.getFriends([0n, 10n]);
    assert.strictEqual(friends.length, 1);
    assert.strictEqual(friends[0].toLowerCase(), bob.account.address.toLowerCase());
  });

  it("handles friend rejection and cancellation flows", async () => {
    // 1. Send & Reject
    await relMgr.write.sendFriendRequest([bob.account.address], {
      account: alice.account,
    });
    await relMgr.write.rejectFriendRequest([alice.account.address], {
      account: bob.account,
    });

    assert.strictEqual(await aliceUser.read.isFriend([bob.account.address]), false);
    assert.strictEqual(await bobUser.read.isFriend([alice.account.address]), false);

    // 2. Send & Cancel
    await relMgr.write.sendFriendRequest([bob.account.address], {
      account: alice.account,
    });
    await relMgr.write.cancelFriendRequest([bob.account.address], {
      account: alice.account,
    });

    assert.strictEqual(await aliceUser.read.isFriend([bob.account.address]), false);
  });

  it("removes friend properly from both clones", async () => {
    await relMgr.write.sendFriendRequest([bob.account.address], {
      account: alice.account,
    });
    await relMgr.write.acceptFriendRequest([alice.account.address], {
      account: bob.account,
    });

    assert.strictEqual(await aliceUser.read.friendCount(), 1n);

    await relMgr.write.removeFriend([bob.account.address], {
      account: alice.account,
    });

    assert.strictEqual(await aliceUser.read.isFriend([bob.account.address]), false);
    assert.strictEqual(await bobUser.read.isFriend([alice.account.address]), false);
    assert.strictEqual(await aliceUser.read.friendCount(), 0n);
    assert.strictEqual(await bobUser.read.friendCount(), 0n);
  });

  it("manages muting and unmuting friends", async () => {
    await relMgr.write.sendFriendRequest([bob.account.address], {
      account: alice.account,
    });
    await relMgr.write.acceptFriendRequest([alice.account.address], {
      account: bob.account,
    });

    // Mute for 3600 seconds
    await aliceUser.write.muteFriend([bob.account.address, 3600n], {
      account: alice.account,
    });

    let rec = await aliceUser.read.getFriend([bob.account.address]);
    assert.ok(rec.mutedUntil > 0n);

    // Unmute
    await aliceUser.write.unmuteFriend([bob.account.address], {
      account: alice.account,
    });
    rec = await aliceUser.read.getFriend([bob.account.address]);
    assert.strictEqual(rec.mutedUntil, 0n);
  });

  it("blocks user, removes friendship, and blocks inbound requests", async () => {
    await relMgr.write.sendFriendRequest([bob.account.address], {
      account: alice.account,
    });
    await relMgr.write.acceptFriendRequest([alice.account.address], {
      account: bob.account,
    });

    // Alice blocks Bob
    await aliceUser.write.blockUser([bob.account.address], {
      account: alice.account,
    });

    assert.strictEqual(await aliceUser.read.isBlocked([bob.account.address]), true);
    assert.strictEqual(await aliceUser.read.isFriend([bob.account.address]), false);

    // Bob cannot send friend request to Alice while blocked
    await assert.rejects(async () => {
      await relMgr.write.sendFriendRequest([alice.account.address], {
        account: bob.account,
      });
    });

    // Alice unblocks Bob
    await aliceUser.write.unblockUser([bob.account.address], {
      account: alice.account,
    });
    assert.strictEqual(await aliceUser.read.isBlocked([bob.account.address]), false);
  });

  it("updates personal friend remark metadata", async () => {
    await relMgr.write.sendFriendRequest([bob.account.address], {
      account: alice.account,
    });
    await relMgr.write.acceptFriendRequest([alice.account.address], {
      account: bob.account,
    });

    const remark = JSON.stringify({ nickname: "Bobby", tag: "VIP" });
    await aliceUser.write.setFriendMetadata(
      [bob.account.address, stringToHex(remark)],
      { account: alice.account }
    );

    const [storedRemark, version] = await aliceUser.read.getFriendMetadata([
      bob.account.address,
    ]);
    assert.strictEqual(storedRemark, stringToHex(remark));
    assert.strictEqual(version, 1);
  });

  it("enforces UserDisabled status on mutations and relationship operations", async () => {
    // Charlie disables account
    await charlieUser.write.setStatus([1], { account: charlie.account }); // DISABLED
    assert.strictEqual(await charlieUser.read.status(), 1);

    // Disabled user cannot set metadata or state
    await assert.rejects(async () => {
      await charlieUser.write.setMetadata([stringToHex("test")], {
        account: charlie.account,
      });
    });
    await assert.rejects(async () => {
      await charlieUser.write.setState([stringToHex("test")], {
        account: charlie.account,
      });
    });

    // Disabled user cannot send friend request
    await assert.rejects(async () => {
      await relMgr.write.sendFriendRequest([alice.account.address], {
        account: charlie.account,
      });
    });

    // Other user cannot send friend request to disabled user
    await assert.rejects(async () => {
      await relMgr.write.sendFriendRequest([charlie.account.address], {
        account: alice.account,
      });
    });

    // Reactivate account
    await charlieUser.write.setStatus([0], { account: charlie.account }); // ACTIVE
    assert.strictEqual(await charlieUser.read.status(), 0);
  });

  it("safely paginates friends without arithmetic overflow on large limit", async () => {
    await relMgr.write.sendFriendRequest([bob.account.address], {
      account: alice.account,
    });
    await relMgr.write.acceptFriendRequest([alice.account.address], {
      account: bob.account,
    });

    // Max uint256 limit (would previously cause arithmetic overflow in offset + limit)
    const maxUint256 = (1n << 256n) - 1n;
    const friends = await aliceUser.read.getFriends([0n, maxUint256]);
    assert.strictEqual(friends.length, 1);
    assert.strictEqual(friends[0].toLowerCase(), bob.account.address.toLowerCase());

    const friendViews = await aliceUser.read.getFriendViews([0n, maxUint256]);
    assert.strictEqual(friendViews.length, 1);
    assert.strictEqual(friendViews[0].friendAddress.toLowerCase(), bob.account.address.toLowerCase());
  });

  it("rejects muting a non-friend with NotFriends", async () => {
    await assert.rejects(async () => {
      await aliceUser.write.muteFriend([charlie.account.address, 3600n], {
        account: alice.account,
      });
    });

    await assert.rejects(async () => {
      await aliceUser.write.unmuteFriend([charlie.account.address], {
        account: alice.account,
      });
    });
  });
});

