import { NextRequest, NextResponse } from "next/server";
import type { ChainId, SocialFilter } from "@cterminal/core";
import { dataRouter, socialProvider } from "@/lib/registry";

export const revalidate = 300; // spec §4.7: cache hard, X API is expensive

export async function GET(req: NextRequest) {
  const chain = (req.nextUrl.searchParams.get("chain") ?? "solana") as ChainId;
  const address = req.nextUrl.searchParams.get("address") ?? "";
  const symbolParam = req.nextUrl.searchParams.get("symbol");
  const filter = (req.nextUrl.searchParams.get("filter") ?? "all") as SocialFilter;

  if (!socialProvider.isConfigured()) {
    return NextResponse.json({ posts: [], configured: false });
  }
  // Ticker search (Alpha page) passes ?symbol=. Token page passes chain+address.
  let symbol = symbolParam ?? "";
  if (!symbol && address) {
    const market = await dataRouter.tokenMarketData(chain, address);
    symbol = market?.symbol ?? address.slice(0, 6);
  }
  if (!symbol) return NextResponse.json({ error: "symbol or address required" }, { status: 400 });
  try {
    const posts = await socialProvider.posts({ chain, tokenAddress: address, symbol, filter });
    return NextResponse.json({ posts, configured: true });
  } catch (e) {
    return NextResponse.json({ posts: [], configured: true, error: (e as Error).message }, { status: 502 });
  }
}
