// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { UserImplementation } from "src/UserImplementation.sol";
import { GroupImplementation } from "src/GroupImplementation.sol";
import { RelationshipManager } from "src/RelationshipManager.sol";
import { ChatStorageFactory } from "src/ChatStorageFactory.sol";
import {
    GroupStatus,
    JoinMode,
    MemberStatus,
    Role,
    MemberRecord,
    MemberView,
    InviteRecord,
    MAX_GROUP_METADATA_SIZE,
    MAX_MEMBER_METADATA_SIZE
} from "src/interfaces/ChatDataTypes.sol";
import {
    ZeroAddress,
    Unauthorized,
    CannotOperateSelf,
    MetadataSizeExceeded,
    GroupClosed,
    GroupPaused,
    GroupFull,
    InvalidJoinMode,
    MemberAlreadyExists,
    MemberNotFound,
    MemberBanned,
    InvalidRoleHierarchy,
    CannotRevokeOrDemoteOwner,
    NotPendingOwner,
    InviteInvalidOrExpired,
    InviteMaxUsesReached,
    InviteAlreadyExists,
    InviteInactive
} from "src/interfaces/ChatErrors.sol";

contract GroupTest is Test {
    UserImplementation internal userImpl;
    GroupImplementation internal groupImpl;
    ChatStorageFactory internal factory;
    RelationshipManager internal relMgr;

    address internal owner = address(0x0404);
    address internal admin = address(0xAD314);
    address internal moderator = address(0x30DE);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal charlie = address(0xCAFE);

    GroupImplementation internal group;
    uint256 internal testGroupId;

    function setUp() public {
        userImpl = new UserImplementation();
        groupImpl = new GroupImplementation();
        factory = new ChatStorageFactory(address(userImpl), address(groupImpl));
        relMgr = new RelationshipManager(address(factory));
        factory.setRelationshipManager(address(relMgr));

        address[] memory initialMembers = new address[](0);
        bytes memory meta = bytes('{"title":"Web3 BUIDLers","desc":"Decentralized state storage"}');

        vm.prank(owner);
        (testGroupId,) = factory.createGroup(meta, initialMembers, JoinMode.PUBLIC, 100);
        address groupAddr = factory.getGroup(testGroupId);
        group = GroupImplementation(groupAddr);
    }

    // --- Initialization & Security ---

    function testImplementationCannotBeInitialized() public {
        vm.expectRevert();
        groupImpl.initialize(999, owner, "", new address[](0), JoinMode.PUBLIC, 10, address(factory));
    }

    function testGroupCannotBeReinitialized() public {
        vm.expectRevert();
        group.initialize(testGroupId, owner, "", new address[](0), JoinMode.PUBLIC, 10, address(factory));
    }

    function testInitialGroupState() public view {
        assertEq(group.groupId(), testGroupId);
        assertEq(group.owner(), owner);
        assertEq(uint8(group.status()), uint8(GroupStatus.ACTIVE));
        assertEq(uint8(group.joinMode()), uint8(JoinMode.PUBLIC));
        assertEq(group.maxMembers(), 100);
        assertEq(group.memberCount(), 1); // Owner is initial member
        assertTrue(group.isMember(owner));
        assertEq(uint8(group.getMemberRole(owner)), uint8(Role.OWNER));
    }

    // --- Metadata & Limits ---

    function testUpdateGroupMetadata() public {
        bytes memory newMeta = bytes('{"title":"New Title"}');
        vm.prank(owner);
        group.setMetadata(newMeta);

        assertEq(group.getMetadata(), newMeta);
        assertEq(group.metadataVersion(), 2);
    }

    function testNonOwnerCannotUpdateMetadata() public {
        vm.prank(alice);
        vm.expectRevert(Unauthorized.selector);
        group.setMetadata(bytes('{"title":"Hacked"}'));
    }

    function testOversizedMetadataReverts() public {
        bytes memory oversized = new bytes(MAX_GROUP_METADATA_SIZE + 1);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(MetadataSizeExceeded.selector, MAX_GROUP_METADATA_SIZE + 1, MAX_GROUP_METADATA_SIZE)
        );
        group.setMetadata(oversized);
    }

    // --- Two-Step Ownership Transfer ---

    function testTwoStepOwnershipTransfer() public {
        vm.prank(owner);
        group.transferOwnership(admin);
        assertEq(group.pendingOwner(), admin);
        assertEq(group.owner(), owner);

        // Non-pending owner cannot accept
        vm.prank(alice);
        vm.expectRevert(NotPendingOwner.selector);
        group.acceptOwnership();

        // Admin accepts
        vm.prank(admin);
        group.acceptOwnership();
        assertEq(group.owner(), admin);
        assertEq(group.pendingOwner(), address(0));
        assertTrue(group.isMember(admin));
        assertEq(uint8(group.getMemberRole(admin)), uint8(Role.OWNER));
    }

    // --- Lifecycle Management ---

    function testPauseResumeAndClose() public {
        vm.prank(owner);
        group.pause();
        assertEq(uint8(group.status()), uint8(GroupStatus.PAUSED));

        // When paused, joining reverts
        vm.prank(alice);
        vm.expectRevert(GroupPaused.selector);
        group.join();

        vm.prank(owner);
        group.resume();
        assertEq(uint8(group.status()), uint8(GroupStatus.ACTIVE));

        // Close group
        vm.prank(owner);
        group.close();
        assertEq(uint8(group.status()), uint8(GroupStatus.CLOSED));

        // When closed, operations revert
        vm.prank(alice);
        vm.expectRevert(GroupClosed.selector);
        group.join();

        vm.prank(owner);
        vm.expectRevert(GroupClosed.selector);
        group.setMetadata(bytes("{}"));
    }

    // --- JoinModes & Capacity Limits ---

    function testPublicJoinAndLeave() public {
        vm.prank(alice);
        group.join();

        assertTrue(group.isMember(alice));
        assertEq(group.memberCount(), 2);
        assertEq(uint8(group.getMemberRole(alice)), uint8(Role.MEMBER));

        // Cannot join twice
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MemberAlreadyExists.selector, alice));
        group.join();

        // Alice leaves
        vm.prank(alice);
        group.leave();

        assertFalse(group.isMember(alice));
        assertEq(group.memberCount(), 1);
    }

    function testOwnerCannotLeaveWithoutTransfer() public {
        vm.prank(owner);
        vm.expectRevert(CannotOperateSelf.selector);
        group.leave();
    }

    function testMaxMembersCapacity() public {
        vm.prank(owner);
        group.setMaxMembers(2); // Owner + 1 member

        vm.prank(alice);
        group.join();
        assertEq(group.memberCount(), 2);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(GroupFull.selector, 2, 2));
        group.join();
    }

    function testJoinModes() public {
        // Invite only
        vm.prank(owner);
        group.setJoinMode(JoinMode.INVITE_ONLY);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidJoinMode.selector, JoinMode.INVITE_ONLY));
        group.join();

        // Admin only
        vm.prank(owner);
        group.setJoinMode(JoinMode.ADMIN_ONLY);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidJoinMode.selector, JoinMode.ADMIN_ONLY));
        group.join();

        // Admin adds Alice
        vm.prank(owner);
        group.addMember(alice);
        assertTrue(group.isMember(alice));
    }

    // --- Batch Operations ---

    function testBatchAddAndRemoveMembers() public {
        address[] memory users = new address[](3);
        users[0] = alice;
        users[1] = bob;
        users[2] = charlie;

        vm.prank(owner);
        group.batchAddMembers(users);

        assertEq(group.memberCount(), 4);
        assertTrue(group.isMember(alice));
        assertTrue(group.isMember(bob));
        assertTrue(group.isMember(charlie));

        // Batch remove 2 members
        address[] memory toRemove = new address[](2);
        toRemove[0] = alice;
        toRemove[1] = bob;

        vm.prank(owner);
        group.batchRemoveMembers(toRemove);

        assertEq(group.memberCount(), 2);
        assertFalse(group.isMember(alice));
        assertFalse(group.isMember(bob));
        assertTrue(group.isMember(charlie));
    }

    // --- Role Hierarchy & Anti-Escalation ---

    function testRoleHierarchyAndModeration() public {
        // Add admin, moderator, and alice
        vm.prank(owner);
        group.addMember(admin);
        vm.prank(owner);
        group.grantRole(admin, Role.ADMIN);

        vm.prank(owner);
        group.addMember(moderator);
        vm.prank(owner);
        group.grantRole(moderator, Role.MODERATOR);

        vm.prank(owner);
        group.addMember(alice);

        assertEq(uint8(group.getMemberRole(admin)), uint8(Role.ADMIN));
        assertEq(uint8(group.getMemberRole(moderator)), uint8(Role.MODERATOR));
        assertEq(uint8(group.getMemberRole(alice)), uint8(Role.MEMBER));

        // Moderator can mute Member
        vm.prank(moderator);
        group.mute(alice, 3600);
        assertGt(group.getMember(alice).muteUntil, block.timestamp);

        // Moderator cannot mute Admin or Owner
        vm.prank(moderator);
        vm.expectRevert(abi.encodeWithSelector(InvalidRoleHierarchy.selector, Role.MODERATOR, Role.ADMIN));
        group.mute(admin, 3600);

        vm.prank(moderator);
        vm.expectRevert(CannotRevokeOrDemoteOwner.selector);
        group.mute(owner, 3600);

        // Moderator cannot ban Admin
        vm.prank(moderator);
        vm.expectRevert(abi.encodeWithSelector(InvalidRoleHierarchy.selector, Role.MODERATOR, Role.ADMIN));
        group.ban(admin, 3600);

        // Admin can mute and kick Moderator
        vm.prank(admin);
        group.mute(moderator, 1800);
        assertGt(group.getMember(moderator).muteUntil, block.timestamp);

        vm.prank(admin);
        group.removeMember(moderator);
        assertFalse(group.isMember(moderator));

        // Admin cannot kick or demote Owner
        vm.prank(admin);
        vm.expectRevert(CannotRevokeOrDemoteOwner.selector);
        group.removeMember(owner);
    }

    // --- Banning & Unbanning ---

    function testBanAndUnban() public {
        vm.prank(alice);
        group.join();

        // Owner bans Alice for 1 hour
        vm.warp(1_700_000_000);
        vm.prank(owner);
        group.ban(alice, 3600);

        assertFalse(group.isMember(alice));
        MemberRecord memory rec = group.getMember(alice);
        assertEq(uint8(rec.status), uint8(MemberStatus.BANNED));
        assertEq(rec.banUntil, 1_700_003_600);

        // Alice cannot join while banned
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MemberBanned.selector, alice, 1_700_003_600));
        group.join();

        // Owner unbans Alice
        vm.prank(owner);
        group.unban(alice);

        // Now Alice can join
        vm.prank(alice);
        group.join();
        assertTrue(group.isMember(alice));
    }

    // --- Member In-Group Metadata ---

    function testMemberMetadata() public {
        vm.prank(alice);
        group.join();

        bytes memory card = bytes('{"groupNick":"Alice in Wonderland","title":"Core Contributor"}');
        vm.prank(alice);
        group.setMyMetadata(card);

        (bytes memory storedCard, uint32 ver) = group.getMemberMetadata(alice);
        assertEq(storedCard, card);
        assertEq(ver, 1);

        // Non-member cannot set metadata
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MemberNotFound.selector, bob));
        group.setMyMetadata(card);

        // Oversized card reverts
        bytes memory oversized = new bytes(MAX_MEMBER_METADATA_SIZE + 1);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MetadataSizeExceeded.selector, MAX_MEMBER_METADATA_SIZE + 1, MAX_MEMBER_METADATA_SIZE
            )
        );
        group.setMyMetadata(oversized);
    }

    // --- Invites ---

    function testInviteLifecycle() public {
        vm.prank(owner);
        group.setJoinMode(JoinMode.INVITE_ONLY);

        bytes32 codeHash = keccak256(abi.encodePacked("SECRET_INVITE_2026"));
        uint64 expiresAt = uint64(block.timestamp + 86_400);

        // Create invite
        vm.prank(owner);
        group.createInvite(codeHash, expiresAt, 2);

        InviteRecord memory inv = group.getInvite(codeHash);
        assertTrue(inv.active);
        assertEq(inv.maxUses, 2);
        assertEq(inv.usedCount, 0);

        // Alice uses invite
        vm.prank(alice);
        group.useInvite(codeHash);
        assertTrue(group.isMember(alice));

        // Bob uses invite
        vm.prank(bob);
        group.useInvite(codeHash);
        assertTrue(group.isMember(bob));

        // Charlie tries to use invite, max uses reached
        vm.prank(charlie);
        vm.expectRevert(InviteMaxUsesReached.selector);
        group.useInvite(codeHash);

        // Create and revoke another invite
        bytes32 codeHash2 = keccak256(abi.encodePacked("REVOKE_ME"));
        vm.prank(owner);
        group.createInvite(codeHash2, expiresAt, 10);

        vm.prank(owner);
        group.revokeInvite(codeHash2);

        vm.prank(charlie);
        vm.expectRevert(InviteInvalidOrExpired.selector);
        group.useInvite(codeHash2);
    }

    function testZeroInviteCodeHashReverts() public {
        vm.prank(owner);
        vm.expectRevert(InviteInvalidOrExpired.selector);
        group.createInvite(bytes32(0), uint64(block.timestamp + 1000), 1);
    }
}
