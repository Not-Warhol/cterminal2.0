import { NextRequest, NextResponse } from "next/server";
import type { BridgeQuoteRequest } from "@cterminal/core";
import { bridgeRouter } from "@/lib/registry";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BridgeQuoteRequest;
  if (!body.fromChain || !body.toChain || !body.fromToken || !body.toToken || !body.amountIn) {
    return NextResponse.json({ error: "invalid bridge request" }, { status: 400 });
  }
  try {
    const quote = await bridgeRouter.quote(body);
    return NextResponse.json({ quote });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
