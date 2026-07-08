"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import type { ChainId, TokenMarketData } from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { fmtPct, fmtUsd } from "@/lib/format";

interface WatchItem { chain: ChainId; address: string; symbol: string; above: number | null; below: number | null; }
const KEY = "cterm.watchlist";

/**
 * Watchlist + price alerts (spec Fase 3, from the GOON mockup). Tokens are
 * saved in the browser (localStorage) with live prices and optional
 * above/below alerts, evaluated while the app is open. Add tokens from any
 * token page via the "Watch" button.
 */
export default function WatchlistPage() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [fired, setFired] = useState<string[]>([]);

  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* noop */ } }, []);
  function persist(next: WatchItem[]) { setItems(next); localStorage.setItem(KEY, JSON.stringify(next)); }

  const prices = useQueries({
    queries: items.map((it) => ({
      queryKey: ["token", it.chain, it.address],
      queryFn: async () => ((await (await fetch(`/api/token?chain=${it.chain}&address=${it.address}`)).json()) as { data: TokenMarketData | null }).data,
      refetchInterval: 15_000,
    })),
  });

  // Evaluate alerts client-side
  useEffect(() => {
    const hits: string[] = [];
    items.forEach((it, i) => {
      const p = prices[i]?.data?.priceUsd;
      if (p == null) return;
      if (it.above && p >= it.above) hits.push(`${it.symbol} ↑ ${fmtUsd(it.above, false)}`);
      if (it.below && p <= it.below) hits.push(`${it.symbol} ↓ ${fmtUsd(it.below, false)}`);
    });
    if (hits.length) setFired(hits);
  }, [prices, items]);

  function update(i: number, patch: Partial<WatchItem>) {
    persist(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  return (
    <div>
      <h1 className="font-display mb-3 text-xl font-semibold">Watchlist</h1>
      {fired.length > 0 && (
        <div className="panel mb-3 border-amber p-2 text-xs text-amber">
          Alerts: {fired.join(" · ")}
          <button onClick={() => setFired([])} className="ml-2 text-fg-dim">clear</button>
        </div>
      )}
      {items.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-fg-mute">
          Watchlist empty. Open any token and click <span className="text-amber">Watch</span> to add it here.
        </div>
      ) : (
        <div className="panel panel-brackets overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead><tr className="cell-label border-b border-line">
              {["Token", "Chain", "Price", "1h", "24h", "Alert ↑", "Alert ↓", ""].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}
            </tr></thead>
            <tbody>
              {items.map((it, i) => {
                const m = prices[i]?.data;
                return (
                  <tr key={`${it.chain}-${it.address}`} className="border-b border-line/50">
                    <td className="px-3 py-2"><Link href={`/token/${it.chain}/${it.address}`} className="text-amber hover:underline">{it.symbol}</Link></td>
                    <td className="px-3 py-2"><ChainBadge chain={it.chain} /></td>
                    <td className="px-3 py-2">{fmtUsd(m?.priceUsd, false)}</td>
                    <td className={`px-3 py-2 ${(m?.priceChange.h1 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{m ? fmtPct(m.priceChange.h1) : "—"}</td>
                    <td className={`px-3 py-2 ${(m?.priceChange.h24 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{m ? fmtPct(m.priceChange.h24) : "—"}</td>
                    <td className="px-3 py-2"><input defaultValue={it.above ?? ""} onBlur={(e) => update(i, { above: Number(e.target.value) || null })} placeholder="$" className="w-20 border border-line bg-ink-950 px-1 py-0.5" /></td>
                    <td className="px-3 py-2"><input defaultValue={it.below ?? ""} onBlur={(e) => update(i, { below: Number(e.target.value) || null })} placeholder="$" className="w-20 border border-line bg-ink-950 px-1 py-0.5" /></td>
                    <td className="px-3 py-2 text-right"><button onClick={() => persist(items.filter((_, idx) => idx !== i))} className="text-down">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-fg-dim">Saved in your browser. Alerts evaluated while the app is open; server push arrives with the Fase 2 backend.</p>
    </div>
  );
}
