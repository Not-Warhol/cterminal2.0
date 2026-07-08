import type { SwapQuote, SwapQuoteRequest } from "../../types";
import type { ChainId } from "../../chains";

/**
 * SwapProvider — one implementation per aggregator (Jupiter, 1inch).
 * The router picks the provider by chain kind; adding a new aggregator
 * means implementing this interface, nothing else changes. (ADR-0003)
 */
export interface EvmSwapTx {
  to: string;
  data: string;
  value: string;
  gas?: string;
}

export interface SwapProvider {
  readonly id: "jupiter" | "1inch";
  supports(chain: ChainId): boolean;
  quote(req: SwapQuoteRequest): Promise<SwapQuote>;
  /** EVM only: build the ready-to-sign tx (Jupiter builds client-side). */
  buildTx?(req: SwapQuoteRequest & { taker: string }): Promise<EvmSwapTx>;
}

export class SwapRouter {
  constructor(private readonly providers: SwapProvider[]) {}
  quote(req: SwapQuoteRequest): Promise<SwapQuote> {
    return this.pick(req.chain).quote(req);
  }

  buildTx(req: SwapQuoteRequest & { taker: string }): Promise<EvmSwapTx> {
    const p = this.pick(req.chain);
    if (!p.buildTx) throw new Error(`${p.id} does not build server-side txs`);
    return p.buildTx(req);
  }

  private pick(chain: SwapQuoteRequest["chain"]): SwapProvider {
    const p = this.providers.find((x) => x.supports(chain));
    if (!p) throw new Error(`No swap provider for chain ${chain}`);
    return p;
  }
}
