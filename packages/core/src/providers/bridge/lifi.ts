import type { BridgeProvider } from "./BridgeProvider";
import type { BridgeQuote, BridgeQuoteRequest, BridgeStatusRequest, BridgeStatusResult } from "../../types";
import { getChain } from "../../chains";

const LIFI_BASE = "https://li.quest/v1";

/** LI.FI chain param: EVM uses numeric chain id, Solana uses "SOL". */
function lifiChain(chainId: BridgeQuoteRequest["fromChain"]): string {
  const c = getChain(chainId);
  return c.kind === "evm" ? String(c.evmChainId) : "SOL";
}

interface LifiQuoteResponse {
  estimate: {
    toAmount: string;
    executionDuration: number;
    feeCosts?: { amountUSD?: string }[];
    gasCosts?: { amountUSD?: string }[];
  };
  tool: string;
  [k: string]: unknown;
}

export class LifiProvider implements BridgeProvider {
  readonly id = "lifi" as const;
  /** API key raises rate limits — https://li.quest (server-side only). */
  constructor(private readonly apiKey?: string) {}

  async quote(req: BridgeQuoteRequest): Promise<BridgeQuote> {
    const url = new URL(`${LIFI_BASE}/quote`);
    url.searchParams.set("fromChain", lifiChain(req.fromChain));
    url.searchParams.set("toChain", lifiChain(req.toChain));
    url.searchParams.set("fromToken", req.fromToken);
    url.searchParams.set("toToken", req.toToken);
    url.searchParams.set("fromAmount", req.amountIn);
    url.searchParams.set("slippage", (req.slippageBps / 10_000).toString());
    if (req.fromAddress) url.searchParams.set("fromAddress", req.fromAddress);
    if (req.toAddress) url.searchParams.set("toAddress", req.toAddress);
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) headers["x-lifi-api-key"] = this.apiKey;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`LI.FI quote failed: ${res.status} ${await res.text()}`);
    const q = (await res.json()) as LifiQuoteResponse;
    const sum = (xs?: { amountUSD?: string }[]) =>
      (xs ?? []).reduce((a, x) => a + Number(x.amountUSD ?? 0), 0);
    return {
      provider: "lifi",
      fromChain: req.fromChain,
      toChain: req.toChain,
      amountIn: req.amountIn,
      estimatedAmountOut: q.estimate.toAmount,
      estimatedSeconds: q.estimate.executionDuration,
      feesUsd: sum(q.estimate.feeCosts),
      gasUsd: sum(q.estimate.gasCosts),
      tool: q.tool,
      raw: q,
    };
  }

  /**
   * Poll LI.FI transfer status. LI.FI substatus vocabulary:
   *   PENDING → still moving; DONE → completed; FAILED/INVALID → failed.
   * We translate into our BridgeState machine vocabulary (spec §4.5).
   */
  async status(req: BridgeStatusRequest): Promise<BridgeStatusResult> {
    const url = new URL(`${LIFI_BASE}/status`);
    url.searchParams.set("txHash", req.txHash);
    url.searchParams.set("bridge", req.tool);
    url.searchParams.set("fromChain", lifiChain(req.fromChain));
    url.searchParams.set("toChain", lifiChain(req.toChain));
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) headers["x-lifi-api-key"] = this.apiKey;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`LI.FI status failed: ${res.status}`);
    const q = (await res.json()) as {
      status?: string;
      substatus?: string;
      substatusMessage?: string;
      receiving?: { txHash?: string };
    };
    const map: Record<string, BridgeStatusResult["state"]> = {
      NOT_FOUND: "pending_source",
      INVALID: "failed",
      PENDING: "pending_bridge",
      DONE: "completed",
      FAILED: "failed",
    };
    return {
      state: map[q.status ?? "PENDING"] ?? "pending_bridge",
      destTxHash: q.receiving?.txHash ?? null,
      message: q.substatusMessage ?? q.substatus ?? null,
      raw: q,
    };
  }

}
