import type { SwapProvider } from "./SwapProvider";
import type { SwapQuote, SwapQuoteRequest } from "../../types";
import type { ChainId } from "../../chains";

const JUP_BASE = "https://lite-api.jup.ag/swap/v1";

interface JupiterQuoteResponse {
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: { swapInfo: { label: string } }[];
  [k: string]: unknown;
}

/**
 * Jupiter (Solana). Platform fee is applied via `platformFeeBps` +
 * a fee account passed at swap-build time (revenue model, spec §1.2).
 * MEV: the swap tx should be sent with a Jito tip — handled at signing
 * time in the frontend Solana adapter.
 */
export class JupiterProvider implements SwapProvider {
  readonly id = "jupiter" as const;
  constructor(private readonly platformFeeBps: number = 0) {}

  supports(chain: ChainId): boolean {
    return chain === "solana";
  }

  async quote(req: SwapQuoteRequest): Promise<SwapQuote> {
    const url = new URL(`${JUP_BASE}/quote`);
    url.searchParams.set("inputMint", req.inputToken);
    url.searchParams.set("outputMint", req.outputToken);
    url.searchParams.set("amount", req.amountIn);
    url.searchParams.set("slippageBps", String(req.slippageBps));
    if (this.platformFeeBps > 0) {
      url.searchParams.set("platformFeeBps", String(this.platformFeeBps));
    }
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Jupiter quote failed: ${res.status} ${await res.text()}`);
    const q = (await res.json()) as JupiterQuoteResponse;
    return {
      provider: "jupiter",
      chain: "solana",
      amountIn: q.inAmount,
      amountOut: q.outAmount,
      minAmountOut: q.otherAmountThreshold,
      priceImpactPct: q.priceImpactPct ? Number(q.priceImpactPct) * 100 : null,
      platformFeeBps: this.platformFeeBps,
      route: q.routePlan?.map((r) => r.swapInfo.label) ?? [],
      raw: q,
    };
  }
}
