// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FriendStatus, FriendRecord, UserStatus } from "./interfaces/ChatDataTypes.sol";
import {
    ZeroAddress,
    CannotOperateSelf,
    UserNotRegistered,
    UserBlocked,
    UserDisabled,
    AlreadyFriends,
    NotFriends,
    RequestPending,
    NoRequestPending,
    RequestExpired
} from "./interfaces/ChatErrors.sol";
import {
    FriendRequestSent,
    FriendRequestAccepted,
    FriendRequestRejected,
    FriendRequestCancelled,
    FriendRemoved
} from "./interfaces/ChatEvents.sol";
import { IUserImplementation } from "./interfaces/IUserImplementation.sol";
import { IChatStorageFactory } from "./interfaces/IChatStorageFactory.sol";
import { IRelationshipManager } from "./interfaces/IRelationshipManager.sol";

/// @title RelationshipManager
/// @notice Coordinates bidirectional friend handshake state machine across User clones
contract RelationshipManager is IRelationshipManager {
    address public immutable factory;

    constructor(address _factory) {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
    }

    /// @notice Send a friend request from msg.sender to target without expiration
    /// @param target The address of the recipient
    function sendFriendRequest(address target) external {
        sendFriendRequestWithExpiry(target, 0);
    }

    /// @notice Send a friend request with an explicit expiration timestamp
    /// @param target The address of the recipient
    /// @param expiresAt The timestamp after which the request is no longer valid (0 for no expiry)
    function sendFriendRequestWithExpiry(address target, uint64 expiresAt) public {
        if (target == address(0)) revert ZeroAddress();
        if (target == msg.sender) revert CannotOperateSelf();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert RequestExpired();

        IUserImplementation senderClone = _getUserContract(msg.sender);
        IUserImplementation targetClone = _getUserContract(target);

        if (senderClone.status() == UserStatus.DISABLED) {
            revert UserDisabled(msg.sender);
        }
        if (targetClone.status() == UserStatus.DISABLED) {
            revert UserDisabled(target);
        }

        if (targetClone.isBlocked(msg.sender) || senderClone.isBlocked(target)) {
            revert UserBlocked(target);
        }

        if (senderClone.isFriend(target)) {
            if (targetClone.isFriend(msg.sender)) {
                revert AlreadyFriends(target);
            } else {
                senderClone.removeFriendFromManager(target);
            }
        }

        if (targetClone.isFriend(msg.sender)) {
            targetClone.removeFriendFromManager(msg.sender);
        }

        FriendRecord memory senderRec = senderClone.getFriend(target);
        if (senderRec.status == FriendStatus.PENDING_OUT || senderRec.status == FriendStatus.PENDING_IN) {
            if (senderRec.expiresAt == 0 || block.timestamp <= senderRec.expiresAt) {
                revert RequestPending(target);
            }
        }

        FriendRecord memory targetRec = targetClone.getFriend(msg.sender);
        if (targetRec.status == FriendStatus.PENDING_OUT || targetRec.status == FriendStatus.PENDING_IN) {
            if (targetRec.expiresAt == 0 || block.timestamp <= targetRec.expiresAt) {
                revert RequestPending(target);
            }
        }

        senderClone.setRelationshipFromManager(target, FriendStatus.PENDING_OUT, 0, expiresAt);
        targetClone.setRelationshipFromManager(msg.sender, FriendStatus.PENDING_IN, 0, expiresAt);

        emit FriendRequestSent(msg.sender, target);
    }

    /// @notice Accept an incoming friend request from requester
    /// @param requester The address who sent the request
    function acceptFriendRequest(address requester) external {
        if (requester == address(0)) revert ZeroAddress();
        if (requester == msg.sender) revert CannotOperateSelf();

        IUserImplementation recipientClone = _getUserContract(msg.sender);
        IUserImplementation requesterClone = _getUserContract(requester);

        if (recipientClone.status() == UserStatus.DISABLED) {
            revert UserDisabled(msg.sender);
        }
        if (requesterClone.status() == UserStatus.DISABLED) {
            revert UserDisabled(requester);
        }

        FriendRecord memory rec = recipientClone.getFriend(requester);
        if (rec.status != FriendStatus.PENDING_IN) {
            revert NoRequestPending(requester);
        }

        FriendRecord memory reqRec = requesterClone.getFriend(msg.sender);
        if (reqRec.status != FriendStatus.PENDING_OUT) {
            revert NoRequestPending(requester);
        }

        if (rec.expiresAt != 0 && block.timestamp > rec.expiresAt) {
            revert RequestExpired();
        }

        if (recipientClone.isBlocked(requester) || requesterClone.isBlocked(msg.sender)) {
            revert UserBlocked(requester);
        }

        uint64 nowTs = uint64(block.timestamp);
        recipientClone.setRelationshipFromManager(requester, FriendStatus.FRIEND, nowTs, 0);
        requesterClone.setRelationshipFromManager(msg.sender, FriendStatus.FRIEND, nowTs, 0);

        emit FriendRequestAccepted(requester, msg.sender);
    }

    /// @notice Reject an incoming friend request
    /// @param requester The address who sent the request
    function rejectFriendRequest(address requester) external {
        if (requester == address(0)) revert ZeroAddress();
        if (requester == msg.sender) revert CannotOperateSelf();

        IUserImplementation recipientClone = _getUserContract(msg.sender);
        IUserImplementation requesterClone = _getUserContract(requester);

        FriendRecord memory rec = recipientClone.getFriend(requester);
        if (rec.status != FriendStatus.PENDING_IN) {
            revert NoRequestPending(requester);
        }

        recipientClone.setRelationshipFromManager(requester, FriendStatus.NONE, 0, 0);
        requesterClone.setRelationshipFromManager(msg.sender, FriendStatus.NONE, 0, 0);

        emit FriendRequestRejected(msg.sender, requester);
    }

    /// @notice Cancel an outgoing friend request
    /// @param target The recipient of the previous request
    function cancelFriendRequest(address target) external {
        if (target == address(0)) revert ZeroAddress();
        if (target == msg.sender) revert CannotOperateSelf();

        IUserImplementation senderClone = _getUserContract(msg.sender);
        IUserImplementation targetClone = _getUserContract(target);

        FriendRecord memory rec = senderClone.getFriend(target);
        if (rec.status != FriendStatus.PENDING_OUT) {
            revert NoRequestPending(target);
        }

        senderClone.setRelationshipFromManager(target, FriendStatus.NONE, 0, 0);
        targetClone.setRelationshipFromManager(msg.sender, FriendStatus.NONE, 0, 0);

        emit FriendRequestCancelled(msg.sender, target);
    }

    /// @notice Dissolve an existing mutual friendship
    /// @param friend The friend to be removed
    function removeFriend(address friend) external {
        if (friend == address(0)) revert ZeroAddress();
        if (friend == msg.sender) revert CannotOperateSelf();

        IUserImplementation senderClone = _getUserContract(msg.sender);
        IUserImplementation friendClone = _getUserContract(friend);

        if (!senderClone.isFriend(friend)) {
            revert NotFriends(friend);
        }

        senderClone.removeFriendFromManager(friend);
        friendClone.removeFriendFromManager(msg.sender);

        emit FriendRemoved(msg.sender, friend);
    }

    // --- Internal Helpers ---

    function _getUserContract(address user) internal view returns (IUserImplementation) {
        address clone = IChatStorageFactory(factory).getUserContract(user);
        if (clone == address(0)) {
            revert UserNotRegistered(user);
        }
        return IUserImplementation(clone);
    }
}
