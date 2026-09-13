// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import {
    UserStatus,
    FriendStatus,
    GroupStatus,
    JoinMode,
    MemberStatus,
    Role,
    FriendRecord,
    MemberRecord,
    InviteRecord,
    FriendView,
    MemberView,
    GroupOverview,
    UserOverview,
    MAX_USER_METADATA_SIZE,
    MAX_USER_STATE_SIZE,
    MAX_GROUP_METADATA_SIZE,
    MAX_MEMBER_METADATA_SIZE,
    MAX_FRIEND_METADATA_SIZE
} from "src/interfaces/ChatDataTypes.sol";
import "src/interfaces/ChatErrors.sol";
import "src/interfaces/ChatEvents.sol";
import { IUserImplementation } from "src/interfaces/IUserImplementation.sol";
import { IRelationshipManager } from "src/interfaces/IRelationshipManager.sol";
import { IGroupImplementation } from "src/interfaces/IGroupImplementation.sol";
import { IChatStorageFactory } from "src/interfaces/IChatStorageFactory.sol";

contract InterfacesCompileTest is Test {
    function testConstants() public pure {
        assertEq(MAX_USER_METADATA_SIZE, 4096);
        assertEq(MAX_USER_STATE_SIZE, 4096);
        assertEq(MAX_GROUP_METADATA_SIZE, 8192);
        assertEq(MAX_MEMBER_METADATA_SIZE, 2048);
        assertEq(MAX_FRIEND_METADATA_SIZE, 2048);
    }

    function testEnums() public pure {
        assertTrue(uint8(UserStatus.ACTIVE) == 0);
        assertTrue(uint8(UserStatus.DISABLED) == 1);

        assertTrue(uint8(FriendStatus.NONE) == 0);
        assertTrue(uint8(FriendStatus.PENDING_IN) == 1);
        assertTrue(uint8(FriendStatus.PENDING_OUT) == 2);
        assertTrue(uint8(FriendStatus.FRIEND) == 3);
        assertTrue(uint8(FriendStatus.BLOCKED) == 4);

        assertTrue(uint8(GroupStatus.ACTIVE) == 0);
        assertTrue(uint8(GroupStatus.PAUSED) == 1);
        assertTrue(uint8(GroupStatus.CLOSED) == 2);

        assertTrue(uint8(JoinMode.PUBLIC) == 0);
        assertTrue(uint8(JoinMode.INVITE_ONLY) == 1);
        assertTrue(uint8(JoinMode.ADMIN_ONLY) == 2);
        assertTrue(uint8(JoinMode.CLOSED) == 3);

        assertTrue(uint8(MemberStatus.NONE) == 0);
        assertTrue(uint8(MemberStatus.MEMBER) == 1);
        assertTrue(uint8(MemberStatus.BANNED) == 2);

        assertTrue(uint8(Role.MEMBER) == 0);
        assertTrue(uint8(Role.MODERATOR) == 1);
        assertTrue(uint8(Role.ADMIN) == 2);
        assertTrue(uint8(Role.OWNER) == 3);
    }

    function testStructCreation() public pure {
        FriendRecord memory f = FriendRecord({ status: FriendStatus.FRIEND, since: 1000, mutedUntil: 0, expiresAt: 0 });
        assertEq(uint8(f.status), uint8(FriendStatus.FRIEND));
        assertEq(f.since, 1000);

        MemberRecord memory m =
            MemberRecord({ status: MemberStatus.MEMBER, role: Role.ADMIN, joinedAt: 2000, muteUntil: 0, banUntil: 0 });
        assertEq(uint8(m.role), uint8(Role.ADMIN));
    }
}
