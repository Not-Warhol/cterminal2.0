import { NextRequest, NextResponse } from "next/server";
import type { ChainId, SocialFilter } from "@cterminal/core";
import { dataRouter, socialProvider } from "@/lib/registry";

export const revalidate = 300; // spec §4.7: cache hard, X API is expensive

export async function GET(req: NextRequest) {
  const chain = (req.nextUrl.searchParams.get("chain") ?? "solana") as ChainId;
  const address = req.nextUrl.searchParams.get("address") ?? "";
  const symbolParam = req.nextUrl.searchParams.get("symbol");
  const filter = (req.nextUrl.searchParams.get("filter") ?? "all") as SocialFilter;

  // Safe token fingerprint (never the token itself) so we can tell, from the
  // browser, whether the deployed env var is actually reaching the app.
  const rawTok = process.env.X_BEARER_TOKEN ?? "";
  const tokenInfo = {
    present: rawTok.length > 0,
    length: rawTok.length,
    prefix: rawTok.slice(0, 4),
    startsWithAAAA: rawTok.startsWith("AAAA"),
    hasPercent: rawTok.includes("%"),
    hasSpace: /\s/.test(rawTok),
    hasQuotes: /["']/.test(rawTok),
  };
  if (req.nextUrl.searchParams.get("debug") === "1") {
    return NextResponse.json({ tokenInfo, configured: socialProvider.isConfigured() });
  }

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
    return NextResponse.json({ posts, configured: true, mode: socialProvider.lastMode });
  } catch (e) {
    return NextResponse.json({ posts: [], configured: true, error: (e as Error).message, tokenInfo }, { status: 502 });
  }
}
