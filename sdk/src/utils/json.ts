// SPDX-License-Identifier: MIT
import { fromHex, stringToHex, type Hex } from "viem";

export class MetadataSizeExceededError extends Error {
  public readonly size: number;
  public readonly limit: number;

  constructor(size: number, limit: number) {
    super(`Metadata size of ${size} bytes exceeds maximum allowed limit of ${limit} bytes`);
    this.name = "MetadataSizeExceededError";
    this.size = size;
    this.limit = limit;
  }
}

/**
 * Serializes an object or string into UTF-8 JSON bytes hex string, asserting size limits
 */
export function serializeMetadata(data: unknown, limit: number): Hex {
  if (data === null || data === undefined) {
    return "0x";
  }

  let jsonStr: string;
  if (typeof data === "string") {
    jsonStr = data;
  } else {
    jsonStr = JSON.stringify(data);
  }

  const byteLength = new TextEncoder().encode(jsonStr).length;
  if (byteLength > limit) {
    throw new MetadataSizeExceededError(byteLength, limit);
  }

  return stringToHex(jsonStr);
}

const safeReviver = (key: string, value: any) => {
  if (key === "__proto__" || key === "constructor" || key === "prototype") {
    return undefined;
  }
  return value;
};

/**
 * Parses UTF-8 JSON bytes hex string into an object or string with prototype pollution defense
 */
export function parseMetadata<T = Record<string, any>>(rawHex: Hex | string): T {
  if (!rawHex || rawHex === "0x" || rawHex.length <= 2) {
    return {} as T;
  }

  try {
    const text = fromHex(rawHex as Hex, "string");
    if (!text || text.trim().length === 0) {
      return {} as T;
    }
    return JSON.parse(text, safeReviver) as T;
  } catch {
    // If not JSON, return as string
    try {
      return fromHex(rawHex as Hex, "string") as unknown as T;
    } catch {
      return {} as T;
    }
  }
}
