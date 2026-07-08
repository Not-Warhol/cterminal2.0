"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ChainId, SecuritySeverity, TokenMarketData } from "@cterminal/core";
import { PHASE_1_CHAINS } from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { fmtAge, fmtPct, fmtUsd } from "@/lib/format";

interface RadarRow extends TokenMarketData { heat: number; screen: SecuritySeverity | null; screenScore: number | null; }

const SCREEN_BADGE: Record<string, { label: string; cls: string }> = {
  ok: { label: "clean", cls: "border-up text-up" },
  warn: { label: "caution", cls: "border-amber text-amber" },
  danger: { label: "danger", cls: "border-down text-down" },
  null: { label: "unscreened", cls: "border-line text-fg-dim" },
};

/**
 * Launch Radar — new pairs across all chains, auto-refreshing every 20s,
 * ranked by Heat Score, with automatic honeypot/security screening inline.
 * The tool for catching launches earlier WITH the safety check built in.
 */
export default function RadarPage() {
  const [chainFilter, setChainFilter] = useState<ChainId | "all">("all");
  const [safeOnly, setSafeOnly] = useState(false);
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["radar"],
    queryFn: async () => (await (await fetch("/api/radar")).json()) as { rows: RadarRow[] },
    refetchInterval: 20_000,
  });

  let rows = data?.rows ?? [];
  if (chainFilter !== "all") rows = rows.filter((r) => r.chain === chainFilter);
  if (safeOnly) rows = rows.filter((r) => r.screen === "ok" || r.screen === "warn");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display mr-2 text-xl font-semibold">Radar</h1>
        <span className="text-[10px] uppercase tracking-widest text-fg-dim">
          live · updated {Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => setChainFilter("all")} className={`border px-2 py-0.5 text-[11px] uppercase ${chainFilter === "all" ? "border-amber text-amber" : "border-line text-fg-dim"}`}>All chains</button>
          {PHASE_1_CHAINS.map((c) => (
            <button key={c} onClick={() => setChainFilter(c)} className={chainFilter === c ? "" : "opacity-50 hover:opacity-90"}>
              <ChainBadge chain={c} active={chainFilter === c} />
            </button>
          ))}
          <label className="flex items-center gap-1 text-[11px] text-fg-mute">
            <input type="checkbox" checked={safeOnly} onChange={(e) => setSafeOnly(e.target.checked)} />
            hide danger/unscreened
          </label>
        </div>
      </div>

      <div className="panel panel-brackets overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="cell-label border-b border-line">
              {["Heat", "Token", "Screen", "Age", "Price", "5m", "Vol 5m", "Liquidity", "B/S 1h", ""].map((h) => (
                <th key={h} className="px-3 py-2 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="px-3 py-8 text-center text-fg-dim">Scanning new pools across chains…</td></tr>}
            {rows.map((r) => {
              const badge = SCREEN_BADGE[String(r.screen)] ?? SCREEN_BADGE["null"]!;
              return (
                <tr key={`${r.chain}-${r.pairAddress}`} className="border-b border-line/50 hover:bg-ink-800">
                  <td className="px-3 py-2">
                    <span className={`font-semibold ${r.heat >= 60 ? "text-amber" : r.heat >= 35 ? "text-fg" : "text-fg-dim"}`}>{r.heat}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/token/${r.chain}/${r.address}`} className="text-amber hover:underline">{r.symbol}</Link>
                    <span className="ml-2"><ChainBadge chain={r.chain} /></span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`border px-1.5 py-0.5 text-[10px] uppercase ${badge.cls}`}>
                      {badge.label}{r.screenScore !== null ? ` ${r.screenScore}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2">{fmtAge(r.pairCreatedAt)}</td>
                  <td className="px-3 py-2">{fmtUsd(r.priceUsd, false)}</td>
                  <td className={`px-3 py-2 ${r.priceChange.m5 >= 0 ? "text-up" : "text-down"}`}>{fmtPct(r.priceChange.m5)}</td>
                  <td className="px-3 py-2">{fmtUsd(r.volume.m5)}</td>
                  <td className="px-3 py-2">{fmtUsd(r.liquidityUsd)}</td>
                  <td className="px-3 py-2"><span className="text-up">{r.txns.h1.buys}</span><span className="text-fg-dim">/</span><span className="text-down">{r.txns.h1.sells}</span></td>
                  <td className="px-3 py-2">
                    <Link href={`/token/${r.chain}/${r.address}`} className="btn-amber px-2 py-1 text-[11px] uppercase">Ape →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-fg-dim">
        Heat = turnover + buy pressure + acceleration + freshness. Top 10 auto-screened (GoPlus/RugCheck);
        "unscreened" means not checked yet — treat as unknown, not safe. Not financial advice.
      </p>
    </div>
  );
}
