// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { JoinMode, Role } from "./ChatDataTypes.sol";

/// @notice Common Protocol Errors
error ZeroAddress();
error Unauthorized();
error UnauthorizedClone();
error AlreadyInitialized();
error ArrayLengthMismatch();
error InvalidPagination(uint256 offset, uint256 limit);
error MetadataSizeExceeded(uint256 size, uint256 limit);

/// @notice User & Relationship Errors
error UserAlreadyRegistered(address user);
error UserNotRegistered(address user);
error CannotOperateSelf();
error UserBlocked(address target);
error UserDisabled(address user);
error AlreadyFriends(address target);
error NotFriends(address target);
error RequestPending(address target);
error NoRequestPending(address target);
error RequestExpired();

/// @notice Group Lifecycle & Capacity Errors
error GroupNotFound(uint256 groupId);
error GroupClosed();
error GroupPaused();
error GroupFull(uint256 current, uint256 max);
error InvalidJoinMode(JoinMode joinMode);

/// @notice Group Membership & Role Errors
error MemberAlreadyExists(address user);
error MemberNotFound(address user);
error MemberBanned(address user, uint64 banUntil);
error MemberMuted(address user, uint64 muteUntil);
error InvalidRoleHierarchy(Role callerRole, Role targetRole);
error InvalidTargetRole(Role newRole);
error CannotRevokeOrDemoteOwner();

/// @notice Ownership Errors
error OwnershipTransferPending();
error NoPendingOwnershipTransfer();
error NotPendingOwner();

/// @notice Invite Errors
error InviteInvalidOrExpired();
error InviteMaxUsesReached();
error InviteAlreadyExists();
error InviteInactive();
