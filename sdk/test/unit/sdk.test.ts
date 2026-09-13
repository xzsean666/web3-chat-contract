// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from "vitest";
import {
  MAX_GROUP_METADATA_SIZE,
  MAX_MEMBER_METADATA_SIZE,
  MAX_USER_METADATA_SIZE,
  MetadataSizeExceededError,
  generateInviteCode,
  hashInviteCode,
  parseChatError,
  parseMetadata,
  RpcPoolManager,
  serializeMetadata,
} from "../../src";

describe("JSON Serialization & Size Limits", () => {
  it("serializes normal objects within size limit", () => {
    const obj = { name: "Alice", bio: "Web3 Chat", tags: ["dev", "evm"] };
    const hex = serializeMetadata(obj, MAX_USER_METADATA_SIZE);
    expect(hex.startsWith("0x")).toBe(true);

    const parsed = parseMetadata(hex);
    expect(parsed).toEqual(obj);
  });

  it("handles null or undefined safely", () => {
    expect(serializeMetadata(null, 1000)).toBe("0x");
    expect(serializeMetadata(undefined, 1000)).toBe("0x");
    expect(parseMetadata("0x")).toEqual({});
  });

  it("throws MetadataSizeExceededError when payload exceeds limit", () => {
    const largeString = "a".repeat(MAX_USER_METADATA_SIZE + 10);
    expect(() => {
      serializeMetadata(largeString, MAX_USER_METADATA_SIZE);
    }).toThrowError(MetadataSizeExceededError);
  });

  it("respects member metadata size limit (2KB)", () => {
    const largeBio = "x".repeat(MAX_MEMBER_METADATA_SIZE + 5);
    expect(() => {
      serializeMetadata({ bio: largeBio }, MAX_MEMBER_METADATA_SIZE);
    }).toThrowError(MetadataSizeExceededError);
  });
});

describe("RpcPoolManager Load Balancing & Circuit Breaker", () => {
  it("cycles nodes in round-robin strategy", () => {
    const urls = ["https://rpc1.internal", "https://rpc2.internal", "https://rpc3.internal"];
    const pool = new RpcPoolManager({
      rpcUrls: urls,
      strategy: "round-robin",
    });

    const node1 = pool.selectNode();
    const node2 = pool.selectNode();
    const node3 = pool.selectNode();
    const node4 = pool.selectNode();

    expect(node1.url).toBe(urls[0]);
    expect(node2.url).toBe(urls[1]);
    expect(node3.url).toBe(urls[2]);
    expect(node4.url).toBe(urls[0]);
  });

  it("always prefers healthy low-latency node in latency-ranked strategy", () => {
    const urls = ["https://rpc-slow.internal", "https://rpc-fast.internal"];
    const pool = new RpcPoolManager({
      rpcUrls: urls,
      strategy: "latency-ranked",
    });

    const healthy = pool.getHealthyNodes();
    pool.recordSuccess(healthy[0], 250); // slow
    pool.recordSuccess(healthy[1], 15);  // fast

    const selected = pool.selectNode();
    expect(selected.url).toBe(urls[1]);
  });

  it("triggers circuit breaker cooldown after consecutive failures", () => {
    const urls = ["https://rpc-fail.internal", "https://rpc-good.internal"];
    const pool = new RpcPoolManager({
      rpcUrls: urls,
      maxFailures: 2,
      cooldownMs: 10_000,
      strategy: "round-robin",
    });

    const nodeFail = pool.selectNode();
    expect(nodeFail.url).toBe(urls[0]);

    // Record 2 failures
    pool.recordFailure(nodeFail);
    expect(nodeFail.cooldownUntil).toBe(0);

    pool.recordFailure(nodeFail);
    expect(nodeFail.cooldownUntil).toBeGreaterThan(Date.now());

    // Next selection should skip the failed node
    const nextNode = pool.selectNode();
    expect(nextNode.url).toBe(urls[1]);
  });

  it("selects nodes based on weights", () => {
    const pool = new RpcPoolManager({
      nodes: [
        { url: "https://rpc-heavy.internal", weight: 10 },
        { url: "https://rpc-light.internal", weight: 1 },
      ],
      strategy: "round-robin",
    });

    const selectedUrls: string[] = [];
    for (let i = 0; i < 50; i++) {
      selectedUrls.push(pool.selectNode().url);
    }

    const heavyCount = selectedUrls.filter((u) => u === "https://rpc-heavy.internal").length;
    expect(heavyCount).toBeGreaterThan(30);
  });
});

describe("Prototype Pollution Defense", () => {
  it("sanitizes __proto__, constructor, and prototype from parsed metadata", () => {
    const maliciousJson = '{"__proto__":{"polluted":"yes"},"constructor":{"polluted":"yes"},"name":"Alice"}';
    const hex = ("0x" + Buffer.from(maliciousJson, "utf8").toString("hex")) as `0x${string}`;

    const parsed: any = parseMetadata(hex);
    expect(parsed.name).toBe("Alice");
    expect((({} as any).polluted)).toBeUndefined();
    expect(parsed.__proto__?.polluted).toBeUndefined();
    expect(parsed.constructor?.polluted).toBeUndefined();
  });
});

describe("Invite Code Generation & Hashing", () => {
  it("hashes plaintext invite code into 32-byte hex hash", () => {
    const code = "ALPHA-2026";
    const hash = hashInviteCode(code);
    expect(hash.startsWith("0x")).toBe(true);
    expect(hash.length).toBe(66); // 32 bytes = 64 hex chars + 0x

    // Same input produces same hash
    expect(hashInviteCode(code)).toBe(hash);
  });

  it("generates random invite code secret with matching hash", () => {
    const { secret, codeHash } = generateInviteCode("TEST");
    expect(secret.startsWith("TEST-")).toBe(true);
    expect(codeHash.startsWith("0x")).toBe(true);
    expect(codeHash.length).toBe(66);

    expect(hashInviteCode(secret)).toBe(codeHash);
  });

  it("throws on empty invite code secret", () => {
    expect(() => hashInviteCode("")).toThrow();
    expect(() => hashInviteCode("   ")).toThrow();
  });
});

describe("Chat Error Parser", () => {
  it("parses known custom error names and descriptions from messages", () => {
    const err1 = new Error("Contract call reverted with custom error UserBlocked(0x123...)");
    const parsed1 = parseChatError(err1);
    expect(parsed1.errorName).toBe("UserBlocked");
    expect(parsed1.message).toContain("blocked");

    const err2 = new Error("reverted with GroupFull(50, 50)");
    const parsed2 = parseChatError(err2);
    expect(parsed2.errorName).toBe("GroupFull");
    expect(parsed2.message).toContain("maximum member capacity");

    const err3 = new Error("reverted with MemberMuted(0xabc, 12345)");
    const parsed3 = parseChatError(err3);
    expect(parsed3.errorName).toBe("MemberMuted");
    expect(parsed3.message).toContain("muted");
  });

  it("gracefully handles unknown errors", () => {
    const unknownErr = new Error("Network timeout after 5000ms");
    const parsed = parseChatError(unknownErr);
    expect(parsed.errorName).toBeUndefined();
    expect(parsed.message).toBe("Network timeout after 5000ms");
  });
});

describe("RpcPoolManager Rate-Limit Body Failover", () => {
  it("fails over when receiving rate-limit error inside HTTP 200 response body", async () => {
    const urls = ["https://rpc-rl.internal", "https://rpc-ok.internal"];
    const pool = new RpcPoolManager({
      rpcUrls: urls,
      maxFailures: 1,
      cooldownMs: 50_000,
      strategy: "round-robin",
    });

    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: any) => {
      calls++;
      const url = String(input);
      if (url === urls[0]) {
        return {
          status: 200,
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32005, message: "rate limit exceeded: daily request count exceeded" },
          }),
        } as any;
      }
      return {
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: "0x1234",
        }),
      } as any;
    });

    try {
      const res = await pool.request("eth_blockNumber", []);
      expect(res).toBe("0x1234");
      expect(calls).toBeGreaterThanOrEqual(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

