import { NextRequest, NextResponse } from "next/server";
import { dataRouter } from "@/lib/registry";

export const revalidate = 10;

/** Token search by symbol, name, or contract address (spec Fase 3). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  const results = await dataRouter.search(q);
  return NextResponse.json({ results });
}
