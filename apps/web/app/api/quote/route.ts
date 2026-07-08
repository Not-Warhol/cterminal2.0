import { NextRequest, NextResponse } from "next/server";
import type { SwapQuoteRequest } from "@cterminal/core";
import { swapRouter } from "@/lib/registry";

/** Quotes are never cached — always live. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as SwapQuoteRequest;
  if (!body.chain || !body.inputToken || !body.outputToken || !body.amountIn) {
    return NextResponse.json({ error: "invalid quote request" }, { status: 400 });
  }
  try {
    const quote = await swapRouter.quote(body);
    return NextResponse.json({ quote });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
