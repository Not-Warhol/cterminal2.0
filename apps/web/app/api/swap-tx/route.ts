import { NextRequest, NextResponse } from "next/server";
import type { SwapQuoteRequest } from "@cterminal/core";
import { swapRouter } from "@/lib/registry";

/** Builds the EVM swap tx server-side — the 1inch key never reaches the browser. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as SwapQuoteRequest & { taker: string };
  if (!body.chain || !body.taker) {
    return NextResponse.json({ error: "invalid swap-tx request" }, { status: 400 });
  }
  try {
    const tx = await swapRouter.buildTx(body);
    return NextResponse.json({ tx });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
