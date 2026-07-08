import { NextRequest, NextResponse } from "next/server";
import type { BridgeStatusRequest } from "@cterminal/core";
import { bridgeRouter } from "@/lib/registry";

/** Live bridge status — never cached, always fresh (spec Fase 2 §1.2). */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as BridgeStatusRequest;
  if (!body.txHash || !body.tool) {
    return NextResponse.json({ error: "txHash and tool required" }, { status: 400 });
  }
  try {
    const status = await bridgeRouter.status(body);
    return NextResponse.json({ status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
