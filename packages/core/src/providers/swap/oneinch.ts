import type { EvmSwapTx, SwapProvider } from "./SwapProvider";
import type { SwapQuote, SwapQuoteRequest } from "../../types";
import { getChain, isEvm, type ChainId } from "../../chains";

const ONEINCH_BASE = "https://api.1inch.dev/swap/v6.0";

/**
 * 1inch (all EVM chains). Requires an API key from portal.1inch.dev.
 * Platform fee via `fee` + `referrer` params (revenue model, spec §1.2).
 * MEV: on Ethereum mainnet the built tx should be broadcast through a
 * private RPC (Flashbots Protect) — see apps/web/lib/evm.ts.
 */
export class OneInchProvider implements SwapProvider {
  readonly id = "1inch" as const;
  constructor(
    private readonly apiKey: string,
    private readonly platformFeeBps: number = 0,
    private readonly referrer?: string,
  ) {}

  supports(chain: ChainId): boolean {
    return isEvm(chain);
  }

  async quote(req: SwapQuoteRequest): Promise<SwapQuote> {
    const evmId = getChain(req.chain).evmChainId;
    const url = new URL(`${ONEINCH_BASE}/${evmId}/quote`);
    url.searchParams.set("src", req.inputToken);
    url.searchParams.set("dst", req.outputToken);
    url.searchParams.set("amount", req.amountIn);
    url.searchParams.set("includeProtocols", "true");
    if (this.platformFeeBps > 0 && this.referrer) {
      url.searchParams.set("fee", (this.platformFeeBps / 100).toFixed(2)); // 1inch takes %
      url.searchParams.set("referrer", this.referrer);
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}`, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`1inch quote failed: ${res.status} ${await res.text()}`);
    const q = (await res.json()) as { dstAmount: string; protocols?: unknown };
    const minOut =
      (BigInt(q.dstAmount) * BigInt(10_000 - req.slippageBps)) / BigInt(10_000);
    return {
      provider: "1inch",
      chain: req.chain,
      amountIn: req.amountIn,
      amountOut: q.dstAmount,
      minAmountOut: minOut.toString(),
      priceImpactPct: null, // 1inch quote v6 does not return impact; computed vs. market price in UI
      platformFeeBps: this.platformFeeBps,
      route: [],
      raw: q,
    };
  }

  /** Builds the ready-to-sign swap tx (native-token input → no approval). */
  async buildTx(req: SwapQuoteRequest & { taker: string }): Promise<EvmSwapTx> {
    const evmId = getChain(req.chain).evmChainId;
    const url = new URL(`${ONEINCH_BASE}/${evmId}/swap`);
    url.searchParams.set("src", req.inputToken);
    url.searchParams.set("dst", req.outputToken);
    url.searchParams.set("amount", req.amountIn);
    url.searchParams.set("from", req.taker);
    url.searchParams.set("slippage", (req.slippageBps / 100).toString());
    if (this.platformFeeBps > 0 && this.referrer) {
      url.searchParams.set("fee", (this.platformFeeBps / 100).toFixed(2));
      url.searchParams.set("referrer", this.referrer);
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}`, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`1inch swap build failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { tx: { to: string; data: string; value: string; gas?: number } };
    return {
      to: body.tx.to,
      data: body.tx.data,
      value: body.tx.value,
      gas: body.tx.gas ? String(body.tx.gas) : undefined,
    };
  }
}
