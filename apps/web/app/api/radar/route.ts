import { NextResponse } from "next/server";
import { computeHeat, PHASE_1_CHAINS, type SecuritySeverity, type TokenMarketData } from "@cterminal/core";
import { dataRouter, securityRouter } from "@/lib/registry";

export const revalidate = 25; // fresh enough to catch launches, kind to rate limits
export const maxDuration = 30;

export interface RadarRow extends TokenMarketData {
  heat: number;
  /** batched security verdict: ok | warn | danger | null (unscreened) */
  screen: SecuritySeverity | null;
  screenScore: number | null;
}

/**
 * Launch Radar (the edge feature). New pools across every chain, ranked by
 * Heat Score, with automatic security screening on the hottest rows — the
 * 30 seconds a trader spends checking a honeypot by hand is exactly the
 * window this removes. Screening is batched and capped to respect
 * GoPlus/RugCheck free-tier limits; unscreened rows say so honestly.
 */
export async function GET() {
  const perChain = await Promise.all(
    PHASE_1_CHAINS.map(async (chain) => {
      try { return await dataRouter.feed(chain, "new_pools", 15); } catch { return [] as TokenMarketData[]; }
    }),
  );
  const rows: RadarRow[] = perChain.flat().map((t) => ({ ...t, heat: computeHeat(t), screen: null, screenScore: null }));
  rows.sort((a, b) => b.heat - a.heat);

  // Screen the top 10 hottest (per request, cached 25s) — batch, tolerate failures.
  const top = rows.slice(0, 10);
  await Promise.all(
    top.map(async (r) => {
      try {
        const rep = await securityRouter.report(r.chain, r.address);
        if (rep) {
          r.screenScore = rep.score;
          r.screen = rep.findings.some((f) => f.severity === "danger") || rep.score < 30
            ? "danger" : rep.score < 60 ? "warn" : "ok";
        }
      } catch { /* stays null = unscreened */ }
    }),
  );

  return NextResponse.json({ rows: rows.slice(0, 40), screenedTop: 10 });
}
