import { NextRequest, NextResponse } from "next/server";
import type { ChainId } from "@cterminal/core";
import { dataRouter } from "@/lib/registry";

export const revalidate = 5; // active token on screen: short TTL (spec §6)

export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get("chain") as ChainId | null;
  const address = req.nextUrl.searchParams.get("address");
  if (!chain || !address) {
    return NextResponse.json({ error: "chain and address required" }, { status: 400 });
  }
  const data = await dataRouter.tokenMarketData(chain, address);
  return NextResponse.json({ data });
}
