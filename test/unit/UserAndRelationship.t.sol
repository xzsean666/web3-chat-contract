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
    FriendRecord,
    FriendView,
    MAX_USER_METADATA_SIZE,
    MAX_USER_STATE_SIZE,
    MAX_FRIEND_METADATA_SIZE
} from "src/interfaces/ChatDataTypes.sol";
import {
    ZeroAddress,
    Unauthorized,
    CannotOperateSelf,
    UserBlocked,
    AlreadyFriends,
    NotFriends,
    RequestPending,
    NoRequestPending,
    MetadataSizeExceeded,
    RequestExpired
} from "src/interfaces/ChatErrors.sol";

contract UserAndRelationshipTest is Test {
    UserImplementation internal userImpl;
    GroupImplementation internal groupImpl;
    ChatStorageFactory internal factory;
    RelationshipManager internal relMgr;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal charlie = address(0xCAFE);
    address internal david = address(0xDA71D);

    UserImplementation internal aliceUser;
    UserImplementation internal bobUser;
    UserImplementation internal charlieUser;
    UserImplementation internal davidUser;

    function setUp() public {
        userImpl = new UserImplementation();
        groupImpl = new GroupImplementation();
        factory = new ChatStorageFactory(address(userImpl), address(groupImpl));
        relMgr = new RelationshipManager(address(factory));
        factory.setRelationshipManager(address(relMgr));

        vm.prank(alice);
        address aliceClone = factory.createUser();
        aliceUser = UserImplementation(aliceClone);

        vm.prank(bob);
        address bobClone = factory.createUser();
        bobUser = UserImplementation(bobClone);

        vm.prank(charlie);
        address charlieClone = factory.createUser();
        charlieUser = UserImplementation(charlieClone);

        vm.prank(david);
        address davidClone = factory.createUser();
        davidUser = UserImplementation(davidClone);
    }

    // --- Implementation Security & Initialization Tests ---

    function testImplementationCannotBeInitializedDirectly() public {
        vm.expectRevert();
        userImpl.initialize(alice, address(relMgr), address(factory));
    }

    function testCloneCannotBeInitializedTwice() public {
        vm.expectRevert();
        aliceUser.initialize(alice, address(relMgr), address(factory));
    }

    function testInitialState() public view {
        assertEq(aliceUser.account(), alice);
        assertEq(uint8(aliceUser.status()), uint8(UserStatus.ACTIVE));
        assertEq(aliceUser.metadataVersion(), 0);
        assertEq(aliceUser.stateVersion(), 0);
        assertEq(aliceUser.friendCount(), 0);
        assertEq(aliceUser.factory(), address(factory));
        assertEq(aliceUser.relationshipManager(), address(relMgr));
    }

    // --- User Profile & State Tests ---

    function testUpdateMetadataAndState() public {
        bytes memory meta = bytes('{"name":"Alice","avatar":"ipfs://Qm..."}');
        bytes memory state = bytes('{"theme":"dark","notifications":true}');

        vm.startPrank(alice);
        aliceUser.setMetadata(meta);
        assertEq(aliceUser.metadataVersion(), 1);
        assertEq(aliceUser.getMetadata(), meta);

        aliceUser.setState(state);
        assertEq(aliceUser.stateVersion(), 1);
        assertEq(aliceUser.getState(), state);

        aliceUser.setStatus(UserStatus.DISABLED);
        assertEq(uint8(aliceUser.status()), uint8(UserStatus.DISABLED));
        vm.stopPrank();
    }

    function testUnauthorizedProfileUpdateReverts() public {
        bytes memory meta = bytes('{"name":"Hacker"}');
        vm.prank(bob);
        vm.expectRevert(Unauthorized.selector);
        aliceUser.setMetadata(meta);
    }

    function testMetadataSizeExceededReverts() public {
        bytes memory oversized = new bytes(MAX_USER_METADATA_SIZE + 1);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MetadataSizeExceeded.selector, MAX_USER_METADATA_SIZE + 1, MAX_USER_METADATA_SIZE)
        );
        aliceUser.setMetadata(oversized);

        bytes memory oversizedState = new bytes(MAX_USER_STATE_SIZE + 1);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MetadataSizeExceeded.selector, MAX_USER_STATE_SIZE + 1, MAX_USER_STATE_SIZE)
        );
        aliceUser.setState(oversizedState);
    }

    // --- Friend Request & Acceptance Lifecycle ---

    function testFriendRequestAndAccept() public {
        // Alice sends friend request to Bob
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);

        FriendRecord memory aliceToBob = aliceUser.getFriend(bob);
        FriendRecord memory bobToAlice = bobUser.getFriend(alice);

        assertEq(uint8(aliceToBob.status), uint8(FriendStatus.PENDING_OUT));
        assertEq(uint8(bobToAlice.status), uint8(FriendStatus.PENDING_IN));
        assertFalse(aliceUser.isFriend(bob));
        assertFalse(bobUser.isFriend(alice));

        // Bob accepts friend request
        vm.warp(1_700_000_000);
        vm.prank(bob);
        relMgr.acceptFriendRequest(alice);

        aliceToBob = aliceUser.getFriend(bob);
        bobToAlice = bobUser.getFriend(alice);

        assertEq(uint8(aliceToBob.status), uint8(FriendStatus.FRIEND));
        assertEq(uint8(bobToAlice.status), uint8(FriendStatus.FRIEND));
        assertEq(aliceToBob.since, 1_700_000_000);
        assertEq(bobToAlice.since, 1_700_000_000);

        assertTrue(aliceUser.isFriend(bob));
        assertTrue(bobUser.isFriend(alice));
        assertEq(aliceUser.friendCount(), 1);
        assertEq(bobUser.friendCount(), 1);

        address[] memory aliceFriends = aliceUser.getFriends(0, 10);
        assertEq(aliceFriends.length, 1);
        assertEq(aliceFriends[0], bob);
    }

    function testCannotSendDuplicateFriendRequest() public {
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(RequestPending.selector, bob));
        relMgr.sendFriendRequest(bob);
    }

    function testCannotSendFriendRequestToSelf() public {
        vm.prank(alice);
        vm.expectRevert(CannotOperateSelf.selector);
        relMgr.sendFriendRequest(alice);
    }

    function testCannotSendFriendRequestIfAlreadyFriends() public {
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);
        vm.prank(bob);
        relMgr.acceptFriendRequest(alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AlreadyFriends.selector, bob));
        relMgr.sendFriendRequest(bob);
    }

    function testRejectFriendRequest() public {
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);

        vm.prank(bob);
        relMgr.rejectFriendRequest(alice);

        assertEq(uint8(aliceUser.getFriend(bob).status), uint8(FriendStatus.NONE));
        assertEq(uint8(bobUser.getFriend(alice).status), uint8(FriendStatus.NONE));
        assertEq(aliceUser.friendCount(), 0);
        assertEq(bobUser.friendCount(), 0);
    }

    function testCancelFriendRequest() public {
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);

        vm.prank(alice);
        relMgr.cancelFriendRequest(bob);

        assertEq(uint8(aliceUser.getFriend(bob).status), uint8(FriendStatus.NONE));
        assertEq(uint8(bobUser.getFriend(alice).status), uint8(FriendStatus.NONE));
    }

    function testRemoveFriend() public {
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);
        vm.prank(bob);
        relMgr.acceptFriendRequest(alice);

        assertTrue(aliceUser.isFriend(bob));
        assertTrue(bobUser.isFriend(alice));

        // Alice dissolves friendship
        vm.prank(alice);
        relMgr.removeFriend(bob);

        assertFalse(aliceUser.isFriend(bob));
        assertFalse(bobUser.isFriend(alice));
        assertEq(aliceUser.friendCount(), 0);
        assertEq(bobUser.friendCount(), 0);
    }

    function testRemoveNonFriendReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NotFriends.selector, bob));
        relMgr.removeFriend(bob);
    }

    // --- Friend Metadata & Muting ---

    function testFriendMetadataIndependence() public {
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);
        vm.prank(bob);
        relMgr.acceptFriendRequest(alice);

        bytes memory note = bytes('{"nickname":"Bestie Bob","tag":"VIP"}');
        vm.prank(alice);
        aliceUser.setFriendMetadata(bob, note);

        (bytes memory storedNote, uint32 ver) = aliceUser.getFriendMetadata(bob);
        assertEq(storedNote, note);
        assertEq(ver, 1);

        // Bob's side is unchanged and Bob has no note on Alice
        (bytes memory bobNote, uint32 bobVer) = bobUser.getFriendMetadata(alice);
        assertEq(bobNote.length, 0);
        assertEq(bobVer, 0);

        // Bob cannot alter Alice's note on him
        vm.prank(bob);
        vm.expectRevert(Unauthorized.selector);
        aliceUser.setFriendMetadata(bob, bytes('{"nickname":"Hacked"}'));
    }

    function testFriendMetadataSizeExceededReverts() public {
        bytes memory oversized = new bytes(MAX_FRIEND_METADATA_SIZE + 1);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MetadataSizeExceeded.selector, MAX_FRIEND_METADATA_SIZE + 1, MAX_FRIEND_METADATA_SIZE
            )
        );
        aliceUser.setFriendMetadata(bob, oversized);
    }

    function testMuteAndUnmuteFriend() public {
        vm.warp(1_700_000_000);
        vm.prank(alice);
        aliceUser.muteFriend(bob, 3600);

        FriendRecord memory rec = aliceUser.getFriend(bob);
        assertEq(rec.mutedUntil, 1_700_003_600);

        vm.prank(alice);
        aliceUser.unmuteFriend(bob);

        rec = aliceUser.getFriend(bob);
        assertEq(rec.mutedUntil, 0);
    }

    // --- Block & Unblock Management ---

    function testBlockRemovesFriendAndBlocks() public {
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);
        vm.prank(bob);
        relMgr.acceptFriendRequest(alice);

        assertEq(aliceUser.friendCount(), 1);

        // Alice blocks Bob
        vm.prank(alice);
        aliceUser.blockUser(bob);

        assertTrue(aliceUser.isBlocked(bob));
        assertFalse(aliceUser.isFriend(bob));
        assertEq(aliceUser.friendCount(), 0);

        // Bob tries to send request to Alice, should revert UserBlocked
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(UserBlocked.selector, alice));
        relMgr.sendFriendRequest(alice);

        // Alice tries to send request to Bob, should revert UserBlocked
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(UserBlocked.selector, bob));
        relMgr.sendFriendRequest(bob);

        // Alice unblocks Bob
        vm.prank(alice);
        aliceUser.unblockUser(bob);

        assertFalse(aliceUser.isBlocked(bob));
        assertFalse(aliceUser.isFriend(bob));

        // Now request can be sent again
        vm.prank(bob);
        relMgr.sendFriendRequest(alice);
        assertEq(uint8(bobUser.getFriend(alice).status), uint8(FriendStatus.PENDING_OUT));
    }

    function testCannotBlockSelf() public {
        vm.prank(alice);
        vm.expectRevert(CannotOperateSelf.selector);
        aliceUser.blockUser(alice);
    }

    // --- Pagination Tests ---

    function testPagination() public {
        // Alice friends with Bob, Charlie, David
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);
        vm.prank(bob);
        relMgr.acceptFriendRequest(alice);

        vm.prank(alice);
        relMgr.sendFriendRequest(charlie);
        vm.prank(charlie);
        relMgr.acceptFriendRequest(alice);

        vm.prank(alice);
        relMgr.sendFriendRequest(david);
        vm.prank(david);
        relMgr.acceptFriendRequest(alice);

        assertEq(aliceUser.friendCount(), 3);

        // Page 1: limit 2
        address[] memory page1 = aliceUser.getFriends(0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0], bob);
        assertEq(page1[1], charlie);

        // Page 2: offset 2, limit 2
        address[] memory page2 = aliceUser.getFriends(2, 2);
        assertEq(page2.length, 1);
        assertEq(page2[0], david);

        // Out of bounds
        address[] memory oob = aliceUser.getFriends(3, 2);
        assertEq(oob.length, 0);

        // FriendViews pagination
        FriendView[] memory views = aliceUser.getFriendViews(0, 2);
        assertEq(views.length, 2);
        assertEq(views[0].friendAddress, bob);
        assertEq(uint8(views[0].status), uint8(FriendStatus.FRIEND));
        assertEq(views[1].friendAddress, charlie);
    }

    // --- Security Audit Tests ---

    function testAliceCannotBypassBobBlockByRemovingFriend() public {
        // 1. Alice and Bob become mutual friends
        vm.prank(alice);
        relMgr.sendFriendRequest(bob);
        vm.prank(bob);
        relMgr.acceptFriendRequest(alice);

        assertTrue(aliceUser.isFriend(bob));
        assertTrue(bobUser.isFriend(alice));

        // 2. Bob blocks Alice
        vm.prank(bob);
        bobUser.blockUser(alice);

        assertTrue(bobUser.isBlocked(alice));
        assertFalse(bobUser.isFriend(alice));

        // 3. Alice attempts to remove friendship with Bob to wipe Bob's block record
        vm.prank(alice);
        relMgr.removeFriend(bob);

        // Verify: Alice no longer has Bob as friend
        assertFalse(aliceUser.isFriend(bob));

        // Verify: Bob's block on Alice remains completely intact!
        assertTrue(bobUser.isBlocked(alice));

        // 4. Alice attempts to send a friend request to Bob again, must be blocked
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(UserBlocked.selector, bob));
        relMgr.sendFriendRequest(bob);
    }

    function testRelationshipManagerUpgradeSync() public {
        // Deploy a new RelationshipManager
        RelationshipManager newRelMgr = new RelationshipManager(address(factory));

        // Factory owner updates relationshipManager
        factory.setRelationshipManager(address(newRelMgr));
        assertEq(factory.relationshipManager(), address(newRelMgr));

        // Existing User clones (alice and charlie) should seamlessly coordinate with new manager
        vm.prank(alice);
        newRelMgr.sendFriendRequest(charlie);

        FriendRecord memory rec = charlieUser.getFriend(alice);
        assertEq(uint8(rec.status), uint8(FriendStatus.PENDING_IN));

        vm.prank(charlie);
        newRelMgr.acceptFriendRequest(alice);

        assertTrue(aliceUser.isFriend(charlie));
        assertTrue(charlieUser.isFriend(alice));
    }

    function testFriendRequestWithExpiry() public {
        uint64 expiry = uint64(block.timestamp + 100);

        // Alice sends request with expiry
        vm.prank(alice);
        relMgr.sendFriendRequestWithExpiry(bob, expiry);

        // Warp past expiry
        vm.warp(block.timestamp + 101);

        // Bob tries to accept after expiry, reverts RequestExpired
        vm.prank(bob);
        vm.expectRevert(RequestExpired.selector);
        relMgr.acceptFriendRequest(alice);

        // Alice can resend a fresh request because the old one expired
        uint64 newExpiry = uint64(block.timestamp + 500);
        vm.prank(alice);
        relMgr.sendFriendRequestWithExpiry(bob, newExpiry);

        // Bob accepts within new expiry
        vm.prank(bob);
        relMgr.acceptFriendRequest(alice);
        assertTrue(aliceUser.isFriend(bob));
    }

    function testFactoryOwnershipTransfer() public {
        address newOwner = address(0x9999);
        factory.transferOwnership(newOwner);
        assertEq(factory.owner(), newOwner);

        // Old owner cannot set relationship manager
        vm.expectRevert(Unauthorized.selector);
        factory.setRelationshipManager(address(0x123));

        // New owner can set relationship manager
        vm.prank(newOwner);
        factory.setRelationshipManager(address(0x123));
        assertEq(factory.relationshipManager(), address(0x123));
    }
}
