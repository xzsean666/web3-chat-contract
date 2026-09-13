// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Maximum allowed byte sizes for extensible UTF-8 JSON metadata
uint256 constant MAX_USER_METADATA_SIZE = 4096; // 4 KB
uint256 constant MAX_USER_STATE_SIZE = 4096; // 4 KB
uint256 constant MAX_GROUP_METADATA_SIZE = 8192; // 8 KB
uint256 constant MAX_MEMBER_METADATA_SIZE = 2048; // 2 KB
uint256 constant MAX_FRIEND_METADATA_SIZE = 2048; // 2 KB

/// @notice User account lifecycle status
enum UserStatus {
    ACTIVE,
    DISABLED
}

/// @notice Bidirectional friend status machine
enum FriendStatus {
    NONE, // 0: No relation / reset
    PENDING_IN, // 1: Incoming request awaiting response
    PENDING_OUT, // 2: Outgoing request waiting for target
    FRIEND, // 3: Mutual confirmed friendship
    BLOCKED // 4: Blocked by user
}

/// @notice Group lifecycle status
enum GroupStatus {
    ACTIVE, // 0: Normal active operations
    PAUSED, // 1: Operations suspended, reads permitted
    CLOSED // 2: Terminal closed state
}

/// @notice Group joining policy
enum JoinMode {
    PUBLIC, // 0: Anyone can join directly
    INVITE_ONLY, // 1: Requires valid invite code
    ADMIN_ONLY, // 2: Only Admin/Owner can add members
    CLOSED // 3: No new members can join
}

/// @notice Group member status
enum MemberStatus {
    NONE, // 0: Not a member
    MEMBER, // 1: Active member
    BANNED // 2: Banned from group
}

/// @notice Hierarchical role in group (Strictly OWNER > ADMIN > MODERATOR > MEMBER)
enum Role {
    MEMBER, // 0: Basic member
    MODERATOR, // 1: Moderator (can mute / kick basic members)
    ADMIN, // 2: Administrator (can moderate, add, update invites)
    OWNER // 3: Group Owner (highest privilege, transfer ownership)
}

/// @notice Compact Friend record packed into exactly 1 storage slot (25 bytes <= 32 bytes)
struct FriendRecord {
    FriendStatus status; // uint8: 1 byte
    uint64 since; // uint64: 8 bytes (friendship established timestamp)
    uint64 mutedUntil; // uint64: 8 bytes (timestamp when mute expires, 0 if unmuted)
    uint64 expiresAt; // uint64: 8 bytes (request expiration timestamp, 0 if friend/none)
}

/// @notice Compact Member record packed into exactly 1 storage slot (26 bytes <= 32 bytes)
struct MemberRecord {
    MemberStatus status; // uint8: 1 byte
    Role role; // uint8: 1 byte
    uint64 joinedAt; // uint64: 8 bytes
    uint64 muteUntil; // uint64: 8 bytes
    uint64 banUntil; // uint64: 8 bytes (type(uint64).max indicates permanent ban)
}

/// @notice Compact Invite record packed into 2 storage slots
struct InviteRecord {
    address inviter; // 20 bytes (Slot A)
    uint32 maxUses; // 4 bytes  (Slot A)
    uint32 usedCount; // 4 bytes  (Slot A)
    bool active; // 1 byte   (Slot A)
    uint64 expiresAt; // 8 bytes  (Slot B)
}

/// @notice Rich view model for external friend queries
struct FriendView {
    address friendAddress;
    FriendStatus status;
    uint64 since;
    uint64 mutedUntil;
    uint64 expiresAt;
    bytes metadata;
    uint32 metadataVersion;
}

/// @notice Rich view model for external member queries
struct MemberView {
    address memberAddress;
    MemberStatus status;
    Role role;
    uint64 joinedAt;
    uint64 muteUntil;
    uint64 banUntil;
    bytes metadata;
    uint32 metadataVersion;
}

/// @notice High-level aggregation view of a Group
struct GroupOverview {
    uint256 groupId;
    address groupAddress;
    address owner;
    address pendingOwner;
    GroupStatus status;
    JoinMode joinMode;
    uint256 maxMembers;
    uint256 memberCount;
    uint32 metadataVersion;
    bytes metadata;
}

/// @notice High-level aggregation view of a User
struct UserOverview {
    address userAddress;
    address cloneAddress;
    UserStatus status;
    uint32 metadataVersion;
    bytes metadata;
    uint32 stateVersion;
    bytes state;
    uint256 friendCount;
    uint256 groupCount;
}
