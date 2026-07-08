import { NextRequest, NextResponse } from "next/server";
import { getChain, type ChainId } from "@cterminal/core";
import { dataRouter, securityRouter, socialProvider } from "@/lib/registry";
import { analystComplete, analystProvider } from "@/lib/llm";

export const maxDuration = 60;

/**
 * AI Token Analyst (spec Fase 2 request). Assembles a factual context pack
 * — market data, on-chain security signals, and real OHLCV candles — then
 * asks Claude (with web search enabled) to research recent news + social
 * chatter and produce a structured, honest analysis.
 *
 * Needs ANTHROPIC_API_KEY. Model overridable via ANALYST_MODEL.
 * The LLM is told explicitly: this is not financial advice, flag risks,
 * never invent numbers, and separate on-chain facts from opinion.
 */
async function fetchOhlcv(chain: ChainId, pool: string): Promise<string> {
  try {
    const net = getChain(chain).geckoTerminalNetwork;
    const r = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${net}/pools/${pool}/ohlcv/hour?aggregate=1&limit=48`,
      { headers: { accept: "application/json" } },
    );
    if (!r.ok) return "unavailable";
    const b = (await r.json()) as { data?: { attributes?: { ohlcv_list?: number[][] } } };
    const list = b.data?.attributes?.ohlcv_list ?? [];
    if (!list.length) return "unavailable";
    // compact: first, min, max, last close over the window
    const closes = list.map((c) => c[4]!);
    const first = closes[closes.length - 1]!;
    const last = closes[0]!;
    const hi = Math.max(...closes);
    const lo = Math.min(...closes);
    return `48h candles — open ${first}, close ${last}, high ${hi}, low ${lo}, change ${(((last - first) / first) * 100).toFixed(1)}%`;
  } catch {
    return "unavailable";
  }
}

export async function POST(req: NextRequest) {
  if (!analystProvider()) {
    return NextResponse.json({ error: "AI Analyst not configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY)." }, { status: 501 });
  }
  const { chain, address, mode = "full" } = (await req.json()) as { chain: ChainId; address: string; mode?: "full" | "x" | "news" };
  if (!chain || !address) return NextResponse.json({ error: "chain and address required" }, { status: 400 });

  const [market, security] = await Promise.all([
    dataRouter.tokenMarketData(chain, address),
    securityRouter.report(chain, address),
  ]);
  if (!market) return NextResponse.json({ error: "No market data for this token." }, { status: 404 });
  const ohlcv = await fetchOhlcv(chain, market.pairAddress);

  // Pull the most influential X posts to ground the "narrative" section.
  let topPosts: { author: string; followers: number; text: string; likes: number }[] = [];
  if (socialProvider.isConfigured()) {
    try {
      const posts = await socialProvider.posts({ chain, tokenAddress: address, symbol: market.symbol, filter: "all" });
      topPosts = posts.slice(0, 5).map((p) => ({
        author: `@${p.author.handle}`, followers: p.author.followers, text: p.text, likes: p.metrics.likes,
      }));
    } catch { /* non-fatal — analyst still runs on market/chart data */ }
  }

  const context = {
    token: `${market.symbol} (${market.name})`,
    chain: getChain(chain).name,
    contract: address,
    priceUsd: market.priceUsd,
    liquidityUsd: market.liquidityUsd,
    fdvUsd: market.fdvUsd,
    volume: market.volume,
    priceChange: market.priceChange,
    buysSells1h: market.txns.h1,
    ageHours: market.pairCreatedAt ? ((Date.now() - market.pairCreatedAt) / 3.6e6).toFixed(0) : "unknown",
    security: security ? { score: security.score, signals: security.signals, findings: security.findings.map((f) => f.label) } : null,
    chart: ohlcv,
    topXPosts: topPosts,
  };

  const base = `Token: ${context.token} on ${context.chain}. Contract: ${address}.\nOn-chain + market facts (do not contradict): ${JSON.stringify(context)}`;

  const prompts: Record<"full" | "x" | "news", string> = {
    full: `You are a crypto token analyst inside a trading terminal. Use web search for recent news + notable X/Twitter discussion (search $${market.symbol} and the contract).\n${base}\n\nProduce, in under 400 words: 1) **Snapshot** verdict; 2) **Price action** from the 48h candles + flow; 3) **On-chain health** (holders, liquidity, LP, age, red flags); 4) **News & narrative** combining the X posts above with your search (quote max one short phrase per post); 5) **Risks**; 6) **Bottom line**. Separate FACTS from OPINION, never invent numbers. End with "Not financial advice."`,
    x: `You are a crypto social analyst. Use web search to find the most relevant RECENT X/Twitter discussion about $${market.symbol} (${address}). ${base}\n\nSummarize in under 250 words: who is talking about it (KOLs vs random), the prevailing sentiment (bullish/bearish/mixed), and any notable claims or warnings. Combine with the top X posts provided. Quote max one short phrase per source. End with "Not financial advice."`,
    news: `You are a crypto news analyst. Use web search for news from the LAST 24 HOURS about $${market.symbol} (${address}) and any directly relevant market context. ${base}\n\nIn under 250 words: list the concrete news items with sources, then one line on why each matters for the token. If nothing credible in 24h, say so plainly. End with "Not financial advice."`,
  };
  const prompt = prompts[mode];

  try {
    const text = await analystComplete(prompt, { maxTokens: 1500 });
    return NextResponse.json({ analysis: text, context });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
