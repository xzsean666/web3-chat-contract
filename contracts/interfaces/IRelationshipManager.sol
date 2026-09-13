// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRelationshipManager {
    // --- Configuration ---
    function factory() external view returns (address);

    // --- Bidirectional Friend Handshake Flows ---
    function sendFriendRequest(address target) external;
    function sendFriendRequestWithExpiry(address target, uint64 expiresAt) external;
    function acceptFriendRequest(address requester) external;
    function rejectFriendRequest(address requester) external;
    function cancelFriendRequest(address target) external;
    function removeFriend(address friend) external;
}
