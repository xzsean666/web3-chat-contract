// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {
    GroupStatus,
    JoinMode,
    MemberStatus,
    Role,
    MemberRecord,
    MemberView,
    InviteRecord,
    MAX_GROUP_METADATA_SIZE,
    MAX_MEMBER_METADATA_SIZE
} from "./interfaces/ChatDataTypes.sol";
import {
    ZeroAddress,
    Unauthorized,
    CannotOperateSelf,
    MetadataSizeExceeded,
    GroupClosed,
    GroupPaused,
    GroupFull,
    InvalidJoinMode,
    MemberAlreadyExists,
    MemberNotFound,
    MemberBanned,
    InvalidRoleHierarchy,
    InvalidTargetRole,
    CannotRevokeOrDemoteOwner,
    OwnershipTransferPending,
    NoPendingOwnershipTransfer,
    NotPendingOwner,
    InviteInvalidOrExpired,
    InviteMaxUsesReached,
    InviteAlreadyExists,
    InviteInactive
} from "./interfaces/ChatErrors.sol";
import {
    GroupInitialized,
    GroupMetadataUpdated,
    GroupStatusUpdated,
    GroupJoinModeUpdated,
    GroupMaxMembersUpdated,
    OwnershipTransferStarted,
    OwnershipTransferred,
    MemberJoined,
    MemberLeft,
    MemberRemoved,
    RoleGranted,
    RoleRevoked,
    MemberMutedEvent,
    MemberUnmutedEvent,
    MemberBannedEvent,
    MemberUnbannedEvent,
    MemberMetadataUpdated,
    InviteCreated,
    InviteUsed,
    InviteRevoked
} from "./interfaces/ChatEvents.sol";
import { IGroupImplementation } from "./interfaces/IGroupImplementation.sol";
import { IChatStorageFactory } from "./interfaces/IChatStorageFactory.sol";

/// @title GroupImplementation
/// @notice Isolated Group Clone logic contract in EVM Chat State Storage Protocol
contract GroupImplementation is Initializable, IGroupImplementation {
    // --- Storage Slots (Strictly Packed According to ARCHITECTURE.md) ---
    // Slot 0: uint256 public groupId;
    uint256 public groupId;

    // Slot 1: [address owner (20B)] [uint8 status (1B)] [uint8 joinMode (1B)]
    address public owner;
    GroupStatus public status;
    JoinMode public joinMode;

    // Slot 2: address public pendingOwner;
    address public pendingOwner;

    // Slot 3: uint256 public maxMembers; (0 = unlimited)
    uint256 public maxMembers;

    // Slot 4: uint32 public metadataVersion;
    uint32 public metadataVersion;

    // Slot 6: bytes internal _metadata (UTF-8 JSON, <= 8KB)
    bytes internal _metadata;

    // Slot 7: mapping(address => MemberRecord) internal _members
    mapping(address => MemberRecord) internal _members;

    // Slot 8: address[] internal _memberList
    address[] internal _memberList;

    // Slot 9: mapping(address => uint256) internal _memberIndex (1-based index)
    mapping(address => uint256) internal _memberIndex;

    // Slot 10: mapping(address => bytes) internal _memberMetadata (<= 2KB)
    mapping(address => bytes) internal _memberMetadata;

    // Slot 11: mapping(address => uint32) internal _memberMetadataVersion
    mapping(address => uint32) internal _memberMetadataVersion;

    // Slot 12: mapping(bytes32 => InviteRecord) internal _invites
    mapping(bytes32 => InviteRecord) internal _invites;

    // Slot 13: address public factory
    address public factory;

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAdminOrOwner() {
        Role senderRole = getMemberRole(msg.sender);
        if (senderRole != Role.ADMIN && senderRole != Role.OWNER) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyActiveGroup() {
        if (status == GroupStatus.CLOSED) revert GroupClosed();
        if (status == GroupStatus.PAUSED) revert GroupPaused();
        _;
    }

    /// @notice Lock implementation contract from being initialized directly
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize group clone
    function initialize(
        uint256 _groupId,
        address _owner,
        bytes calldata metadata,
        address[] calldata initialMembers,
        JoinMode _joinMode,
        uint256 _maxMembers,
        address _factory
    ) external initializer {
        if (_owner == address(0) || _factory == address(0)) revert ZeroAddress();
        if (metadata.length > MAX_GROUP_METADATA_SIZE) {
            revert MetadataSizeExceeded(metadata.length, MAX_GROUP_METADATA_SIZE);
        }

        groupId = _groupId;
        owner = _owner;
        status = GroupStatus.ACTIVE;
        joinMode = _joinMode;
        maxMembers = _maxMembers;
        factory = _factory;

        if (metadata.length > 0) {
            _metadata = metadata;
            metadataVersion = 1;
        }

        // Add owner as initial member
        _addMemberInternal(_owner, Role.ADMIN);

        // Add initial members
        uint256 initLen = initialMembers.length;
        for (uint256 i = 0; i < initLen;) {
            address m = initialMembers[i];
            if (m != address(0) && m != _owner && _members[m].status != MemberStatus.MEMBER) {
                _addMemberInternal(m, Role.MEMBER);
            }
            unchecked {
                ++i;
            }
        }

        emit GroupInitialized(_groupId, _owner, _joinMode, _maxMembers);
        if (metadata.length > 0) {
            emit GroupMetadataUpdated(_groupId, metadataVersion, metadata);
        }
    }

    // --- Core Views ---

    function getMetadata() external view returns (bytes memory) {
        return _metadata;
    }

    function getInvite(bytes32 codeHash) external view returns (InviteRecord memory) {
        return _invites[codeHash];
    }

    function memberCount() external view override returns (uint256) {
        return _memberList.length;
    }

    // --- Group Settings & Lifecycle Mutators ---

    function setMetadata(bytes calldata metadata) external onlyOwner {
        if (status == GroupStatus.CLOSED) revert GroupClosed();
        if (metadata.length > MAX_GROUP_METADATA_SIZE) {
            revert MetadataSizeExceeded(metadata.length, MAX_GROUP_METADATA_SIZE);
        }
        _metadata = metadata;
        unchecked {
            metadataVersion++;
        }
        emit GroupMetadataUpdated(groupId, metadataVersion, metadata);
    }

    function setJoinMode(JoinMode newMode) external onlyAdminOrOwner {
        if (status == GroupStatus.CLOSED) revert GroupClosed();
        joinMode = newMode;
        emit GroupJoinModeUpdated(groupId, newMode);
    }

    function setMaxMembers(uint256 newMaxMembers) external onlyAdminOrOwner {
        if (status == GroupStatus.CLOSED) revert GroupClosed();
        uint256 currentCount = _memberList.length;
        if (newMaxMembers > 0 && currentCount > newMaxMembers) {
            revert GroupFull(currentCount, newMaxMembers);
        }
        maxMembers = newMaxMembers;
        emit GroupMaxMembersUpdated(groupId, newMaxMembers);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        if (newOwner == owner) revert CannotOperateSelf();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(groupId, owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);

        if (_members[msg.sender].status != MemberStatus.MEMBER) {
            _addMemberInternal(msg.sender, Role.ADMIN);
        }

        emit OwnershipTransferred(groupId, previousOwner, msg.sender);
    }

    function pause() external onlyAdminOrOwner {
        if (status == GroupStatus.CLOSED) revert GroupClosed();
        status = GroupStatus.PAUSED;
        emit GroupStatusUpdated(groupId, GroupStatus.PAUSED);
    }

    function resume() external onlyAdminOrOwner {
        if (status == GroupStatus.CLOSED) revert GroupClosed();
        status = GroupStatus.ACTIVE;
        emit GroupStatusUpdated(groupId, GroupStatus.ACTIVE);
    }

    function close() external onlyOwner {
        if (status == GroupStatus.CLOSED) revert GroupClosed();
        status = GroupStatus.CLOSED;
        emit GroupStatusUpdated(groupId, GroupStatus.CLOSED);
    }

    // --- Membership Mutators ---

    function join() external onlyActiveGroup {
        if (joinMode != JoinMode.PUBLIC) {
            revert InvalidJoinMode(joinMode);
        }
        _addMemberInternal(msg.sender, Role.MEMBER);
    }

    function leave() external {
        if (msg.sender == owner) revert CannotOperateSelf();
        if (_members[msg.sender].status != MemberStatus.MEMBER) revert MemberNotFound(msg.sender);

        _removeMemberInternal(msg.sender, msg.sender);
        emit MemberLeft(groupId, msg.sender);
    }

    function addMember(address user) external onlyActiveGroup onlyAdminOrOwner {
        _addMemberInternal(user, Role.MEMBER);
    }

    function removeMember(address user) external {
        _checkCanModerate(msg.sender, user);
        _removeMemberInternal(user, msg.sender);
        emit MemberRemoved(groupId, user, msg.sender);
    }

    function batchAddMembers(address[] calldata users) external onlyActiveGroup onlyAdminOrOwner {
        uint256 len = users.length;
        for (uint256 i = 0; i < len;) {
            _addMemberInternal(users[i], Role.MEMBER);
            unchecked {
                ++i;
            }
        }
    }

    function batchRemoveMembers(address[] calldata users) external {
        uint256 len = users.length;
        for (uint256 i = 0; i < len;) {
            address u = users[i];
            _checkCanModerate(msg.sender, u);
            _removeMemberInternal(u, msg.sender);
            emit MemberRemoved(groupId, u, msg.sender);
            unchecked {
                ++i;
            }
        }
    }

    // --- Membership & Role Queries ---

    function isMember(address user) external view returns (bool) {
        return _members[user].status == MemberStatus.MEMBER;
    }

    function getMember(address user) external view returns (MemberRecord memory) {
        return _members[user];
    }

    function getMemberRole(address user) public view returns (Role) {
        if (user == owner) {
            return Role.OWNER;
        }
        if (_members[user].status != MemberStatus.MEMBER) {
            return Role.MEMBER;
        }
        return _members[user].role;
    }

    function getMembers(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 total = _memberList.length;
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
            result[i] = _memberList[offset + i];
            unchecked {
                ++i;
            }
        }
        return result;
    }

    function getMemberViews(uint256 offset, uint256 limit) external view returns (MemberView[] memory) {
        uint256 total = _memberList.length;
        if (offset >= total || limit == 0) {
            return new MemberView[](0);
        }
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 count = end - offset;
        MemberView[] memory views = new MemberView[](count);
        for (uint256 i = 0; i < count;) {
            address m = _memberList[offset + i];
            MemberRecord memory rec = _members[m];
            views[i] = MemberView({
                memberAddress: m,
                status: rec.status,
                role: getMemberRole(m),
                joinedAt: rec.joinedAt,
                muteUntil: rec.muteUntil,
                banUntil: rec.banUntil,
                metadata: _memberMetadata[m],
                metadataVersion: _memberMetadataVersion[m]
            });
            unchecked {
                ++i;
            }
        }
        return views;
    }

    function getMemberMetadata(address user) external view returns (bytes memory metadata, uint32 version) {
        return (_memberMetadata[user], _memberMetadataVersion[user]);
    }

    // --- Role Management ---

    function grantRole(address user, Role role) external onlyOwner {
        if (user == address(0)) revert ZeroAddress();
        if (user == owner) revert CannotOperateSelf();
        if (role == Role.OWNER) revert InvalidTargetRole(role);
        if (_members[user].status != MemberStatus.MEMBER) revert MemberNotFound(user);

        _members[user].role = role;
        emit RoleGranted(groupId, user, role, msg.sender);
    }

    function revokeRole(address user) external onlyOwner {
        if (user == address(0)) revert ZeroAddress();
        if (user == owner) revert CannotRevokeOrDemoteOwner();
        if (_members[user].status != MemberStatus.MEMBER) revert MemberNotFound(user);

        _members[user].role = Role.MEMBER;
        emit RoleRevoked(groupId, user, msg.sender);
    }

    // --- Moderation (Mute & Ban) ---

    function mute(address user, uint64 duration) external {
        _checkCanModerate(msg.sender, user);
        uint64 until = uint64(block.timestamp) + duration;
        _members[user].muteUntil = until;
        emit MemberMutedEvent(groupId, user, until, msg.sender);
    }

    function unmute(address user) external {
        _checkCanModerate(msg.sender, user);
        _members[user].muteUntil = 0;
        emit MemberUnmutedEvent(groupId, user, msg.sender);
    }

    function batchMuteMembers(address[] calldata users, uint64 duration) external {
        uint256 len = users.length;
        uint64 until = uint64(block.timestamp) + duration;
        for (uint256 i = 0; i < len;) {
            address u = users[i];
            _checkCanModerate(msg.sender, u);
            _members[u].muteUntil = until;
            emit MemberMutedEvent(groupId, u, until, msg.sender);
            unchecked {
                ++i;
            }
        }
    }

    function ban(address user, uint64 duration) external {
        _checkCanModerate(msg.sender, user);
        _banMemberInternal(user, duration, msg.sender);
    }

    function unban(address user) external onlyAdminOrOwner {
        if (user == address(0)) revert ZeroAddress();
        if (_members[user].status != MemberStatus.BANNED) return;

        delete _members[user];
        emit MemberUnbannedEvent(groupId, user, msg.sender);
    }

    function batchBanMembers(address[] calldata users, uint64 duration) external {
        uint256 len = users.length;
        for (uint256 i = 0; i < len;) {
            address u = users[i];
            _checkCanModerate(msg.sender, u);
            _banMemberInternal(u, duration, msg.sender);
            unchecked {
                ++i;
            }
        }
    }

    function batchUnbanMembers(address[] calldata users) external onlyAdminOrOwner {
        uint256 len = users.length;
        for (uint256 i = 0; i < len;) {
            address u = users[i];
            if (u != address(0) && _members[u].status == MemberStatus.BANNED) {
                delete _members[u];
                emit MemberUnbannedEvent(groupId, u, msg.sender);
            }
            unchecked {
                ++i;
            }
        }
    }

    // --- Member Profile in Group ---

    function setMyMetadata(bytes calldata metadata) external {
        if (_members[msg.sender].status != MemberStatus.MEMBER) revert MemberNotFound(msg.sender);
        if (metadata.length > MAX_MEMBER_METADATA_SIZE) {
            revert MetadataSizeExceeded(metadata.length, MAX_MEMBER_METADATA_SIZE);
        }
        _memberMetadata[msg.sender] = metadata;
        uint32 newVersion;
        unchecked {
            newVersion = ++_memberMetadataVersion[msg.sender];
        }
        emit MemberMetadataUpdated(groupId, msg.sender, newVersion, metadata);
    }

    // --- Invites ---

    function createInvite(bytes32 codeHash, uint64 expiresAt, uint32 maxUses) external onlyAdminOrOwner {
        if (codeHash == bytes32(0)) revert InviteInvalidOrExpired();
        if (_invites[codeHash].active) revert InviteAlreadyExists();
        _invites[codeHash] =
            InviteRecord({ inviter: msg.sender, maxUses: maxUses, usedCount: 0, active: true, expiresAt: expiresAt });
        emit InviteCreated(groupId, codeHash, msg.sender, maxUses, expiresAt);
    }

    function revokeInvite(bytes32 codeHash) external {
        InviteRecord storage inv = _invites[codeHash];
        if (!inv.active) revert InviteInactive();

        Role senderRole = getMemberRole(msg.sender);
        if (msg.sender != inv.inviter && senderRole != Role.ADMIN && senderRole != Role.OWNER) {
            revert Unauthorized();
        }

        inv.active = false;
        emit InviteRevoked(groupId, codeHash, msg.sender);
    }

    function useInvite(bytes32 codeHash) external onlyActiveGroup {
        if (joinMode != JoinMode.INVITE_ONLY && joinMode != JoinMode.PUBLIC) {
            revert InvalidJoinMode(joinMode);
        }

        InviteRecord storage inv = _invites[codeHash];
        if (!inv.active || (inv.expiresAt != 0 && block.timestamp > inv.expiresAt)) {
            revert InviteInvalidOrExpired();
        }
        if (inv.maxUses != 0 && inv.usedCount >= inv.maxUses) {
            revert InviteMaxUsesReached();
        }

        inv.usedCount++;
        emit InviteUsed(groupId, codeHash, msg.sender);

        _addMemberInternal(msg.sender, Role.MEMBER);
    }

    // --- Internal Helpers ---

    function _addMemberInternal(address user, Role role) internal {
        if (user == address(0)) revert ZeroAddress();
        if (_members[user].status == MemberStatus.MEMBER) revert MemberAlreadyExists(user);
        if (_members[user].status == MemberStatus.BANNED) {
            if (_members[user].banUntil > block.timestamp) {
                revert MemberBanned(user, _members[user].banUntil);
            }
        }

        uint256 currentCount = _memberList.length;
        if (maxMembers > 0 && currentCount >= maxMembers) {
            revert GroupFull(currentCount, maxMembers);
        }

        _members[user] = MemberRecord({
            status: MemberStatus.MEMBER, role: role, joinedAt: uint64(block.timestamp), muteUntil: 0, banUntil: 0
        });

        _memberList.push(user);
        _memberIndex[user] = _memberList.length;

        emit MemberJoined(groupId, user);

        // Notify factory for user -> group index
        if (factory != address(0)) {
            IChatStorageFactory(factory).onUserJoinedGroup(user, groupId);
        }
    }

    function _removeMemberInternal(
        address user,
        address /* operator */
    )
        internal
    {
        if (user == address(0)) revert ZeroAddress();
        if (_members[user].status != MemberStatus.MEMBER) revert MemberNotFound(user);

        uint256 indexPlusOne = _memberIndex[user];
        if (indexPlusOne != 0) {
            uint256 idx = indexPlusOne - 1;
            uint256 lastIdx = _memberList.length - 1;
            if (idx != lastIdx) {
                address lastItem = _memberList[lastIdx];
                _memberList[idx] = lastItem;
                _memberIndex[lastItem] = indexPlusOne;
            }
            _memberList.pop();
            delete _memberIndex[user];
        }

        delete _members[user];

        // Notify factory for user -> group index removal
        if (factory != address(0)) {
            IChatStorageFactory(factory).onUserLeftGroup(user, groupId);
        }
    }

    function _banMemberInternal(address user, uint64 duration, address operator) internal {
        uint64 until = duration == 0 ? type(uint64).max : uint64(block.timestamp) + duration;
        bool wasMember = (_members[user].status == MemberStatus.MEMBER);

        if (wasMember) {
            uint256 indexPlusOne = _memberIndex[user];
            if (indexPlusOne != 0) {
                uint256 idx = indexPlusOne - 1;
                uint256 lastIdx = _memberList.length - 1;
                if (idx != lastIdx) {
                    address lastItem = _memberList[lastIdx];
                    _memberList[idx] = lastItem;
                    _memberIndex[lastItem] = indexPlusOne;
                }
                _memberList.pop();
                delete _memberIndex[user];
            }
        }

        _members[user] = MemberRecord({
            status: MemberStatus.BANNED, role: Role.MEMBER, joinedAt: 0, muteUntil: 0, banUntil: until
        });

        emit MemberBannedEvent(groupId, user, until, operator);

        if (wasMember && factory != address(0)) {
            IChatStorageFactory(factory).onUserLeftGroup(user, groupId);
        }
    }

    function _checkCanModerate(address operator, address target) internal view {
        if (target == address(0)) revert ZeroAddress();
        if (target == owner) revert CannotRevokeOrDemoteOwner();
        if (operator == target) revert CannotOperateSelf();

        Role operatorRole = getMemberRole(operator);
        Role targetRole = getMemberRole(target);

        if (operatorRole <= targetRole || operatorRole < Role.MODERATOR) {
            revert InvalidRoleHierarchy(operatorRole, targetRole);
        }
    }
}
