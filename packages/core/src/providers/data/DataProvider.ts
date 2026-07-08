import type { TokenMarketData } from "../../types";
import type { ChainId } from "../../chains";

/**
 * DataProvider — DexScreener primary, GeckoTerminal fallback.
 * Clients never call these directly; only route handlers / apps/api do
 * (rate-limit strategy, spec §6).
 */
export interface DataProvider {
  readonly id: "dexscreener" | "geckoterminal";
  tokenMarketData(chain: ChainId, address: string): Promise<TokenMarketData | null>;
  trendingPools(chain: ChainId, limit?: number): Promise<TokenMarketData[]>;
}

export class DataRouter {
  constructor(private readonly providers: DataProvider[]) {}

  async tokenMarketData(chain: ChainId, address: string): Promise<TokenMarketData | null> {
    for (const p of this.providers) {
      try {
        const d = await p.tokenMarketData(chain, address);
        if (d) return d;
      } catch {
        /* fall through to next provider */
      }
    }
    return null;
  }

  async trendingPools(chain: ChainId, limit = 10): Promise<TokenMarketData[]> {
    for (const p of this.providers) {
      try {
        const d = await p.trendingPools(chain, limit);
        if (d.length) return d;
      } catch {
        /* fall through */
      }
    }
    return [];
  }
}
