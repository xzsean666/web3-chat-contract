// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { UserImplementation } from "src/UserImplementation.sol";
import { GroupImplementation } from "src/GroupImplementation.sol";
import { RelationshipManager } from "src/RelationshipManager.sol";
import { ChatStorageFactory } from "src/ChatStorageFactory.sol";
import {
    UserStatus,
    FriendStatus,
    GroupStatus,
    JoinMode,
    MemberStatus,
    Role,
    UserOverview,
    GroupOverview
} from "src/interfaces/ChatDataTypes.sol";
import {
    ZeroAddress,
    Unauthorized,
    UnauthorizedClone,
    CannotOperateSelf,
    UserAlreadyRegistered,
    GroupNotFound,
    AlreadyFriends,
    NotFriends
} from "src/interfaces/ChatErrors.sol";

contract EndToEndChatFlowTest is Test {
    UserImplementation internal userImpl;
    GroupImplementation internal groupImpl;
    ChatStorageFactory internal factory;
    RelationshipManager internal relMgr;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal charlie = address(0xCAFE);
    address internal david = address(0xDA71D);
    address internal attacker = address(0xBAD);

    UserImplementation internal aliceUser;
    UserImplementation internal bobUser;
    UserImplementation internal charlieUser;

    function setUp() public {
        userImpl = new UserImplementation();
        groupImpl = new GroupImplementation();
        factory = new ChatStorageFactory(address(userImpl), address(groupImpl));
        relMgr = new RelationshipManager(address(factory));
        factory.setRelationshipManager(address(relMgr));

        // Register Users
        vm.prank(alice);
        aliceUser = UserImplementation(factory.createUser());

        vm.prank(bob);
        bobUser = UserImplementation(factory.createUser());

        vm.prank(charlie);
        charlieUser = UserImplementation(factory.createUser());
    }

    function testCompleteChatFlowAndIndexSync() public {
        // --- 1. User Profiles and States ---
        vm.prank(alice);
        aliceUser.setMetadata(bytes('{"name":"Alice","bio":"Web3 Enthusiast"}'));

        vm.prank(bob);
        bobUser.setMetadata(bytes('{"name":"Bob","bio":"Solidity Dev"}'));

        // --- 2. Friend Handshake Flow ---
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);

        vm.prank(bob);
        relMgr.acceptFriendRequest(alice);

        assertTrue(aliceUser.isFriend(bob));
        assertTrue(bobUser.isFriend(alice));
        assertEq(aliceUser.friendCount(), 1);
        assertEq(bobUser.friendCount(), 1);

        // --- 3. Alice Creates Group with Bob as Initial Member ---
        address[] memory initialMembers = new address[](1);
        initialMembers[0] = bob;

        bytes memory groupMeta = bytes('{"name":"Web3 Chat Core","desc":"Official builders chat"}');

        vm.prank(alice);
        (uint256 groupId, address groupAddr) = factory.createGroup(groupMeta, initialMembers, JoinMode.PUBLIC, 50);

        GroupImplementation group = GroupImplementation(groupAddr);

        assertEq(groupId, 1);
        assertEq(group.owner(), alice);
        assertEq(group.memberCount(), 2); // Alice (owner) + Bob
        assertTrue(group.isMember(alice));
        assertTrue(group.isMember(bob));

        // Verify Factory Indexing for Alice and Bob
        assertEq(factory.userGroupCount(alice), 1);
        assertEq(factory.userGroupCount(bob), 1);
        assertEq(factory.userGroupCount(charlie), 0);

        uint256[] memory aliceGroups = factory.getUserGroups(alice, 0, 10);
        assertEq(aliceGroups.length, 1);
        assertEq(aliceGroups[0], 1);

        uint256[] memory bobGroups = factory.getUserGroups(bob, 0, 10);
        assertEq(bobGroups.length, 1);
        assertEq(bobGroups[0], 1);

        // --- 4. Charlie Joins Group 1 ---
        vm.prank(charlie);
        group.join();

        assertEq(group.memberCount(), 3);
        assertTrue(group.isMember(charlie));
        assertEq(factory.userGroupCount(charlie), 1);

        uint256[] memory charlieGroups = factory.getUserGroups(charlie, 0, 10);
        assertEq(charlieGroups.length, 1);
        assertEq(charlieGroups[0], 1);

        // --- 5. Bob Leaves Group 1 ---
        vm.prank(bob);
        group.leave();

        assertEq(group.memberCount(), 2);
        assertFalse(group.isMember(bob));
        assertEq(factory.userGroupCount(bob), 0);

        bobGroups = factory.getUserGroups(bob, 0, 10);
        assertEq(bobGroups.length, 0);

        // --- 6. Alice Bans Charlie from Group 1 ---
        vm.prank(alice);
        group.ban(charlie, 86_400);

        assertEq(group.memberCount(), 1);
        assertFalse(group.isMember(charlie));
        assertEq(factory.userGroupCount(charlie), 0);

        charlieGroups = factory.getUserGroups(charlie, 0, 10);
        assertEq(charlieGroups.length, 0);

        // --- 7. Aggregation Overviews ---
        UserOverview memory aliceOverview = factory.getUserOverview(alice);
        assertEq(aliceOverview.userAddress, alice);
        assertEq(aliceOverview.friendCount, 1);
        assertEq(aliceOverview.groupCount, 1);
        assertEq(aliceOverview.metadataVersion, 1);

        GroupOverview memory gOverview = factory.getGroupOverview(1);
        assertEq(gOverview.groupId, 1);
        assertEq(gOverview.owner, alice);
        assertEq(gOverview.memberCount, 1);
        assertEq(uint8(gOverview.status), uint8(GroupStatus.ACTIVE));

        // --- 8. Invariants Assertion ---
        _assertInvariants(group, aliceUser, bobUser);
    }

    function testMaliciousImpersonationReverts() public {
        vm.prank(attacker);
        vm.expectRevert(UnauthorizedClone.selector);
        factory.onUserJoinedGroup(attacker, 1);

        vm.prank(attacker);
        vm.expectRevert(UnauthorizedClone.selector);
        factory.onUserLeftGroup(attacker, 1);
    }

    function testMultiGroupIndexingAndSwapAndPop() public {
        // Alice creates 3 groups
        address[] memory none = new address[](0);

        vm.startPrank(alice);
        (uint256 g1,) = factory.createGroup(bytes('{"g":1}'), none, JoinMode.PUBLIC, 10);
        (uint256 g2,) = factory.createGroup(bytes('{"g":2}'), none, JoinMode.PUBLIC, 10);
        (uint256 g3,) = factory.createGroup(bytes('{"g":3}'), none, JoinMode.PUBLIC, 10);
        vm.stopPrank();

        assertEq(factory.userGroupCount(alice), 3);
        uint256[] memory groups = factory.getUserGroups(alice, 0, 10);
        assertEq(groups.length, 3);
        assertEq(groups[0], g1);
        assertEq(groups[1], g2);
        assertEq(groups[2], g3);

        address g1Addr = factory.getGroup(g1);
        address g2Addr = factory.getGroup(g2);
        address g3Addr = factory.getGroup(g3);

        // Bob joins g1, g2, g3
        vm.startPrank(bob);
        GroupImplementation(g1Addr).join();
        GroupImplementation(g2Addr).join();
        GroupImplementation(g3Addr).join();
        vm.stopPrank();

        assertEq(factory.userGroupCount(bob), 3);

        // Bob leaves g2 (middle element - triggers swap-and-pop)
        vm.prank(bob);
        GroupImplementation(g2Addr).leave();

        assertEq(factory.userGroupCount(bob), 2);
        uint256[] memory bobGroups = factory.getUserGroups(bob, 0, 10);
        assertEq(bobGroups.length, 2);
        // g3 was swapped into index 1
        assertEq(bobGroups[0], g1);
        assertEq(bobGroups[1], g3);

        // Bob leaves g1 (first element)
        vm.prank(bob);
        GroupImplementation(g1Addr).leave();

        assertEq(factory.userGroupCount(bob), 1);
        bobGroups = factory.getUserGroups(bob, 0, 10);
        assertEq(bobGroups.length, 1);
        assertEq(bobGroups[0], g3);

        // Bob leaves g3 (last element)
        vm.prank(bob);
        GroupImplementation(g3Addr).leave();

        assertEq(factory.userGroupCount(bob), 0);
    }

    function _assertInvariants(GroupImplementation grp, UserImplementation u1, UserImplementation u2) internal view {
        // Group member invariant: memberCount == _memberList.length
        address[] memory members = grp.getMembers(0, 100);
        assertEq(grp.memberCount(), members.length);

        // User friend invariant: friendCount == _friendList.length
        address[] memory u1Friends = u1.getFriends(0, 100);
        assertEq(u1.friendCount(), u1Friends.length);

        address[] memory u2Friends = u2.getFriends(0, 100);
        assertEq(u2.friendCount(), u2Friends.length);

        // Factory group count invariant
        address[] memory allGroups = factory.getGroups(0, 100);
        assertEq(factory.groupCount(), allGroups.length);
    }
}
