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

  const prompt = `You are the senior market strategist inside a multi-chain crypto trading terminal used by fast decentralized traders. Produce a DETAILED daily market read (400–500 words) for a trader starting their session now.

Cross-chain trending 24h movers on the terminal right now: ${gainers.join("; ")}.

Use web search for TODAY's context: BTC/ETH/SOL price action and key levels, funding/liquidations if notable, macro events (Fed, CPI, ETF flows), and any major crypto news of the last 24h. Then write these sections:
- **Tone** — risk-on / risk-off / mixed, with the one datapoint that justifies it.
- **Majors** — BTC, ETH, SOL: direction, the level that matters today for each.
- **Rotations** — where flow is going across chains and narratives (memes, AI, RWA, new chains), grounded in the movers above + search.
- **Narratives heating** — 2–3 specific narratives/tickers gaining attention, with why.
- **Watch today** — 2–3 concrete events/levels/situations that could move the session.
- **Risks** — what could invalidate the read.
Separate facts (searched) from interpretation. Never invent numbers. End with "Not financial advice."`;

  try {
    const text = await analystComplete(prompt, { maxTokens: 1600 });
    return NextResponse.json({ analysis: text, configured: true });
  } catch (e) {
    return NextResponse.json({ analysis: `Top 24h movers: ${gainers.join(", ")}.`, configured: true, error: (e as Error).message });
  }
}
