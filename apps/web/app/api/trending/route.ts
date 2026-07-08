import { NextRequest, NextResponse } from "next/server";
import { PHASE_1_CHAINS, type ChainId } from "@cterminal/core";
import { trendingRouter } from "@/lib/registry";

export const revalidate = 30; // spec §6: list data 30s

export async function GET(req: NextRequest) {
  const chain = (req.nextUrl.searchParams.get("chain") ?? "solana") as ChainId;
  if (!PHASE_1_CHAINS.includes(chain)) {
    return NextResponse.json({ error: "chain not in Fase 1" }, { status: 400 });
  }
  const pools = await trendingRouter.trendingPools(chain, 15);
  return NextResponse.json({ pools });
}
