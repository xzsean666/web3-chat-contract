// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from "vitest";
import {
  MAX_GROUP_METADATA_SIZE,
  MAX_MEMBER_METADATA_SIZE,
  MAX_USER_METADATA_SIZE,
  MetadataSizeExceededError,
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
