// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { GroupStatus, JoinMode, Role, MemberRecord, MemberView, InviteRecord } from "./ChatDataTypes.sol";

interface IGroupImplementation {
    // --- Lifecycle & Initialization ---
    function initialize(
        uint256 groupId,
        address owner,
        bytes calldata metadata,
        address[] calldata initialMembers,
        JoinMode joinMode,
        uint256 maxMembers,
        address factory
    ) external;

    // --- Core Views ---
    function groupId() external view returns (uint256);
    function factory() external view returns (address);
    function owner() external view returns (address);
    function pendingOwner() external view returns (address);
    function status() external view returns (GroupStatus);
    function joinMode() external view returns (JoinMode);
    function maxMembers() external view returns (uint256);
    function memberCount() external view returns (uint256);
    function metadataVersion() external view returns (uint32);
    function getMetadata() external view returns (bytes memory);

    // --- Group Settings & Lifecycle Mutators ---
    function setMetadata(bytes calldata metadata) external;
    function setJoinMode(JoinMode newMode) external;
    function setMaxMembers(uint256 newMaxMembers) external;
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
    function pause() external;
    function resume() external;
    function close() external;

    // --- Membership Mutators ---
    function join() external;
    function leave() external;
    function addMember(address user) external;
    function removeMember(address user) external;
    function batchAddMembers(address[] calldata users) external;
    function batchRemoveMembers(address[] calldata users) external;

    // --- Membership & Role Queries ---
    function isMember(address user) external view returns (bool);
    function getMember(address user) external view returns (MemberRecord memory);
    function getMemberRole(address user) external view returns (Role);
    function getMembers(uint256 offset, uint256 limit) external view returns (address[] memory);
    function getMemberViews(uint256 offset, uint256 limit) external view returns (MemberView[] memory);
    function getMemberMetadata(address user) external view returns (bytes memory metadata, uint32 version);

    // --- Role Management ---
    function grantRole(address user, Role role) external;
    function revokeRole(address user) external;

    // --- Moderation (Mute & Ban) ---
    function mute(address user, uint64 duration) external;
    function unmute(address user) external;
    function batchMuteMembers(address[] calldata users, uint64 duration) external;
    function ban(address user, uint64 duration) external;
    function unban(address user) external;
    function batchBanMembers(address[] calldata users, uint64 duration) external;
    function batchUnbanMembers(address[] calldata users) external;

    // --- Member Profile in Group ---
    function setMyMetadata(bytes calldata metadata) external;

    // --- Invites ---
    function createInvite(bytes32 codeHash, uint64 expiresAt, uint32 maxUses) external;
    function revokeInvite(bytes32 codeHash) external;
    function useInvite(bytes32 codeHash) external;
    function getInvite(bytes32 codeHash) external view returns (InviteRecord memory);
}
