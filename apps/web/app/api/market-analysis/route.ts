import { NextResponse } from "next/server";
import { PHASE_1_CHAINS, type TokenMarketData } from "@cterminal/core";
import { trendingRouter } from "@/lib/registry";
import { analystComplete, analystProvider } from "@/lib/llm";

export const maxDuration = 60;
export const revalidate = 900; // daily-ish read, cache 15 min

/**
 * Daily market analysis (spec Fase 2 dashboard). Gathers cross-chain movers
 * and asks Claude (with web search) for a general market read: sentiment,
 * rotations, notable narratives, macro/crypto news of the day. Needs
 * ANTHROPIC_API_KEY; degrades to a data-only summary if absent.
 */
export async function GET() {
  const results = await Promise.all(
    PHASE_1_CHAINS.map(async (chain) => {
      try { return await trendingRouter.trendingPools(chain, 8); } catch { return [] as TokenMarketData[]; }
    }),
  );
  const all = results.flat();
  const gainers = [...all].sort((a, b) => b.priceChange.h24 - a.priceChange.h24).slice(0, 8)
    .map((t) => `${t.symbol} ${t.priceChange.h24.toFixed(0)}% ($${Math.round(t.liquidityUsd / 1000)}k liq)`);

  if (!analystProvider()) {
    return NextResponse.json({
      analysis: `Data-only summary (set GEMINI_API_KEY or ANTHROPIC_API_KEY for the full AI read).\nTop 24h movers across chains: ${gainers.join(", ")}.`,
      configured: false,
    });
  }

  const prompt = `You are the market strategist for a multi-chain crypto trading terminal. Give a SHORT daily market read (under 200 words) for a trader starting their session today.

Cross-chain trending 24h movers right now: ${gainers.join("; ")}.

Use web search for today's crypto market context (BTC/ETH/SOL direction, notable news, risk sentiment). Then give:
- **Tone** — risk-on / risk-off / mixed, one line.
- **Rotations** — where flow is going (chains, narratives).
- **Watch** — 2–3 things that matter today.
End with "Not financial advice."`;

  try {
    const text = await analystComplete(prompt, { maxTokens: 900 });
    return NextResponse.json({ analysis: text, configured: true });
  } catch (e) {
    return NextResponse.json({ analysis: `Top 24h movers: ${gainers.join(", ")}.`, configured: true, error: (e as Error).message });
  }
}
