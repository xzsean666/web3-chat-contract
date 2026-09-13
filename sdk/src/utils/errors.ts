// SPDX-License-Identifier: MIT
import { BaseError, ContractFunctionRevertedError } from "viem";

export interface ParsedChatError {
  errorName?: string;
  args?: readonly unknown[];
  message: string;
}

const ERROR_DESCRIPTIONS: Record<string, string> = {
  ZeroAddress: "Operation involves an invalid zero address.",
  Unauthorized: "Caller is not authorized to perform this operation.",
  UnauthorizedClone: "Caller is not a registered contract clone.",
  AlreadyInitialized: "Contract instance has already been initialized.",
  ArrayLengthMismatch: "Array arguments length mismatch.",
  InvalidPagination: "Invalid pagination parameters (offset or limit).",
  MetadataSizeExceeded: "JSON metadata size exceeds protocol byte limit.",
  UserAlreadyRegistered: "This user address already has a registered UserClone.",
  UserNotRegistered: "Target user does not have a registered UserClone.",
  CannotOperateSelf: "Cannot perform this relationship or moderation action on yourself.",
  UserBlocked: "Operation blocked: one of the users has blocked the other.",
  UserDisabled: "User account is currently disabled.",
  AlreadyFriends: "Users are already mutual friends.",
  NotFriends: "Users are not mutual friends.",
  RequestPending: "A friend request is already pending between these users.",
  NoRequestPending: "No friend request found to accept, reject, or cancel.",
  RequestExpired: "Friend request has expired.",
  GroupNotFound: "Group does not exist.",
  GroupClosed: "Group is closed permanently.",
  GroupPaused: "Group operations are temporarily suspended.",
  GroupFull: "Group has reached its maximum member capacity.",
  InvalidJoinMode: "Current group join mode does not permit this action.",
  MemberAlreadyExists: "User is already a member of this group.",
  MemberNotFound: "User is not a member of this group.",
  MemberBanned: "User is banned from this group.",
  MemberMuted: "Member is currently muted.",
  InvalidRoleHierarchy: "Caller does not have sufficient role privilege over target.",
  InvalidTargetRole: "Cannot assign this target role.",
  CannotRevokeOrDemoteOwner: "Cannot demote or revoke role from group owner.",
  OwnershipTransferPending: "Ownership transfer is already pending.",
  NoPendingOwnershipTransfer: "No ownership transfer is currently pending.",
  NotPendingOwner: "Caller is not the designated pending owner.",
  InviteInvalidOrExpired: "Invite code is invalid or has expired.",
  InviteMaxUsesReached: "Invite code has reached its maximum usage limit.",
  InviteAlreadyExists: "An invite with this code hash is already active.",
  InviteInactive: "Invite code is inactive or revoked.",
};

/**
 * Extracts contract custom error details from Viem exceptions
 * @param error The thrown error or exception
 * @returns Parsed error with name, args, and human-readable explanation
 */
export function parseChatError(error: unknown): ParsedChatError {
  if (!error) {
    return { message: "Unknown error" };
  }

  // 1. Walk Viem BaseError hierarchy
  if (error instanceof BaseError) {
    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      const args = revertError.data?.args;
      const desc = errorName ? ERROR_DESCRIPTIONS[errorName] : undefined;

      return {
        errorName,
        args,
        message: desc || revertError.message,
      };
    }
  }

  // 2. Regex fallback for error names in string messages
  const str = String((error as any)?.message || error);
  for (const [name, desc] of Object.entries(ERROR_DESCRIPTIONS)) {
    if (str.includes(name)) {
      return {
        errorName: name,
        message: desc,
      };
    }
  }

  return {
    message: (error as any)?.message || String(error),
  };
}
