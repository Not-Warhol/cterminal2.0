import type { TokenMarketData, TokenTrade } from "../../types";
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
  search?(query: string): Promise<TokenMarketData[]>;
  feed?(chain: ChainId, path: "trending_pools" | "new_pools" | "pools", limit?: number): Promise<TokenMarketData[]>;
  trades?(chain: ChainId, pool: string, minUsd?: number): Promise<TokenTrade[]>;
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

  async search(query: string): Promise<TokenMarketData[]> {
    for (const p of this.providers) {
      if (!p.search) continue;
      try {
        const d = await p.search(query);
        if (d.length) return d;
      } catch {
        /* fall through */
      }
    }
    return [];
  }

  async feed(chain: ChainId, path: "trending_pools" | "new_pools" | "pools", limit = 20): Promise<TokenMarketData[]> {
    for (const p of this.providers) {
      if (!p.feed) continue;
      try {
        const d = await p.feed(chain, path, limit);
        if (d.length) return d;
      } catch {
        /* fall through */
      }
    }
    return [];
  }

  async trades(chain: ChainId, pool: string, minUsd = 0): Promise<TokenTrade[]> {
    for (const p of this.providers) {
      if (!p.trades) continue;
      try {
        return await p.trades(chain, pool, minUsd);
      } catch {
        /* fall through */
      }
    }
    return [];
  }
}
