"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChainId, SecurityReportV2, TokenMarketData } from "@cterminal/core";
import { SwapPanel } from "@/components/SwapPanel";
import { ChainBadge } from "@/components/ChainBadge";

/**
 * Direct swap on the dashboard (spec Fase 2), with BUY and SELL. Pick one of
 * the current top movers and trade it inline via the full SwapPanel (same
 * risk-check + approval flow). Fetches market + security for the selection.
 */
export function QuickSwapWidget() {
  const movers = useQuery({
    queryKey: ["movers"],
    queryFn: async () => (await (await fetch("/api/movers")).json()) as { movers: TokenMarketData[] },
  });
  const list = movers.data?.movers ?? [];
  const [sel, setSel] = useState<{ chain: ChainId; address: string } | null>(null);
  const active = sel ?? (list[0] ? { chain: list[0].chain, address: list[0].address } : null);

  const market = useQuery({
    queryKey: ["token", active?.chain, active?.address],
    enabled: Boolean(active),
    queryFn: async () => ((await (await fetch(`/api/token?chain=${active!.chain}&address=${active!.address}`)).json()) as { data: TokenMarketData | null }).data,
  });
  const security = useQuery({
    queryKey: ["security", active?.chain, active?.address],
    enabled: Boolean(active),
    queryFn: async () => ((await (await fetch(`/api/security?chain=${active!.chain}&address=${active!.address}`)).json()) as { report: SecurityReportV2 | null }).report,
  });

  return (
    <div className="panel panel-brackets p-3">
      <div className="cell-label mb-2">Quick swap</div>
      <div className="mb-2 flex flex-wrap gap-1">
        {list.slice(0, 5).map((t) => (
          <button
            key={`${t.chain}-${t.address}`}
            onClick={() => setSel({ chain: t.chain, address: t.address })}
            className={`flex items-center gap-1 border px-1.5 py-0.5 text-[11px] ${active?.address === t.address ? "border-amber text-amber" : "border-line text-fg-dim"}`}
          >
            {t.symbol}
          </button>
        ))}
      </div>
      {active && (
        <div className="mb-2"><ChainBadge chain={active.chain} /></div>
      )}
      {active ? (
        <SwapPanel chain={active.chain} tokenAddress={active.address} market={market.data ?? null} security={security.data ?? null} />
      ) : (
        <p className="py-3 text-center text-xs text-fg-dim">Loading movers…</p>
      )}
    </div>
  );
}
