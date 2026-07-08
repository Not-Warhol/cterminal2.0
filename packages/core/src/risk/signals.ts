import type { TokenMarketData } from "../types";

/**
 * Heat Score — the Radar's edge metric (0–100). Pure and testable.
 *
 * Combines, from ONLY public market data (no paid feeds):
 *  - velocity: 5m volume annualized against liquidity (turnover intensity)
 *  - buy pressure: buys/(buys+sells) over 1h, weighted by tx count
 *  - acceleration: 5m price change vs 1h trend (is it speeding up?)
 *  - freshness: new pairs get a decaying bonus (the early-catch window)
 *  - liquidity floor: sub-$5k pools are capped (untradeable ≠ hot)
 *
 * This is a ranking signal, not a buy signal — the UI always pairs it with
 * the security screen so "hot" and "safe" are never conflated.
 */
export function computeHeat(t: TokenMarketData): number {
  let score = 0;

  // velocity: 5m vol relative to pool size (0–35)
  if (t.liquidityUsd > 0) {
    const turnover = t.volume.m5 / t.liquidityUsd; // e.g. 0.1 = 10% of pool traded in 5m
    score += Math.min(35, turnover * 350);
  }

  // buy pressure (0–25), weighted so 3 buys/1 sell ≠ 300 buys/100 sells
  const txs = t.txns.h1.buys + t.txns.h1.sells;
  if (txs > 0) {
    const ratio = t.txns.h1.buys / txs;
    const weight = Math.min(1, txs / 50);
    score += Math.max(0, (ratio - 0.5) * 2) * 25 * weight;
  }

  // acceleration: 5m move vs the hourly pace (0–25)
  const pace5m = t.priceChange.m5;
  const hourlyPace = t.priceChange.h1 / 12; // per-5m equivalent
  if (pace5m > 0 && pace5m > hourlyPace) {
    score += Math.min(25, (pace5m - Math.max(0, hourlyPace)) * 2.5);
  }

  // freshness bonus: decays over 24h (0–15)
  if (t.pairCreatedAt) {
    const ageH = (Date.now() - t.pairCreatedAt) / 3.6e6;
    if (ageH < 24) score += 15 * (1 - ageH / 24);
  }

  // liquidity floor: cap the score for barely-tradeable pools
  if (t.liquidityUsd < 5_000) score = Math.min(score, 30);

  return Math.round(Math.min(100, score));
}
