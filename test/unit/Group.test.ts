import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { stringToHex, type Address } from "viem";

describe("GroupImplementation Tests", () => {
  let viem: any;
  let factory: any;
  let relMgr: any;
  let userImpl: any;
  let groupImpl: any;

  let deployer: any;
  let owner: any;
  let admin: any;
  let moderator: any;
  let alice: any;
  let bob: any;

  let group: any;
  let testGroupId: bigint;

  beforeEach(async () => {
    const conn = await hre.network.getOrCreate();
    viem = conn.viem;
    const clients = await viem.getWalletClients();
    deployer = clients[0];
    owner = clients[1];
    admin = clients[2];
    moderator = clients[3];
    alice = clients[4];
    bob = clients[5];

    userImpl = await viem.deployContract("UserImplementation");
    groupImpl = await viem.deployContract("GroupImplementation");
    factory = await viem.deployContract("ChatStorageFactory", [
      userImpl.address,
      groupImpl.address,
    ]);
    relMgr = await viem.deployContract("RelationshipManager", [factory.address]);
    await factory.write.setRelationshipManager([relMgr.address]);

    // Create Group via Factory
    const initialMeta = stringToHex(
      JSON.stringify({ title: "Web3 BUIDLers", desc: "Decentralized chat" })
    );
    await factory.write.createGroup([initialMeta, [], 0, 100], {
      account: owner.account,
    });

    testGroupId = 1n;
    const groupAddr = await factory.read.getGroup([testGroupId]);
    group = await viem.getContractAt("GroupImplementation", groupAddr);
  });

  it("checks initial state and prevents re-initialization", async () => {
    assert.strictEqual(await group.read.groupId(), testGroupId);
    assert.strictEqual(
      (await group.read.owner()).toLowerCase(),
      owner.account.address.toLowerCase()
    );
    assert.strictEqual(await group.read.status(), 0); // ACTIVE
    assert.strictEqual(await group.read.joinMode(), 0); // PUBLIC
    assert.strictEqual(await group.read.maxMembers(), 100n);
    assert.strictEqual(await group.read.memberCount(), 1n); // Owner is member
    assert.strictEqual(await group.read.isMember([owner.account.address]), true);
    assert.strictEqual(await group.read.getMemberRole([owner.account.address]), 3); // OWNER

    // Reinitialization fails
    await assert.rejects(async () => {
      await group.write.initialize(
        [testGroupId, owner.account.address, "0x", [], 0, 100, factory.address],
        { account: owner.account }
      );
    });
  });

  it("updates group metadata with size limits and permission control", async () => {
    const newMeta = JSON.stringify({ title: "Alpha Club", desc: "Updated" });
    await group.write.setMetadata([stringToHex(newMeta)], {
      account: owner.account,
    });

    const stored = await group.read.getMetadata();
    assert.strictEqual(stored, stringToHex(newMeta));
    assert.strictEqual(await group.read.metadataVersion(), 2);

    // Non-admin fails
    await assert.rejects(async () => {
      await group.write.setMetadata([stringToHex("hacked")], {
        account: alice.account,
      });
    });

    // Exceed max size (8192 bytes)
    const tooLarge = "y".repeat(8193);
    await assert.rejects(async () => {
      await group.write.setMetadata([stringToHex(tooLarge)], {
        account: owner.account,
      });
    });
  });

  it("allows joining a public group and leaving", async () => {
    await group.write.join({ account: alice.account });

    assert.strictEqual(await group.read.isMember([alice.account.address]), true);
    assert.strictEqual(await group.read.memberCount(), 2n);
    assert.strictEqual(await group.read.getMemberRole([alice.account.address]), 0); // MEMBER

    // Alice leaves group
    await group.write.leave({ account: alice.account });
    assert.strictEqual(await group.read.isMember([alice.account.address]), false);
    assert.strictEqual(await group.read.memberCount(), 1n);
  });

  it("manages role hierarchy and promotions", async () => {
    await group.write.join({ account: admin.account });
    await group.write.join({ account: moderator.account });

    // Owner promotes admin to ADMIN (role 2)
    await group.write.grantRole([admin.account.address, 2], {
      account: owner.account,
    });
    assert.strictEqual(await group.read.getMemberRole([admin.account.address]), 2);

    // Non-owner cannot grant role
    await assert.rejects(async () => {
      await group.write.grantRole([moderator.account.address, 1], {
        account: admin.account,
      });
    });

    // Owner revokes role
    await group.write.revokeRole([admin.account.address], {
      account: owner.account,
    });
    assert.strictEqual(await group.read.getMemberRole([admin.account.address]), 0);
  });

  it("handles two-step ownership transfer", async () => {
    await group.write.join({ account: admin.account });

    // Step 1: Owner initiates transfer
    await group.write.transferOwnership([admin.account.address], {
      account: owner.account,
    });
    assert.strictEqual(
      (await group.read.pendingOwner()).toLowerCase(),
      admin.account.address.toLowerCase()
    );

    // Non-pending owner cannot accept
    await assert.rejects(async () => {
      await group.write.acceptOwnership({ account: alice.account });
    });

    // Step 2: Pending owner accepts
    await group.write.acceptOwnership({ account: admin.account });
    assert.strictEqual(
      (await group.read.owner()).toLowerCase(),
      admin.account.address.toLowerCase()
    );
    assert.strictEqual(await group.read.getMemberRole([admin.account.address]), 3); // OWNER
    assert.strictEqual(await group.read.getMemberRole([owner.account.address]), 2); // Demoted to ADMIN
  });

  it("handles member kick, mute, and ban", async () => {
    await group.write.join({ account: alice.account });

    // Mute Alice for 3600s
    await group.write.mute([alice.account.address, 3600n], {
      account: owner.account,
    });
    let memberRecord = await group.read.getMember([alice.account.address]);
    assert.ok(memberRecord.muteUntil > 0n);

    // Unmute
    await group.write.unmute([alice.account.address], {
      account: owner.account,
    });
    memberRecord = await group.read.getMember([alice.account.address]);
    assert.strictEqual(memberRecord.muteUntil, 0n);

    // Ban Alice
    await group.write.ban([alice.account.address, 7200n], {
      account: owner.account,
    });
    assert.strictEqual(await group.read.isMember([alice.account.address]), false);
    assert.strictEqual(
      (await group.read.getMember([alice.account.address])).status,
      2 // BANNED
    );

    // Banned member cannot rejoin
    await assert.rejects(async () => {
      await group.write.join({ account: alice.account });
    });

    // Unban
    await group.write.unban([alice.account.address], {
      account: owner.account,
    });
    assert.strictEqual(
      (await group.read.getMember([alice.account.address])).status,
      0 // NONE
    );
  });

  it("creates and redeems invite codes for invite-only group", async () => {
    // Change join mode to INVITE_ONLY (1)
    await group.write.setJoinMode([1], { account: owner.account });

    // Alice cannot join directly
    await assert.rejects(async () => {
      await group.write.join({ account: alice.account });
    });

    // Owner creates invite code (codeHash, expiresAt, maxUses)
    const inviteCode = "0x1234567890123456789012345678901234567890123456789012345678901234";
    await group.write.createInvite([inviteCode, 0n, 5], {
      account: owner.account,
    });

    // Alice joins with invite code
    await group.write.useInvite([inviteCode], { account: alice.account });
    assert.strictEqual(await group.read.isMember([alice.account.address]), true);

    const invite = await group.read.getInvite([inviteCode]);
    assert.strictEqual(invite.usedCount, 1);
  });

  it("paginates members and member views", async () => {
    await group.write.join({ account: alice.account });
    await group.write.join({ account: bob.account });

    const members = await group.read.getMembers([0n, 10n]);
    assert.strictEqual(members.length, 3); // Owner, Alice, Bob

    const views = await group.read.getMemberViews([0n, 2n]);
    assert.strictEqual(views.length, 2);
    assert.strictEqual(views[0].memberAddress.toLowerCase(), owner.account.address.toLowerCase());
    assert.strictEqual(views[0].role, 3); // OWNER
  });

  it("safely paginates members with large limit without arithmetic overflow", async () => {
    await group.write.join({ account: alice.account });

    const maxUint256 = (1n << 256n) - 1n;
    const members = await group.read.getMembers([0n, maxUint256]);
    assert.strictEqual(members.length, 2);

    const views = await group.read.getMemberViews([0n, maxUint256]);
    assert.strictEqual(views.length, 2);
  });

  it("rejects muting a non-member with MemberNotFound", async () => {
    await assert.rejects(async () => {
      await group.write.mute([alice.account.address, 3600n], {
        account: owner.account,
      });
    });

    await assert.rejects(async () => {
      await group.write.unmute([alice.account.address], {
        account: owner.account,
      });
    });
  });

  it("prevents muted members from updating profile metadata", async () => {
    await group.write.join({ account: alice.account });

    // Mute Alice for 3600 seconds
    await group.write.mute([alice.account.address, 3600n], {
      account: owner.account,
    });

    // Alice cannot update her profile in group while muted
    await assert.rejects(async () => {
      await group.write.setMyMetadata([stringToHex(JSON.stringify({ nickname: "Spammer" }))], {
        account: alice.account,
      });
    });

    // Unmute Alice
    await group.write.unmute([alice.account.address], {
      account: owner.account,
    });

    // Now Alice can update profile
    await group.write.setMyMetadata([stringToHex(JSON.stringify({ nickname: "Alice" }))], {
      account: alice.account,
    });
    const [meta] = await group.read.getMemberMetadata([alice.account.address]);
    assert.strictEqual(meta, stringToHex(JSON.stringify({ nickname: "Alice" })));
  });

  it("retains ADMIN role when former member-turned-owner transfers ownership", async () => {
    // Alice joins as regular member
    await group.write.join({ account: alice.account });
    assert.strictEqual(await group.read.getMemberRole([alice.account.address]), 0); // MEMBER

    // Owner transfers ownership to Alice
    await group.write.transferOwnership([alice.account.address], {
      account: owner.account,
    });
    await group.write.acceptOwnership({ account: alice.account });
    assert.strictEqual(
      (await group.read.owner()).toLowerCase(),
      alice.account.address.toLowerCase()
    );

    // Alice transfers ownership to Bob
    await group.write.join({ account: bob.account });
    await group.write.transferOwnership([bob.account.address], {
      account: alice.account,
    });
    await group.write.acceptOwnership({ account: bob.account });

    // Alice must be retained as ADMIN (role 2), not revert to MEMBER
    assert.strictEqual(await group.read.getMemberRole([alice.account.address]), 2); // ADMIN
  });
});

