// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { JoinMode, UserOverview, GroupOverview, UserStatus, GroupStatus } from "./interfaces/ChatDataTypes.sol";
import {
    ZeroAddress,
    Unauthorized,
    UnauthorizedClone,
    UserAlreadyRegistered,
    GroupNotFound
} from "./interfaces/ChatErrors.sol";
import {
    UserCreated,
    GroupCreated,
    UserJoinedGroupIndexed,
    UserLeftGroupIndexed,
    RelationshipManagerUpdated,
    FactoryOwnershipTransferred
} from "./interfaces/ChatEvents.sol";
import { IUserImplementation } from "./interfaces/IUserImplementation.sol";
import { IGroupImplementation } from "./interfaces/IGroupImplementation.sol";
import { IChatStorageFactory } from "./interfaces/IChatStorageFactory.sol";

/// @title ChatStorageFactory
/// @notice Central registry, clone factory, and user-group indexer for the EVM Chat State Storage Protocol
contract ChatStorageFactory is IChatStorageFactory {
    // --- Immutables & Owner ---
    address public immutable userImplementation;
    address public immutable groupImplementation;
    address public relationshipManager;
    address public owner;

    // --- Clone Registry Mappings ---
    mapping(address => address) internal _userClones;
    mapping(address => bool) internal _isUserClone;
    mapping(uint256 => address) internal _groupClones;
    mapping(address => uint256) internal _groupCloneToId;
    mapping(address => bool) internal _isGroupClone;

    // --- Global Group Discovery ---
    address[] internal _allGroups;

    // --- User to Groups Indexes ---
    mapping(address => uint256[]) internal _userGroups;
    mapping(address => mapping(uint256 => uint256)) internal _userGroupIndex; // 1-based index for O(1) swap-and-pop

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _userImplementation, address _groupImplementation) {
        if (_userImplementation == address(0) || _groupImplementation == address(0)) {
            revert ZeroAddress();
        }
        userImplementation = _userImplementation;
        groupImplementation = _groupImplementation;
        owner = msg.sender;
    }

    // --- Configuration ---

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit FactoryOwnershipTransferred(oldOwner, newOwner);
    }

    function setRelationshipManager(address newManager) external onlyOwner {
        if (newManager == address(0)) revert ZeroAddress();
        address oldManager = relationshipManager;
        relationshipManager = newManager;
        emit RelationshipManagerUpdated(oldManager, newManager);
    }

    // --- Clone Deployments ---

    /// @notice Deploy a dedicated UserClone for the msg.sender
    function createUser() external returns (address cloneAddress) {
        if (_userClones[msg.sender] != address(0)) {
            revert UserAlreadyRegistered(msg.sender);
        }

        cloneAddress = Clones.clone(userImplementation);

        _userClones[msg.sender] = cloneAddress;
        _isUserClone[cloneAddress] = true;

        IUserImplementation(cloneAddress).initialize(msg.sender, relationshipManager, address(this));

        emit UserCreated(msg.sender, cloneAddress);
    }

    /// @notice Deploy a dedicated GroupClone with metadata and initial members
    function createGroup(
        bytes calldata metadata,
        address[] calldata initialMembers,
        JoinMode joinMode,
        uint256 maxMembers
    ) external returns (uint256 groupId, address groupAddress) {
        groupId = _allGroups.length + 1;
        groupAddress = Clones.clone(groupImplementation);

        // Register group clone before initialize so internal join callbacks pass authorization check
        _groupClones[groupId] = groupAddress;
        _groupCloneToId[groupAddress] = groupId;
        _isGroupClone[groupAddress] = true;
        _allGroups.push(groupAddress);

        IGroupImplementation(groupAddress)
            .initialize(groupId, msg.sender, metadata, initialMembers, joinMode, maxMembers, address(this));

        emit GroupCreated(groupId, groupAddress, msg.sender);
    }

    // --- Registry & Verification Queries ---

    function getUserContract(address user) external view returns (address) {
        return _userClones[user];
    }

    function isUserClone(address queryAddress) external view returns (bool) {
        return _isUserClone[queryAddress];
    }

    function getGroup(uint256 groupId) external view returns (address) {
        return _groupClones[groupId];
    }

    function getGroupId(address groupAddress) external view returns (uint256) {
        return _groupCloneToId[groupAddress];
    }

    function isGroupClone(address queryAddress) external view returns (bool) {
        return _isGroupClone[queryAddress];
    }

    // --- Discovery & Index Queries ---

    function groupCount() external view returns (uint256) {
        return _allGroups.length;
    }

    function getGroups(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 total = _allGroups.length;
        if (offset >= total || limit == 0) {
            return new address[](0);
        }
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 count = end - offset;
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count;) {
            result[i] = _allGroups[offset + i];
            unchecked {
                ++i;
            }
        }
        return result;
    }

    function userGroupCount(address user) external view returns (uint256) {
        return _userGroups[user].length;
    }

    function getUserGroups(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256 total = _userGroups[user].length;
        if (offset >= total || limit == 0) {
            return new uint256[](0);
        }
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 count = end - offset;
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count;) {
            result[i] = _userGroups[user][offset + i];
            unchecked {
                ++i;
            }
        }
        return result;
    }

    // --- Inter-Contract Hooks ---

    /// @notice Callback invoked by GroupClone when a member joins
    function onUserJoinedGroup(address user, uint256 groupId) external {
        if (msg.sender != _groupClones[groupId]) {
            revert UnauthorizedClone();
        }

        if (_userGroupIndex[user][groupId] == 0) {
            _userGroups[user].push(groupId);
            _userGroupIndex[user][groupId] = _userGroups[user].length;
            emit UserJoinedGroupIndexed(user, groupId, msg.sender);
        }
    }

    /// @notice Callback invoked by GroupClone when a member leaves or is removed
    function onUserLeftGroup(address user, uint256 groupId) external {
        if (msg.sender != _groupClones[groupId]) {
            revert UnauthorizedClone();
        }

        uint256 indexPlusOne = _userGroupIndex[user][groupId];
        if (indexPlusOne != 0) {
            uint256 idx = indexPlusOne - 1;
            uint256 lastIdx = _userGroups[user].length - 1;
            if (idx != lastIdx) {
                uint256 lastGroupId = _userGroups[user][lastIdx];
                _userGroups[user][idx] = lastGroupId;
                _userGroupIndex[user][lastGroupId] = indexPlusOne;
            }
            _userGroups[user].pop();
            delete _userGroupIndex[user][groupId];

            emit UserLeftGroupIndexed(user, groupId, msg.sender);
        }
    }

    // --- Aggregation Views ---

    /// @notice Retrieve comprehensive overview of a user in a single read call
    function getUserOverview(address user) external view returns (UserOverview memory) {
        address clone = _userClones[user];
        if (clone == address(0)) {
            return UserOverview({
                userAddress: user,
                cloneAddress: address(0),
                status: UserStatus.ACTIVE,
                metadataVersion: 0,
                metadata: "",
                stateVersion: 0,
                state: "",
                friendCount: 0,
                groupCount: _userGroups[user].length
            });
        }

        IUserImplementation u = IUserImplementation(clone);
        return UserOverview({
            userAddress: user,
            cloneAddress: clone,
            status: u.status(),
            metadataVersion: u.metadataVersion(),
            metadata: u.getMetadata(),
            stateVersion: u.stateVersion(),
            state: u.getState(),
            friendCount: u.friendCount(),
            groupCount: _userGroups[user].length
        });
    }

    /// @notice Retrieve comprehensive overview of a group in a single read call
    function getGroupOverview(uint256 groupId) external view returns (GroupOverview memory) {
        address clone = _groupClones[groupId];
        if (clone == address(0)) {
            revert GroupNotFound(groupId);
        }

        IGroupImplementation g = IGroupImplementation(clone);
        return GroupOverview({
            groupId: groupId,
            groupAddress: clone,
            owner: g.owner(),
            pendingOwner: g.pendingOwner(),
            status: g.status(),
            joinMode: g.joinMode(),
            maxMembers: g.maxMembers(),
            memberCount: g.memberCount(),
            metadataVersion: g.metadataVersion(),
            metadata: g.getMetadata()
        });
    }
}
