// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { UserStatus, GroupStatus, JoinMode, Role } from "./ChatDataTypes.sol";

/// @notice Factory Events
event UserCreated(address indexed user, address indexed cloneAddress);
event GroupCreated(uint256 indexed groupId, address indexed groupAddress, address indexed owner);
event UserJoinedGroupIndexed(address indexed user, uint256 indexed groupId, address indexed groupAddress);
event UserLeftGroupIndexed(address indexed user, uint256 indexed groupId, address indexed groupAddress);
event RelationshipManagerUpdated(address indexed oldManager, address indexed newManager);
event FactoryOwnershipTransferred(address indexed previousOwner, address indexed newOwner);

/// @notice User Lifecycle & State Events
event UserInitialized(address indexed account);
event UserMetadataUpdated(address indexed account, uint32 version, bytes metadata);
event UserStateUpdated(address indexed account, uint32 version, bytes state);
event UserStatusUpdated(address indexed account, UserStatus status);
event FriendMetadataUpdated(address indexed account, address indexed friend, uint32 version, bytes metadata);
event FriendMuted(address indexed account, address indexed friend, uint64 mutedUntil);
event FriendUnmuted(address indexed account, address indexed friend);
event UserBlockedEvent(address indexed account, address indexed target);
event UserUnblockedEvent(address indexed account, address indexed target);

/// @notice Relationship Coordination Events
event FriendRequestSent(address indexed requester, address indexed recipient);
event FriendRequestAccepted(address indexed requester, address indexed recipient);
event FriendRequestRejected(address indexed recipient, address indexed requester);
event FriendRequestCancelled(address indexed requester, address indexed recipient);
event FriendRemoved(address indexed remover, address indexed formerFriend);

/// @notice Group Lifecycle & Membership Events
event GroupInitialized(uint256 indexed groupId, address indexed owner, JoinMode joinMode, uint256 maxMembers);
event GroupMetadataUpdated(uint256 indexed groupId, uint32 version, bytes metadata);
event GroupStatusUpdated(uint256 indexed groupId, GroupStatus status);
event GroupJoinModeUpdated(uint256 indexed groupId, JoinMode joinMode);
event GroupMaxMembersUpdated(uint256 indexed groupId, uint256 maxMembers);
event OwnershipTransferStarted(uint256 indexed groupId, address indexed previousOwner, address indexed newOwner);
event OwnershipTransferred(uint256 indexed groupId, address indexed previousOwner, address indexed newOwner);

event MemberJoined(uint256 indexed groupId, address indexed member);
event MemberLeft(uint256 indexed groupId, address indexed member);
event MemberRemoved(uint256 indexed groupId, address indexed member, address indexed operator);
event RoleGranted(uint256 indexed groupId, address indexed member, Role role, address indexed operator);
event RoleRevoked(uint256 indexed groupId, address indexed member, address indexed operator);
event MemberMutedEvent(uint256 indexed groupId, address indexed member, uint64 muteUntil, address indexed operator);
event MemberUnmutedEvent(uint256 indexed groupId, address indexed member, address indexed operator);
event MemberBannedEvent(uint256 indexed groupId, address indexed member, uint64 banUntil, address indexed operator);
event MemberUnbannedEvent(uint256 indexed groupId, address indexed member, address indexed operator);
event MemberMetadataUpdated(uint256 indexed groupId, address indexed member, uint32 version, bytes metadata);

event InviteCreated(
    uint256 indexed groupId, bytes32 indexed codeHash, address indexed inviter, uint32 maxUses, uint64 expiresAt
);
event InviteUsed(uint256 indexed groupId, bytes32 indexed codeHash, address indexed user);
event InviteRevoked(uint256 indexed groupId, bytes32 indexed codeHash, address indexed operator);
