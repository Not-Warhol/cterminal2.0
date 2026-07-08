"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { TokenMarketData } from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { fmtPct, fmtUsd } from "@/lib/format";

type MoversData = { movers: TokenMarketData[]; gainers: TokenMarketData[]; losers: TokenMarketData[] };

function Row({ t }: { t: TokenMarketData }) {
  return (
    <Link href={`/token/${t.chain}/${t.address}`} className="flex items-center gap-2 py-1 hover:bg-ink-800">
      <ChainBadge chain={t.chain} />
      <span className="text-amber">{t.symbol}</span>
      <span className="ml-auto text-fg-dim">{fmtUsd(t.priceUsd, false)}</span>
      <span className={`w-16 text-right ${t.priceChange.h1 >= 0 ? "text-up" : "text-down"}`}>{fmtPct(t.priceChange.h1)}</span>
    </Link>
  );
}

/** Top 5 movers in the last hour, across all chains (dashboard). */
export function MoversWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["movers"],
    queryFn: async () => (await (await fetch("/api/movers")).json()) as MoversData,
    refetchInterval: 30_000,
  });
  return (
    <div className="panel panel-brackets p-3">
      <div className="cell-label mb-2">Top movers · 1h</div>
      {isLoading ? <p className="py-3 text-center text-xs text-fg-dim">Loading…</p> : (
        <div className="text-xs">{data?.movers.map((t) => <Row key={`${t.chain}-${t.pairAddress}`} t={t} />)}</div>
      )}
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
          {isLoading ? <p className="text-xs text-fg-dim">…</p> : <div className="text-xs">{data?.gainers.map((t) => <Row key={t.pairAddress} t={t} />)}</div>}
        </div>
        <div>
          <div className="cell-label mb-2 text-down">Losers 1h</div>
          {isLoading ? <p className="text-xs text-fg-dim">…</p> : <div className="text-xs">{data?.losers.map((t) => <Row key={t.pairAddress} t={t} />)}</div>}
        </div>
      </div>
    </div>
  );
}
