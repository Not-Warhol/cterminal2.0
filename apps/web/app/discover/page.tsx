"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PHASE_1_CHAINS, type ChainId, type TokenMarketData } from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { fmtAge, fmtPct, fmtUsd } from "@/lib/format";

type Feed = "trending" | "new" | "top";
const FEEDS: { id: Feed; label: string }[] = [
  { id: "trending", label: "Trending" },
  { id: "new", label: "New pairs" },
  { id: "top", label: "Top by liquidity" },
];

/** Discover (spec Fase 3): more tokens, multiple feeds, and real filters. */
export default function DiscoverPage() {
  const [chain, setChain] = useState<ChainId>("solana");
  const [feed, setFeed] = useState<Feed>("trending");
  const [minVol, setMinVol] = useState(0); // $ 1h volume
  const [maxAgeH, setMaxAgeH] = useState(0); // 0 = any
  const [minBuyRatio, setMinBuyRatio] = useState(0); // buys/(buys+sells) %

  const { data, isLoading, error } = useQuery({
    queryKey: ["discover", chain, feed],
    queryFn: async () => {
      const r = await fetch(`/api/trending?chain=${chain}&feed=${feed}`);
      if (!r.ok) throw new Error("Fetch failed");
      return (await r.json()) as { pools: TokenMarketData[] };
    },
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => {
    let list = data?.pools ?? [];
    if (minVol > 0) list = list.filter((p) => p.volume.h1 >= minVol);
    if (maxAgeH > 0) list = list.filter((p) => p.pairCreatedAt && (Date.now() - p.pairCreatedAt) / 3.6e6 <= maxAgeH);
    if (minBuyRatio > 0) list = list.filter((p) => {
      const tot = p.txns.h1.buys + p.txns.h1.sells;
      return tot > 0 && (p.txns.h1.buys / tot) * 100 >= minBuyRatio;
    });
    return list;
  }, [data, minVol, maxAgeH, minBuyRatio]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display mr-2 text-xl font-semibold">Discover</h1>
        {PHASE_1_CHAINS.map((c) => (
          <button key={c} onClick={() => setChain(c)} className={chain === c ? "" : "opacity-50 hover:opacity-90"}>
            <ChainBadge chain={c} active={chain === c} />
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="flex gap-1">
          {FEEDS.map((f) => (
            <button key={f.id} onClick={() => setFeed(f.id)}
              className={`border px-2 py-1 text-[11px] uppercase ${feed === f.id ? "border-amber text-amber" : "border-line text-fg-dim"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-fg-mute">
          <label className="flex items-center gap-1">
            Min vol 1h
            <select value={minVol} onChange={(e) => setMinVol(Number(e.target.value))} className="border border-line bg-ink-950 px-1 py-0.5">
              <option value={0}>any</option><option value={1000}>$1k</option><option value={10000}>$10k</option><option value={50000}>$50k</option><option value={250000}>$250k</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Max age
            <select value={maxAgeH} onChange={(e) => setMaxAgeH(Number(e.target.value))} className="border border-line bg-ink-950 px-1 py-0.5">
              <option value={0}>any</option><option value={1}>1h</option><option value={6}>6h</option><option value={24}>24h</option><option value={168}>7d</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Min buy %
            <select value={minBuyRatio} onChange={(e) => setMinBuyRatio(Number(e.target.value))} className="border border-line bg-ink-950 px-1 py-0.5">
              <option value={0}>any</option><option value={50}>50%</option><option value={60}>60%</option><option value={70}>70%</option>
            </select>
          </label>
        </div>
      </div>

      <div className="panel panel-brackets overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="cell-label border-b border-line">
              {["Token", "Price", "5m", "1h", "24h", "Vol 1h", "Liquidity", "FDV", "Age", "B/S 1h"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="px-3 py-8 text-center text-fg-dim">Loading {chain} {feed}…</td></tr>}
            {error && <tr><td colSpan={10} className="px-3 py-8 text-center text-down">Data providers unreachable.</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-fg-dim">No tokens match your filters.</td></tr>}
            {rows.map((p) => (
              <tr key={p.pairAddress} className="border-b border-line/50 hover:bg-ink-800">
                <td className="px-3 py-2">
                  <Link href={`/token/${p.chain}/${p.address}`} className="text-amber hover:underline">{p.symbol}</Link>
                  <span className="ml-2 text-[11px] text-fg-dim">{p.dex}</span>
                </td>
                <td className="px-3 py-2">{fmtUsd(p.priceUsd, false)}</td>
                {([p.priceChange.m5, p.priceChange.h1, p.priceChange.h24] as const).map((v, i) => (
                  <td key={i} className={`px-3 py-2 ${v >= 0 ? "text-up" : "text-down"}`}>{fmtPct(v)}</td>
                ))}
                <td className="px-3 py-2">{fmtUsd(p.volume.h1)}</td>
                <td className="px-3 py-2">{fmtUsd(p.liquidityUsd)}</td>
                <td className="px-3 py-2">{fmtUsd(p.fdvUsd)}</td>
                <td className="px-3 py-2">{fmtAge(p.pairCreatedAt)}</td>
                <td className="px-3 py-2"><span className="text-up">{p.txns.h1.buys}</span><span className="text-fg-dim">/</span><span className="text-down">{p.txns.h1.sells}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-fg-dim">
        Feeds via GeckoTerminal · search any token (incl. fresh launches) with the bar up top. Not financial advice.
      </p>
    </div>
  );
}
