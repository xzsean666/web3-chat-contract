// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {
    UserStatus,
    FriendStatus,
    FriendRecord,
    FriendView,
    MAX_USER_METADATA_SIZE,
    MAX_USER_STATE_SIZE,
    MAX_FRIEND_METADATA_SIZE
} from "./interfaces/ChatDataTypes.sol";
import { ZeroAddress, Unauthorized, CannotOperateSelf, MetadataSizeExceeded } from "./interfaces/ChatErrors.sol";
import {
    UserInitialized,
    UserMetadataUpdated,
    UserStateUpdated,
    UserStatusUpdated,
    FriendMetadataUpdated,
    FriendMuted,
    FriendUnmuted,
    UserBlockedEvent,
    UserUnblockedEvent,
    FriendRemoved
} from "./interfaces/ChatEvents.sol";
import { IUserImplementation } from "./interfaces/IUserImplementation.sol";
import { IChatStorageFactory } from "./interfaces/IChatStorageFactory.sol";

/// @title UserImplementation
/// @notice Logic contract for User Clones in EVM Chat State Storage Protocol
contract UserImplementation is Initializable, IUserImplementation {
    // --- Storage Slots (Strictly Packed According to ARCHITECTURE.md) ---
    // Slot 0: [address account (20B)] [uint8 status (1B)] [uint32 metadataVersion (4B)] [uint32 stateVersion (4B)]
    address public account;
    UserStatus public status;
    uint32 public metadataVersion;
    uint32 public stateVersion;

    // Slot 1: bytes internal _metadata (UTF-8 JSON, <= 4KB)
    bytes internal _metadata;

    // Slot 2: bytes internal _state (UTF-8 JSON, <= 4KB)
    bytes internal _state;

    // Slot 3: mapping(address => FriendRecord) internal _friends (Compact 1 Slot struct)
    mapping(address => FriendRecord) internal _friends;

    // Slot 4: address[] internal _friendList (Only active FRIEND addresses)
    address[] internal _friendList;

    // Slot 5: mapping(address => uint256) internal _friendIndex (1-based index for O(1) swap-and-pop)
    mapping(address => uint256) internal _friendIndex;

    // Slot 6: mapping(address => bytes) internal _friendMetadata (Local friend notes, <= 2KB)
    mapping(address => bytes) internal _friendMetadata;

    // Slot 7: mapping(address => uint32) internal _friendMetadataVersion
    mapping(address => uint32) internal _friendMetadataVersion;

    // Slot 8: Factory and RelationshipManager addresses
    address public factory;
    address public relationshipManager;

    // --- Modifiers ---
    modifier onlyAccount() {
        if (msg.sender != account) revert Unauthorized();
        _;
    }

    modifier onlyRelationshipManager() {
        if (msg.sender != relationshipManager) {
            if (factory != address(0) && msg.sender == IChatStorageFactory(factory).relationshipManager()) {
                relationshipManager = msg.sender;
            } else {
                revert Unauthorized();
            }
        }
        _;
    }

    /// @notice Lock implementation contract from being initialized directly
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize clone instance
    /// @param _account The user owner address
    /// @param _relationshipManager The protocol relationship manager
    /// @param _factory The factory deploying this clone
    function initialize(address _account, address _relationshipManager, address _factory) external initializer {
        if (_account == address(0) || _factory == address(0)) revert ZeroAddress();
        account = _account;
        relationshipManager = _relationshipManager;
        factory = _factory;
        status = UserStatus.ACTIVE;

        emit UserInitialized(_account);
    }

    // --- Core Account Views ---

    function getMetadata() external view returns (bytes memory) {
        return _metadata;
    }

    function getState() external view returns (bytes memory) {
        return _state;
    }

    // --- Profile & State Mutators ---

    function setMetadata(bytes calldata metadata) external onlyAccount {
        if (metadata.length > MAX_USER_METADATA_SIZE) {
            revert MetadataSizeExceeded(metadata.length, MAX_USER_METADATA_SIZE);
        }
        _metadata = metadata;
        unchecked {
            metadataVersion++;
        }
        emit UserMetadataUpdated(account, metadataVersion, metadata);
    }

    function setState(bytes calldata state) external onlyAccount {
        if (state.length > MAX_USER_STATE_SIZE) {
            revert MetadataSizeExceeded(state.length, MAX_USER_STATE_SIZE);
        }
        _state = state;
        unchecked {
            stateVersion++;
        }
        emit UserStateUpdated(account, stateVersion, state);
    }

    function setStatus(UserStatus newStatus) external onlyAccount {
        status = newStatus;
        emit UserStatusUpdated(account, newStatus);
    }

    // --- Friend & Block Queries ---

    function isFriend(address target) external view returns (bool) {
        return _friends[target].status == FriendStatus.FRIEND;
    }

    function isBlocked(address target) external view returns (bool) {
        return _friends[target].status == FriendStatus.BLOCKED;
    }

    function getFriend(address target) external view returns (FriendRecord memory) {
        return _friends[target];
    }

    function friendCount() external view returns (uint256) {
        return _friendList.length;
    }

    function getFriends(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 total = _friendList.length;
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
            result[i] = _friendList[offset + i];
            unchecked {
                ++i;
            }
        }
        return result;
    }

    function getFriendViews(uint256 offset, uint256 limit) external view returns (FriendView[] memory) {
        uint256 total = _friendList.length;
        if (offset >= total || limit == 0) {
            return new FriendView[](0);
        }
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 count = end - offset;
        FriendView[] memory views = new FriendView[](count);
        for (uint256 i = 0; i < count;) {
            address friendAddr = _friendList[offset + i];
            FriendRecord memory rec = _friends[friendAddr];
            views[i] = FriendView({
                friendAddress: friendAddr,
                status: rec.status,
                since: rec.since,
                mutedUntil: rec.mutedUntil,
                expiresAt: rec.expiresAt,
                metadata: _friendMetadata[friendAddr],
                metadataVersion: _friendMetadataVersion[friendAddr]
            });
            unchecked {
                ++i;
            }
        }
        return views;
    }

    function getFriendMetadata(address target) external view returns (bytes memory metadata, uint32 version) {
        return (_friendMetadata[target], _friendMetadataVersion[target]);
    }

    // --- Friend & Block Mutators ---

    function setFriendMetadata(address target, bytes calldata metadata) external onlyAccount {
        if (target == address(0)) revert ZeroAddress();
        if (metadata.length > MAX_FRIEND_METADATA_SIZE) {
            revert MetadataSizeExceeded(metadata.length, MAX_FRIEND_METADATA_SIZE);
        }
        _friendMetadata[target] = metadata;
        uint32 newVersion;
        unchecked {
            newVersion = ++_friendMetadataVersion[target];
        }
        emit FriendMetadataUpdated(account, target, newVersion, metadata);
    }

    function muteFriend(address target, uint64 duration) external onlyAccount {
        if (target == address(0)) revert ZeroAddress();
        uint64 until = uint64(block.timestamp) + duration;
        _friends[target].mutedUntil = until;
        emit FriendMuted(account, target, until);
    }

    function unmuteFriend(address target) external onlyAccount {
        if (target == address(0)) revert ZeroAddress();
        _friends[target].mutedUntil = 0;
        emit FriendUnmuted(account, target);
    }

    function blockUser(address target) external onlyAccount {
        if (target == address(0)) revert ZeroAddress();
        if (target == account) revert CannotOperateSelf();

        _removeFromFriendList(target);
        _friends[target] = FriendRecord({ status: FriendStatus.BLOCKED, since: 0, mutedUntil: 0, expiresAt: 0 });

        emit UserBlockedEvent(account, target);
    }

    function unblockUser(address target) external onlyAccount {
        if (target == address(0)) revert ZeroAddress();
        if (_friends[target].status != FriendStatus.BLOCKED) {
            return;
        }
        delete _friends[target];
        emit UserUnblockedEvent(account, target);
    }

    // --- Inter-Contract Coordination ---

    function setRelationshipFromManager(address target, FriendStatus newStatus, uint64 since, uint64 expiresAt)
        external
        onlyRelationshipManager
    {
        if (target == address(0)) revert ZeroAddress();
        FriendStatus currentStatus = _friends[target].status;

        // Security: Never overwrite local BLOCKED state from RelationshipManager
        if (currentStatus == FriendStatus.BLOCKED) {
            return;
        }

        if (currentStatus == FriendStatus.FRIEND && newStatus != FriendStatus.FRIEND) {
            _removeFromFriendList(target);
        } else if (currentStatus != FriendStatus.FRIEND && newStatus == FriendStatus.FRIEND) {
            _addToFriendList(target);
        }

        if (newStatus == FriendStatus.NONE) {
            delete _friends[target];
        } else {
            _friends[target] = FriendRecord({
                status: newStatus, since: since, mutedUntil: _friends[target].mutedUntil, expiresAt: expiresAt
            });
        }
    }

    function removeFriendFromManager(address target) external onlyRelationshipManager {
        if (target == address(0)) revert ZeroAddress();
        _removeFromFriendList(target);
        // Security: If user has blocked target, preserve BLOCKED status! Never delete blacklist!
        if (_friends[target].status != FriendStatus.BLOCKED) {
            delete _friends[target];
            emit FriendRemoved(account, target);
        }
    }

    // --- Internal Helpers ---

    function _addToFriendList(address target) internal {
        if (_friendIndex[target] == 0) {
            _friendList.push(target);
            _friendIndex[target] = _friendList.length;
        }
    }

    function _removeFromFriendList(address target) internal {
        uint256 indexPlusOne = _friendIndex[target];
        if (indexPlusOne != 0) {
            uint256 idx = indexPlusOne - 1;
            uint256 lastIdx = _friendList.length - 1;
            if (idx != lastIdx) {
                address lastItem = _friendList[lastIdx];
                _friendList[idx] = lastItem;
                _friendIndex[lastItem] = indexPlusOne;
            }
            _friendList.pop();
            delete _friendIndex[target];
        }
    }
}
