"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CHAINS, type ChainId, type TokenTrade } from "@cterminal/core";
import { fmtUsd, short } from "@/lib/format";

/** Whales — recent large trades on this token (spec Fase 3). */
export function WhalesPanel({ chain, address }: { chain: ChainId; address: string }) {
  const [minUsd, setMinUsd] = useState(1000);
  const { data, isLoading } = useQuery({
    queryKey: ["whales", chain, address, minUsd],
    queryFn: async () => (await (await fetch(`/api/whales?chain=${chain}&address=${address}&minUsd=${minUsd}`)).json()) as { trades: TokenTrade[] },
    refetchInterval: 15_000,
  });
  const explorer = CHAINS[chain].explorer;

  return (
    <div className="panel panel-brackets p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="cell-label">Whales · large trades</span>
        <select value={minUsd} onChange={(e) => setMinUsd(Number(e.target.value))}
          className="border border-line bg-ink-950 px-1 py-0.5 text-[11px]">
          <option value={500}>≥ $500</option><option value={1000}>≥ $1k</option><option value={5000}>≥ $5k</option><option value={25000}>≥ $25k</option>
        </select>
      </div>
      {isLoading && <p className="py-3 text-center text-xs text-fg-dim">Loading trades…</p>}
      {!isLoading && (data?.trades.length ?? 0) === 0 && <p className="py-3 text-center text-xs text-fg-dim">No trades above this size recently.</p>}
      <div className="max-h-72 overflow-y-auto text-xs">
        {data?.trades.map((t, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-line/40 py-1">
            <span className={`w-9 uppercase ${t.kind === "buy" ? "text-up" : "text-down"}`}>{t.kind}</span>
            <span className="text-fg">{fmtUsd(t.volumeUsd, false)}</span>
            <a href={`${explorer}/address/${t.wallet}`} target="_blank" rel="noreferrer" className="ml-auto text-fg-dim hover:text-amber">{short(t.wallet)}</a>
            <span className="w-12 text-right text-fg-dim">{Math.round((Date.now() - t.timestamp) / 60000)}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}
