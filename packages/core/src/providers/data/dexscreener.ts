import type { DataProvider } from "./DataProvider";
import type { TokenMarketData } from "../../types";
import { getChain, type ChainId } from "../../chains";

const DS_BASE = "https://api.dexscreener.com";

interface DsPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { m5?: number; h1?: number; h24?: number };
  txns?: { m5?: { buys: number; sells: number }; h1?: { buys: number; sells: number } };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

function toMarketData(chain: ChainId, p: DsPair): TokenMarketData {
  return {
    chain,
    address: p.baseToken.address,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    priceUsd: Number(p.priceUsd ?? 0),
    liquidityUsd: p.liquidity?.usd ?? 0,
    fdvUsd: p.fdv ?? null,
    marketCapUsd: p.marketCap ?? null,
    volume: { m5: p.volume?.m5 ?? 0, h1: p.volume?.h1 ?? 0, h24: p.volume?.h24 ?? 0 },
    txns: {
      m5: p.txns?.m5 ?? { buys: 0, sells: 0 },
      h1: p.txns?.h1 ?? { buys: 0, sells: 0 },
    },
    priceChange: {
      m5: p.priceChange?.m5 ?? 0,
      h1: p.priceChange?.h1 ?? 0,
      h6: p.priceChange?.h6,
      h24: p.priceChange?.h24 ?? 0,
    },
    pairAddress: p.pairAddress,
    pairCreatedAt: p.pairCreatedAt ?? null,
    dex: p.dexId,
    imageUrl: p.info?.imageUrl,
  };
}

/** Free API, ~300 req/min — must sit behind server-side cache (spec §6). */
export class DexScreenerProvider implements DataProvider {
  readonly id = "dexscreener" as const;

  async tokenMarketData(chain: ChainId, address: string): Promise<TokenMarketData | null> {
    const slug = getChain(chain).dexscreenerChain;
    const res = await fetch(`${DS_BASE}/token-pairs/v1/${slug}/${address}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`DexScreener ${res.status}`);
    const pairs = (await res.json()) as DsPair[];
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    // Most liquid pair wins
    const best = [...pairs].sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    )[0]!;
    return toMarketData(chain, best);
  }

  /** DexScreener has no trending endpoint — GeckoTerminal covers it. */
  async trendingPools(): Promise<TokenMarketData[]> {
    return [];
  }

  /**
   * Search by symbol, name, or contract address (spec Fase 3). Indexes new
   * tokens near real-time, so this finds fresh launches trending feeds miss.
   */
  async search(query: string): Promise<TokenMarketData[]> {
    const res = await fetch(`${DS_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`DexScreener search ${res.status}`);
    const body = (await res.json()) as { pairs?: DsPair[] };
    const supported: Record<string, ChainId> = {
      solana: "solana", ethereum: "ethereum", base: "base", arbitrum: "arbitrum", avalanche: "avalanche",
    };
    const seen = new Set<string>();
    const out: TokenMarketData[] = [];
    for (const p of (body.pairs ?? [])) {
      const chain = supported[p.chainId];
      if (!chain) continue;
      const key = `${chain}-${p.baseToken.address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(toMarketData(chain, p));
    }
    return out.sort((a, b) => b.liquidityUsd - a.liquidityUsd).slice(0, 30);
  }
}
