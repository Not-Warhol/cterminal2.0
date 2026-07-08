"use client";

import type { SecurityReportV2, TokenMarketData } from "@cterminal/core";
import { StatCell } from "@/components/StatCell";
import { fmtAge, fmtPct, fmtUsd } from "@/lib/format";

/** Fixed DexScreener-style data rail (spec §4.4). */
export function TokenSidePanel({
  market,
  security,
}: {
  market: TokenMarketData | null;
  security: SecurityReportV2 | null;
}) {
  if (!market) return <div className="panel p-4 text-sm text-fg-dim">Loading market data…</div>;
  const bs = market.txns.h1;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <StatCell label="Price" value={fmtUsd(market.priceUsd, false)} />
        <StatCell label="Liquidity" value={fmtUsd(market.liquidityUsd)} />
        <StatCell label="Vol 5m" value={fmtUsd(market.volume.m5)} />
        <StatCell label="Vol 1h" value={fmtUsd(market.volume.h1)} />
        <StatCell
          label="Buys/Sells 1h"
          value={<span><span className="text-up">{bs.buys}</span> / <span className="text-down">{bs.sells}</span></span>}
        />
        <StatCell label="Age" value={fmtAge(market.pairCreatedAt)} />
        <StatCell label="FDV" value={fmtUsd(market.fdvUsd)} />
        <StatCell label="MCap" value={fmtUsd(market.marketCapUsd)} />
        <StatCell label="24h" value={fmtPct(market.priceChange.h24)} tone={market.priceChange.h24 >= 0 ? "up" : "down"} />
        <StatCell
          label="Security"
          value={security ? `${security.score}/100` : "unavailable"}
          tone={security && security.score >= 60 ? "up" : security && security.score >= 30 ? "amber" : "down"}
        />
      </div>
      {security && security.findings.length > 0 && (
        <div className="panel p-3">
          <div className="cell-label mb-2">Security findings</div>
          <ul className="space-y-1 text-xs">
            {security.findings.slice(0, 6).map((f, i) => (
              <li key={i} className={f.severity === "danger" ? "text-down" : f.severity === "warn" ? "text-amber" : "text-fg-mute"}>
                ▸ {f.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-fg-dim">Heuristic scores — never a guarantee of safety.</p>
        </div>
      )}
    </div>
  );
}
