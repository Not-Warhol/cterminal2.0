import type { DataProvider } from "./DataProvider";
import type { TokenMarketData } from "../../types";
import { getChain, type ChainId } from "../../chains";

const GT_BASE = "https://api.geckoterminal.com/api/v2";

interface GtPool {
  id: string;
  attributes: {
    name: string;
    address: string;
    base_token_price_usd: string;
    fdv_usd: string | null;
    market_cap_usd: string | null;
    reserve_in_usd: string;
    pool_created_at: string | null;
    volume_usd: { m5: string; h1: string; h24: string };
    price_change_percentage: { m5: string; h1: string; h24: string };
    transactions: {
      m5: { buys: number; sells: number };
      h1: { buys: number; sells: number };
    };
  };
  relationships: {
    base_token: { data: { id: string } };
    dex: { data: { id: string } };
  };
}

function toMarketData(chain: ChainId, pool: GtPool): TokenMarketData {
  const a = pool.attributes;
  const [symbol] = a.name.split(" / ");
  const tokenAddress = pool.relationships.base_token.data.id.split("_").pop() ?? "";
  return {
    chain,
    address: tokenAddress,
    symbol: symbol ?? a.name,
    name: a.name,
    priceUsd: Number(a.base_token_price_usd),
    liquidityUsd: Number(a.reserve_in_usd),
    fdvUsd: a.fdv_usd ? Number(a.fdv_usd) : null,
    marketCapUsd: a.market_cap_usd ? Number(a.market_cap_usd) : null,
    volume: {
      m5: Number(a.volume_usd.m5),
      h1: Number(a.volume_usd.h1),
      h24: Number(a.volume_usd.h24),
    },
    txns: { m5: a.transactions.m5, h1: a.transactions.h1 },
    priceChange: {
      m5: Number(a.price_change_percentage.m5),
      h1: Number(a.price_change_percentage.h1),
      h24: Number(a.price_change_percentage.h24),
    },
    pairAddress: a.address,
    pairCreatedAt: a.pool_created_at ? Date.parse(a.pool_created_at) : null,
    dex: pool.relationships.dex.data.id,
  };
}

/** Free API, 30 req/min — cache aggressively (spec §6). */
export class GeckoTerminalProvider implements DataProvider {
  readonly id = "geckoterminal" as const;

  async tokenMarketData(chain: ChainId, address: string): Promise<TokenMarketData | null> {
    const net = getChain(chain).geckoTerminalNetwork;
    const res = await fetch(`${GT_BASE}/networks/${net}/tokens/${address}/pools?page=1`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const body = (await res.json()) as { data: GtPool[] };
    const pool = body.data?.[0];
    return pool ? toMarketData(chain, pool) : null;
  }

  async trendingPools(chain: ChainId, limit = 10): Promise<TokenMarketData[]> {
    const net = getChain(chain).geckoTerminalNetwork;
    const res = await fetch(`${GT_BASE}/networks/${net}/trending_pools?page=1`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
    const body = (await res.json()) as { data: GtPool[] };
    return (body.data ?? []).slice(0, limit).map((p) => toMarketData(chain, p));
  }
}
