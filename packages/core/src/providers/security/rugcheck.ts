import type { SecurityProvider } from "./SecurityProvider";
import type { OnChainSignals, SecurityFinding, SecurityReportV2 } from "../../types";
import type { ChainId } from "../../chains";

const RC_BASE = "https://api.rugcheck.xyz/v1";

interface RcSummary {
  score: number; // RugCheck: higher = riskier
  risks?: { name: string; level: string; description?: string }[];
  topHolders?: { pct?: number }[];
  totalHolders?: number;
  markets?: { lp?: { lpLockedPct?: number } }[];
  creatorTokens?: unknown;
}

export class RugCheckProvider implements SecurityProvider {
  readonly id = "rugcheck" as const;

  supports(chain: ChainId): boolean {
    return chain === "solana";
  }

  async report(chain: ChainId, address: string): Promise<SecurityReportV2> {
    const res = await fetch(`${RC_BASE}/tokens/${address}/report/summary`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`RugCheck ${res.status}`);
    const s = (await res.json()) as RcSummary;
    const findings: SecurityFinding[] = (s.risks ?? []).map((r) => ({
      label: r.name,
      severity: r.level === "danger" ? "danger" : r.level === "warn" ? "warn" : "ok",
      detail: r.description,
    }));
    const top = s.topHolders ?? [];
    const lpLockedPct = s.markets?.[0]?.lp?.lpLockedPct ?? null;
    const signals: OnChainSignals = {
      holderCount: s.totalHolders ?? null,
      topHolderPct: top[0]?.pct ?? null,
      top10Pct: top.slice(0, 10).reduce((a, h) => a + (h.pct ?? 0), 0) || null,
      creatorPct: null,
      lpLocked: lpLockedPct === null ? null : lpLockedPct > 90,
      lpHolderCount: null,
      ageHours: null,
    };
    if (signals.topHolderPct !== null && signals.topHolderPct > 20)
      findings.push({ label: `Top holder owns ${signals.topHolderPct.toFixed(0)}%`, severity: "danger" });
    // Normalize: RugCheck raw score grows with risk; clamp into 0–100 safety score.
    const safety = Math.max(0, Math.min(100, Math.round(100 - s.score / 100)));
    return { chain, address, score: safety, findings, source: ["rugcheck"], signals };
  }
}
