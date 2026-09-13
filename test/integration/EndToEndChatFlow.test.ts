import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { stringToHex, type Address } from "viem";

describe("End-to-End Multi-Contract Integration Test", () => {
  let viem: any;
  let factory: any;
  let relMgr: any;
  let userImpl: any;
  let groupImpl: any;

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

    // Register Users
    await factory.write.createUser({ account: alice.account });
    await factory.write.createUser({ account: bob.account });
    await factory.write.createUser({ account: charlie.account });

    const aliceAddr = await factory.read.getUserContract([alice.account.address]);
    const bobAddr = await factory.read.getUserContract([bob.account.address]);
    const charlieAddr = await factory.read.getUserContract([charlie.account.address]);

    aliceUser = await viem.getContractAt("UserImplementation", aliceAddr);
    bobUser = await viem.getContractAt("UserImplementation", bobAddr);
    charlieUser = await viem.getContractAt("UserImplementation", charlieAddr);
  });

  it("executes complete lifecycle: profiles, friendship, group creation, membership sync and closure", async () => {
    // 1. Profiles & Metadata
    await aliceUser.write.setMetadata(
      [stringToHex(JSON.stringify({ name: "Alice", bio: "Web3 Builder" }))],
      { account: alice.account }
    );
    await bobUser.write.setMetadata(
      [stringToHex(JSON.stringify({ name: "Bob", bio: "Smart Contract Engineer" }))],
      { account: bob.account }
    );

    // 2. Alice & Bob Friendship Handshake
    await relMgr.write.sendFriendRequest([bob.account.address], {
      account: alice.account,
    });
    await relMgr.write.acceptFriendRequest([alice.account.address], {
      account: bob.account,
    });

    assert.strictEqual(await aliceUser.read.isFriend([bob.account.address]), true);
    assert.strictEqual(await bobUser.read.isFriend([alice.account.address]), true);
    assert.strictEqual(await aliceUser.read.friendCount(), 1n);

    // 3. Alice creates a group with Bob as initial member
    const groupMeta = stringToHex(
      JSON.stringify({ name: "Ethereum Core", desc: "Core discussion group" })
    );
    await factory.write.createGroup([groupMeta, [bob.account.address], 0, 50], {
      account: alice.account,
    });

    const groupId = 1n;
    const groupAddr = await factory.read.getGroup([groupId]);
    const group = await viem.getContractAt("GroupImplementation", groupAddr);

    assert.strictEqual(
      (await group.read.owner()).toLowerCase(),
      alice.account.address.toLowerCase()
    );
    assert.strictEqual(await group.read.memberCount(), 2n);
    assert.strictEqual(await group.read.isMember([alice.account.address]), true);
    assert.strictEqual(await group.read.isMember([bob.account.address]), true);

    // 4. Verify Factory Indexing
    assert.strictEqual(await factory.read.userGroupCount([alice.account.address]), 1n);
    assert.strictEqual(await factory.read.userGroupCount([bob.account.address]), 1n);
    assert.strictEqual(await factory.read.userGroupCount([charlie.account.address]), 0n);

    const aliceGroups = await factory.read.getUserGroups([alice.account.address, 0n, 10n]);
    assert.strictEqual(aliceGroups.length, 1);
    assert.strictEqual(aliceGroups[0], groupId);

    // 5. Charlie joins group
    await group.write.join({ account: charlie.account });
    assert.strictEqual(await group.read.memberCount(), 3n);
    assert.strictEqual(await group.read.isMember([charlie.account.address]), true);
    assert.strictEqual(await factory.read.userGroupCount([charlie.account.address]), 1n);

    // 6. Factory Aggregate Overviews
    const aliceOverview = await factory.read.getUserOverview([alice.account.address]);
    assert.strictEqual(aliceOverview.friendCount, 1n);
    assert.strictEqual(aliceOverview.groupCount, 1n);

    const groupOverview = await factory.read.getGroupOverview([groupId]);
    assert.strictEqual(groupOverview.memberCount, 3n);
    assert.strictEqual(
      groupOverview.owner.toLowerCase(),
      alice.account.address.toLowerCase()
    );

    // 7. Role Management & Moderation
    await group.write.grantRole([bob.account.address, 2], {
      account: alice.account,
    }); // ADMIN
    assert.strictEqual(await group.read.getMemberRole([bob.account.address]), 2);

    // Bob as ADMIN mutes Charlie
    await group.write.mute([charlie.account.address, 3600n], {
      account: bob.account,
    });
    const charlieRec = await group.read.getMember([charlie.account.address]);
    assert.ok(charlieRec.muteUntil > 0n);

    // 8. Charlie leaves group
    await group.write.leave({ account: charlie.account });
    assert.strictEqual(await group.read.isMember([charlie.account.address]), false);
    assert.strictEqual(await factory.read.userGroupCount([charlie.account.address]), 0n);

    // 9. Alice closes the group
    await group.write.close({ account: alice.account });
    assert.strictEqual(await group.read.status(), 2); // CLOSED
  });
});
