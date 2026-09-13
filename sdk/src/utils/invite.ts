// SPDX-License-Identifier: MIT
import { keccak256, stringToBytes, type Hex } from "viem";

/**
 * Computes keccak256 hash of a plain text invite code secret
 * @param secret The plain text invite code secret (e.g. "BUIDL-2026-ALPHA")
 * @returns bytes32 Hex hash compatible with GroupImplementation.createInvite / useInvite
 */
export function hashInviteCode(secret: string): Hex {
  if (!secret || secret.trim().length === 0) {
    throw new Error("Invite code secret cannot be empty");
  }
  return keccak256(stringToBytes(secret.trim()));
}

/**
 * Generates a cryptographically secure random invite code secret and its keccak256 hash
 * @param prefix Optional custom prefix (default: "CHAT")
 * @returns An object containing the plain secret and the on-chain codeHash
 */
export function generateInviteCode(prefix = "CHAT"): { secret: string; codeHash: Hex } {
  const randomBytes = new Uint8Array(16);
  const webCrypto =
    typeof globalThis !== "undefined" && globalThis.crypto
      ? globalThis.crypto
      : typeof crypto !== "undefined"
      ? crypto
      : undefined;

  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 16; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const randomStr = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12)
    .toUpperCase();

  const secret = `${prefix}-${randomStr}`;
  const codeHash = hashInviteCode(secret);

  return { secret, codeHash };
}
