"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { TokenMarketData } from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { fmtPct, fmtUsd } from "@/lib/format";

type MoversData = { movers: TokenMarketData[]; gainers: TokenMarketData[]; losers: TokenMarketData[] };
type Window = "m5" | "m15" | "m30" | "h1" | "h6" | "h24";
const WINDOWS: { id: Window; label: string }[] = [
  { id: "m5", label: "5m" }, { id: "m15", label: "15m" }, { id: "m30", label: "30m" },
  { id: "h1", label: "1h" }, { id: "h6", label: "6h" }, { id: "h24", label: "24h" },
];
function pct(t: TokenMarketData, w: Window): number { return t.priceChange[w] ?? t.priceChange.h1; }

function Row({ t, w }: { t: TokenMarketData; w: Window }) {
  const v = pct(t, w);
  return (
    <Link href={`/token/${t.chain}/${t.address}`} className="flex items-center gap-2 py-1 hover:bg-ink-800">
      <ChainBadge chain={t.chain} />
      <span className="text-amber">{t.symbol}</span>
      <span className="ml-auto text-fg-dim">{fmtUsd(t.priceUsd, false)}</span>
      <span className={`w-16 text-right ${v >= 0 ? "text-up" : "text-down"}`}>{fmtPct(v)}</span>
    </Link>
  );
}

/** Top 5 movers in the last hour, across all chains (dashboard). */
export function MoversWidget() {
  const [w, setW] = useState<Window>("h1");
  const { data, isLoading } = useQuery({
    queryKey: ["movers", w],
    queryFn: async () => (await (await fetch(`/api/movers?window=${w}`)).json()) as MoversData,
    refetchInterval: 30_000,
  });
  return (
    <div className="panel panel-brackets p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="cell-label">Top movers</span>
        <div className="flex gap-0.5">
          {WINDOWS.map((x) => (
            <button key={x.id} onClick={() => setW(x.id)}
              className={`px-1.5 py-0.5 text-[10px] ${w === x.id ? "bg-amber-soft text-amber" : "text-fg-dim hover:text-fg"}`}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? <p className="py-3 text-center text-xs text-fg-dim">Loading…</p> : (
        <div className="text-xs">{data?.movers.map((t) => <Row key={`${t.chain}-${t.pairAddress}`} t={t} w={w} />)}</div>
      )}
      <p className="mt-1 text-[9px] text-fg-dim">15m/30m/6h depend on provider coverage; fall back to 1h when missing.</p>
    </div>
  );
}

/** Split gainers / losers panel (dashboard). */
export function GainersLosersWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["movers"],
    queryFn: async () => (await (await fetch("/api/movers")).json()) as MoversData,
    refetchInterval: 30_000,
  });
  return (
    <div className="panel panel-brackets p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="cell-label mb-2 text-up">Gainers 1h</div>
          {isLoading ? <p className="text-xs text-fg-dim">…</p> : <div className="text-xs">{data?.gainers.map((t) => <Row key={t.pairAddress} t={t} w="h1" />)}</div>}
        </div>
        <div>
          <div className="cell-label mb-2 text-down">Losers 1h</div>
          {isLoading ? <p className="text-xs text-fg-dim">…</p> : <div className="text-xs">{data?.losers.map((t) => <Row key={t.pairAddress} t={t} w="h1" />)}</div>}
        </div>
      </div>
    </div>
  );
}
