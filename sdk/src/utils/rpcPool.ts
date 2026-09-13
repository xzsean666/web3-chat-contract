// SPDX-License-Identifier: MIT
import { custom, type Transport } from "viem";
import type { LoadBalancingStrategy, RpcNodeConfig, RpcPoolConfig } from "../types";

interface NodeState {
  url: string;
  weight: number;
  timeoutMs: number;
  consecutiveFailures: number;
  cooldownUntil: number;
  avgLatencyMs: number;
}

export class RpcPoolManager {
  private nodes: NodeState[] = [];
  private strategy: LoadBalancingStrategy;
  private maxFailures: number;
  private cooldownMs: number;
  private currentIndex = 0;

  constructor(config: RpcPoolConfig) {
    this.strategy = config.strategy || "round-robin";
    this.maxFailures = config.maxFailures ?? 3;
    this.cooldownMs = config.cooldownMs ?? 15_000;

    if (config.nodes && config.nodes.length > 0) {
      this.nodes = config.nodes.map((n) => ({
        url: n.url,
        weight: n.weight ?? 1,
        timeoutMs: n.timeoutMs ?? 10_000,
        consecutiveFailures: 0,
        cooldownUntil: 0,
        avgLatencyMs: 0,
      }));
    } else if (config.rpcUrls && config.rpcUrls.length > 0) {
      this.nodes = config.rpcUrls.map((url) => ({
        url,
        weight: 1,
        timeoutMs: 10_000,
        consecutiveFailures: 0,
        cooldownUntil: 0,
        avgLatencyMs: 0,
      }));
    } else {
      throw new Error("RpcPoolConfig must provide at least one rpcUrl or node");
    }
  }

  public getHealthyNodes(): NodeState[] {
    const now = Date.now();
    const available = this.nodes.filter((n) => n.cooldownUntil <= now);
    if (available.length === 0) {
      // If all nodes are in cooldown, forgive the node with shortest remaining cooldown
      return [...this.nodes].sort((a, b) => a.cooldownUntil - b.cooldownUntil).slice(0, 1);
    }
    return available;
  }

  public selectNode(): NodeState {
    const healthy = this.getHealthyNodes();

    if (this.strategy === "latency-ranked") {
      return [...healthy].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
    }

    if (this.strategy === "fallback") {
      return healthy[0];
    }

    // Weighted / round-robin selection
    const totalWeight = healthy.reduce((sum, n) => sum + (n.weight > 0 ? n.weight : 1), 0);
    if (totalWeight > healthy.length) {
      let rand = Math.random() * totalWeight;
      for (const n of healthy) {
        rand -= (n.weight > 0 ? n.weight : 1);
        if (rand <= 0) {
          return n;
        }
      }
      return healthy[healthy.length - 1];
    }

    // Default: round-robin
    const node = healthy[this.currentIndex % healthy.length];
    this.currentIndex = (this.currentIndex + 1) % healthy.length;
    return node;
  }

  public recordSuccess(node: NodeState, latencyMs: number): void {
    node.consecutiveFailures = 0;
    node.cooldownUntil = 0;
    node.avgLatencyMs = node.avgLatencyMs === 0 ? latencyMs : (node.avgLatencyMs * 0.7 + latencyMs * 0.3);
  }

  public recordFailure(node: NodeState): void {
    node.consecutiveFailures++;
    if (node.consecutiveFailures >= this.maxFailures) {
      node.cooldownUntil = Date.now() + this.cooldownMs;
    }
  }

  public async request(method: string, params: any[] = []): Promise<any> {
    const maxRetries = Math.min(this.nodes.length * 2, 5);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const node = this.selectNode();
      const startTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), node.timeoutMs);

      try {
        let response: Response;
        try {
          response = await fetch(node.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: Date.now() + attempt,
              method,
              params,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (response.status === 429 || response.status >= 500) {
          this.recordFailure(node);
          lastError = new Error(`HTTP ${response.status} from ${node.url}`);
          // Exponential backoff with jitter on rate limit or server error
          const backoffMs = Math.min(50 * Math.pow(2, attempt) + Math.random() * 25, 400);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        const data: any = await response.json();
        const latency = Date.now() - startTime;
        this.recordSuccess(node, latency);

        if (data.error) {
          const errMsg = (data.error.message || "").toLowerCase();
          const errCode = data.error.code;
          const isRateLimitOrTemporary =
            errCode === 429 ||
            errCode === -32005 ||
            errCode === -32603 ||
            errMsg.includes("rate limit") ||
            errMsg.includes("too many requests") ||
            errMsg.includes("daily limit") ||
            errMsg.includes("credits") ||
            errMsg.includes("throughput") ||
            errMsg.includes("timeout") ||
            errMsg.includes("temporarily unavailable");

          if (isRateLimitOrTemporary) {
            this.recordFailure(node);
            lastError = new Error(`RPC error (${errCode}) from ${node.url}: ${data.error.message}`);
            const backoffMs = Math.min(50 * Math.pow(2, attempt) + Math.random() * 25, 400);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          // JSON-RPC execution revert error. Do not fail the node, but throw the RPC error
          const err = new Error(data.error.message || "RPC Error");
          (err as any).code = data.error.code;
          (err as any).data = data.error.data;
          throw err;
        }

        return data.result;
      } catch (err: any) {
        if (err.code !== undefined || err.data !== undefined) {
          // RPC execution revert error - throw directly
          throw err;
        }
        // Network or HTTP failure
        this.recordFailure(node);
        lastError = err;
      }
    }

    throw lastError || new Error("All RPC nodes in pool failed");
  }

  public toTransport(): Transport {
    return custom({
      request: async ({ method, params }) => {
        return this.request(method, (params as any[]) || []);
      },
    });
  }
}
