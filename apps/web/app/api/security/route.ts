import { NextRequest, NextResponse } from "next/server";
import type { ChainId } from "@cterminal/core";
import { securityRouter } from "@/lib/registry";

export const revalidate = 600; // security score: 10 min (spec §6)

export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get("chain") as ChainId | null;
  const address = req.nextUrl.searchParams.get("address");
  if (!chain || !address) {
    return NextResponse.json({ error: "chain and address required" }, { status: 400 });
  }
  const report = await securityRouter.report(chain, address);
  return NextResponse.json({ report });
}
