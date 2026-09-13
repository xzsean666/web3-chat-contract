// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { UserStatus, FriendStatus, FriendRecord, FriendView } from "./ChatDataTypes.sol";

interface IUserImplementation {
    // --- Lifecycle & Initialization ---
    function initialize(address account, address relationshipManager, address factory) external;

    // --- Core Account Views ---
    function account() external view returns (address);
    function factory() external view returns (address);
    function relationshipManager() external view returns (address);
    function status() external view returns (UserStatus);
    function metadataVersion() external view returns (uint32);
    function stateVersion() external view returns (uint32);
    function getMetadata() external view returns (bytes memory);
    function getState() external view returns (bytes memory);

    // --- Profile & State Mutators ---
    function setMetadata(bytes calldata metadata) external;
    function setState(bytes calldata state) external;
    function setStatus(UserStatus newStatus) external;

    // --- Friend & Block Queries ---
    function isFriend(address target) external view returns (bool);
    function isBlocked(address target) external view returns (bool);
    function getFriend(address target) external view returns (FriendRecord memory);
    function friendCount() external view returns (uint256);
    function getFriends(uint256 offset, uint256 limit) external view returns (address[] memory);
    function getFriendViews(uint256 offset, uint256 limit) external view returns (FriendView[] memory);
    function getFriendMetadata(address target) external view returns (bytes memory metadata, uint32 version);

    // --- Friend & Block Mutators ---
    function setFriendMetadata(address target, bytes calldata metadata) external;
    function muteFriend(address target, uint64 duration) external;
    function unmuteFriend(address target) external;
    function blockUser(address target) external;
    function unblockUser(address target) external;

    // --- Inter-Contract Coordination (Called only by RelationshipManager) ---
    function setRelationshipFromManager(address target, FriendStatus newStatus, uint64 since, uint64 expiresAt) external;
    function removeFriendFromManager(address target) external;
}
