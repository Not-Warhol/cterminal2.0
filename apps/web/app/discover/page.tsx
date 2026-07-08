"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PHASE_1_CHAINS, type ChainId, type TokenMarketData } from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { fmtAge, fmtPct, fmtUsd } from "@/lib/format";

/** Discover — trending pools per chain (GeckoTerminal via /api/trending). */
export default function DiscoverPage() {
  const [chain, setChain] = useState<ChainId>("solana");
  const { data, isLoading, error } = useQuery({
    queryKey: ["trending", chain],
    queryFn: async () => {
      const r = await fetch(`/api/trending?chain=${chain}`);
      if (!r.ok) throw new Error("Trending fetch failed");
      return (await r.json()) as { pools: TokenMarketData[] };
    },
    refetchInterval: 30_000,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="font-display mr-3 text-xl font-semibold">Trending</h1>
        {PHASE_1_CHAINS.map((c) => (
          <button key={c} onClick={() => setChain(c)} className={chain === c ? "" : "opacity-50 hover:opacity-90"}>
            <ChainBadge chain={c} active={chain === c} />
          </button>
        ))}
      </div>

      <div className="panel panel-brackets overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="cell-label border-b border-line">
              {["Token", "Price", "5m", "1h", "24h", "Vol 1h", "Liquidity", "FDV", "Age", "B/S 1h"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-fg-dim">Loading {chain} pools…</td></tr>
            )}
            {error && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-down">Data providers unreachable. Retrying automatically.</td></tr>
            )}
            {data?.pools.map((p) => (
              <tr key={p.pairAddress} className="border-b border-line/50 hover:bg-ink-800">
                <td className="px-3 py-2">
                  <Link href={`/token/${p.chain}/${p.address}`} className="text-amber hover:underline">
                    {p.symbol}
                  </Link>
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
                <td className="px-3 py-2">
                  <span className="text-up">{p.txns.h1.buys}</span>
                  <span className="text-fg-dim">/</span>
                  <span className="text-down">{p.txns.h1.sells}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-fg-dim">
        Data: GeckoTerminal + DexScreener, server-cached. Not financial advice.
      </p>
    </div>
  );
}
