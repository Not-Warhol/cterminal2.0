import { NextResponse } from "next/server";
import { PHASE_1_CHAINS, type TokenMarketData } from "@cterminal/core";
import { trendingRouter } from "@/lib/registry";

export const revalidate = 30;

/**
 * Top movers across chains (spec Fase 2 dashboard). Pulls trending pools
 * from every Fase 1 chain, then ranks by 1h price change magnitude so the
 * dashboard can show "what moved most in the last hour" everywhere at once.
 */
export async function GET() {
  const results = await Promise.all(
    PHASE_1_CHAINS.map(async (chain) => {
      try {
        return await trendingRouter.trendingPools(chain, 12);
      } catch {
        return [] as TokenMarketData[];
      }
    }),
  );
  const all = results.flat().filter((t) => t.liquidityUsd > 5000);
  const byMove = [...all].sort((a, b) => Math.abs(b.priceChange.h1) - Math.abs(a.priceChange.h1));
  const gainers = [...all].sort((a, b) => b.priceChange.h1 - a.priceChange.h1).slice(0, 5);
  const losers = [...all].sort((a, b) => a.priceChange.h1 - b.priceChange.h1).slice(0, 5);
  return NextResponse.json({ movers: byMove.slice(0, 5), gainers, losers });
}
