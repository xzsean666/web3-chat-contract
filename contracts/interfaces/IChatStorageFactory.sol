// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { JoinMode, UserOverview, GroupOverview } from "./ChatDataTypes.sol";

interface IChatStorageFactory {
    // --- Configuration & Implementations ---
    function userImplementation() external view returns (address);
    function groupImplementation() external view returns (address);
    function relationshipManager() external view returns (address);
    function owner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function setRelationshipManager(address newManager) external;

    // --- Clone Deployments ---
    function createUser() external returns (address cloneAddress);
    function createGroup(
        bytes calldata metadata,
        address[] calldata initialMembers,
        JoinMode joinMode,
        uint256 maxMembers
    ) external returns (uint256 groupId, address groupAddress);

    // --- Registry & Verification Queries ---
    function getUserContract(address user) external view returns (address);
    function isUserClone(address queryAddress) external view returns (bool);
    function getGroup(uint256 groupId) external view returns (address);
    function getGroupId(address groupAddress) external view returns (uint256);
    function isGroupClone(address queryAddress) external view returns (bool);

    // --- Discovery & Index Queries ---
    function groupCount() external view returns (uint256);
    function getGroups(uint256 offset, uint256 limit) external view returns (address[] memory);
    function userGroupCount(address user) external view returns (uint256);
    function getUserGroups(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory);

    // --- Inter-Contract Hooks (Only authorized Group clones can call) ---
    function onUserJoinedGroup(address user, uint256 groupId) external;
    function onUserLeftGroup(address user, uint256 groupId) external;

    // --- Aggregation Views ---
    function getUserOverview(address user) external view returns (UserOverview memory);
    function getGroupOverview(uint256 groupId) external view returns (GroupOverview memory);
}
