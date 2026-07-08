import { NextRequest, NextResponse } from "next/server";
import { PHASE_1_CHAINS, type TokenMarketData } from "@cterminal/core";
import { trendingRouter } from "@/lib/registry";

export const revalidate = 30;

/**
 * Top movers across chains (spec Fase 2 dashboard). Pulls trending pools
 * from every Fase 1 chain, then ranks by 1h price change magnitude so the
 * dashboard can show "what moved most in the last hour" everywhere at once.
 */
type Window = "m5" | "m15" | "m30" | "h1" | "h6" | "h24";

function change(t: TokenMarketData, w: Window): number {
  const v = t.priceChange[w];
  return v ?? t.priceChange.h1; // honest fallback when a provider lacks the window
}

export async function GET(req: NextRequest) {
  const w = (req.nextUrl.searchParams.get("window") ?? "h1") as Window;
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
  const byMove = [...all].sort((a, b) => Math.abs(change(b, w)) - Math.abs(change(a, w)));
  const gainers = [...all].sort((a, b) => change(b, w) - change(a, w)).slice(0, 5);
  const losers = [...all].sort((a, b) => change(a, w) - change(b, w)).slice(0, 5);
  return NextResponse.json({ movers: byMove.slice(0, 5), gainers, losers, window: w });
}
