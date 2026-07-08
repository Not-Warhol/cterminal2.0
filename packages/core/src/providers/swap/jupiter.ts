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
 *
 * CRITICAL: Jupiter REQUIRES a `feeAccount` at build time whenever the
 * quote carries `platformFeeBps` — otherwise /swap fails with
 * `feeAccount is required for swap with platformFee` (NOT_SUPPORTED).
 * The feeAccount must be a Jupiter Referral Token Account (PDA of the
 * referral program, one per mint). So the fee is ALL-OR-NOTHING and gated
 * on `hasFeeAccount`: no configured account → we don't request the fee at
 * all → swaps always build (zero fee) instead of failing. Turn the fee on
 * by creating a referral account (referral.jup.ag) and setting
 * NEXT_PUBLIC_FEE_ACCOUNT_SOLANA.
 *
 * MEV: the swap tx is sent with a Jito tip — handled at signing time.
 */
export class JupiterProvider implements SwapProvider {
  readonly id = "jupiter" as const;
  constructor(
    private readonly platformFeeBps: number = 0,
    private readonly hasFeeAccount: boolean = false,
  ) {}

  /** Whether this quote actually carries a platform fee (build must match). */
  private get feeActive(): boolean {
    return this.platformFeeBps > 0 && this.hasFeeAccount;
  }

  supports(chain: ChainId): boolean {
    return chain === "solana";
  }

  async quote(req: SwapQuoteRequest): Promise<SwapQuote> {
    const url = new URL(`${JUP_BASE}/quote`);
    url.searchParams.set("inputMint", req.inputToken);
    url.searchParams.set("outputMint", req.outputToken);
    url.searchParams.set("amount", req.amountIn);
    url.searchParams.set("slippageBps", String(req.slippageBps));
    if (this.feeActive) {
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
      platformFeeBps: this.feeActive ? this.platformFeeBps : 0,
      route: q.routePlan?.map((r) => r.swapInfo.label) ?? [],
      raw: q,
    };
  }
}
