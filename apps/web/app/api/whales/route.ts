import { NextRequest, NextResponse } from "next/server";
import type { ChainId } from "@cterminal/core";
import { dataRouter } from "@/lib/registry";

export const revalidate = 15;

/** Recent large trades (whales) on a token's main pool (spec Fase 3). */
export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get("chain") as ChainId | null;
  const address = req.nextUrl.searchParams.get("address");
  const minUsd = Number(req.nextUrl.searchParams.get("minUsd") ?? 1000);
  if (!chain || !address) return NextResponse.json({ error: "chain and address required" }, { status: 400 });
  const market = await dataRouter.tokenMarketData(chain, address);
  if (!market) return NextResponse.json({ trades: [] });
  const trades = await dataRouter.trades(chain, market.pairAddress, minUsd);
  return NextResponse.json({ trades: trades.slice(0, 40) });
}
