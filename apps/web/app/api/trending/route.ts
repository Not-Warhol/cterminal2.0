import { NextRequest, NextResponse } from "next/server";
import { PHASE_1_CHAINS, type ChainId } from "@cterminal/core";
import { dataRouter, trendingRouter } from "@/lib/registry";

export const revalidate = 30; // spec §6: list data 30s

export async function GET(req: NextRequest) {
  const chain = (req.nextUrl.searchParams.get("chain") ?? "solana") as ChainId;
  const feed = (req.nextUrl.searchParams.get("feed") ?? "trending") as "trending" | "new" | "top";
  if (!PHASE_1_CHAINS.includes(chain)) {
    return NextResponse.json({ error: "chain not in Fase 1" }, { status: 400 });
  }
  const pathMap = { trending: "trending_pools", new: "new_pools", top: "pools" } as const;
  const pools = feed === "trending"
    ? await trendingRouter.trendingPools(chain, 30)
    : await dataRouter.feed(chain, pathMap[feed], 30);
  return NextResponse.json({ pools });
}
