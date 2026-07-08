import type { SecurityProvider } from "./SecurityProvider";
import type { OnChainSignals, SecurityFinding, SecurityReportV2 } from "../../types";
import { getChain, isEvm, type ChainId } from "../../chains";

const GP_BASE = "https://api.gopluslabs.io/api/v1";

interface GpHolder { percent?: string; is_locked?: number; is_contract?: number; tag?: string }
interface GpToken {
  is_honeypot?: string;
  is_mintable?: string;
  is_proxy?: string;
  is_open_source?: string;
  owner_change_balance?: string;
  hidden_owner?: string;
  buy_tax?: string;
  sell_tax?: string;
  cannot_sell_all?: string;
  is_blacklisted?: string;
  lp_holder_count?: string;
  holder_count?: string;
  creator_percent?: string;
  holders?: GpHolder[];
  lp_holders?: GpHolder[];
}

const CHECKS: { key: keyof GpToken; label: string; severity: "warn" | "danger" }[] = [
  { key: "is_honeypot", label: "Honeypot", severity: "danger" },
  { key: "cannot_sell_all", label: "Cannot sell all", severity: "danger" },
  { key: "owner_change_balance", label: "Owner can edit balances", severity: "danger" },
  { key: "hidden_owner", label: "Hidden owner", severity: "danger" },
  { key: "is_blacklisted", label: "Blacklist function", severity: "warn" },
  { key: "is_mintable", label: "Mintable", severity: "warn" },
  { key: "is_proxy", label: "Proxy contract", severity: "warn" },
];

export class GoPlusProvider implements SecurityProvider {
  readonly id = "goplus" as const;

  supports(chain: ChainId): boolean {
    return isEvm(chain);
  }

  async report(chain: ChainId, address: string): Promise<SecurityReportV2> {
    const evmId = getChain(chain).evmChainId;
    const res = await fetch(
      `${GP_BASE}/token_security/${evmId}?contract_addresses=${address.toLowerCase()}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`GoPlus ${res.status}`);
    const body = (await res.json()) as { result?: Record<string, GpToken> };
    const t = body.result?.[address.toLowerCase()];
    if (!t) throw new Error("GoPlus: token not found");

    const findings: SecurityFinding[] = [];
    for (const c of CHECKS) {
      if (t[c.key] === "1") findings.push({ label: c.label, severity: c.severity });
    }
    if (t.is_open_source === "0")
      findings.push({ label: "Contract not verified", severity: "warn" });
    const buyTax = Number(t.buy_tax ?? 0) * 100;
    const sellTax = Number(t.sell_tax ?? 0) * 100;
    if (sellTax > 10)
      findings.push({ label: `Sell tax ${sellTax.toFixed(0)}%`, severity: "danger" });
    else if (sellTax > 3 || buyTax > 3)
      findings.push({ label: `Tax buy ${buyTax.toFixed(0)}% / sell ${sellTax.toFixed(0)}%`, severity: "warn" });

    // ── on-chain signals (Fase 2) ──
    const holders = t.holders ?? [];
    const topHolder = holders.find((h) => !h.is_contract && h.tag !== "burn");
    const top10Pct =
      holders.slice(0, 10).reduce((a, h) => a + Number(h.percent ?? 0), 0) * 100 || null;
    const lpLocked =
      (t.lp_holders ?? []).some((h) => h.is_locked === 1 || h.tag === "burn") || null;
    const signals: OnChainSignals = {
      holderCount: t.holder_count ? Number(t.holder_count) : null,
      topHolderPct: topHolder?.percent ? Number(topHolder.percent) * 100 : null,
      top10Pct,
      creatorPct: t.creator_percent ? Number(t.creator_percent) * 100 : null,
      lpLocked,
      lpHolderCount: t.lp_holder_count ? Number(t.lp_holder_count) : null,
      ageHours: null, // filled from market data at the call site
    };
    // signal-driven findings
    if (signals.topHolderPct !== null && signals.topHolderPct > 20)
      findings.push({ label: `Top holder owns ${signals.topHolderPct.toFixed(0)}%`, severity: "danger" });
    if (signals.creatorPct !== null && signals.creatorPct > 5)
      findings.push({ label: `Creator holds ${signals.creatorPct.toFixed(0)}%`, severity: "warn" });
    if (signals.lpLocked === false)
      findings.push({ label: "Liquidity not locked/burned", severity: "warn" });

    const dangers = findings.filter((f) => f.severity === "danger").length;
    const warns = findings.filter((f) => f.severity === "warn").length;
    const score = Math.max(0, 100 - dangers * 40 - warns * 10);
    return { chain, address, score, findings, source: ["goplus"], signals };
  }
}
