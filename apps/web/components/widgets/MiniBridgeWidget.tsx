"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PHASE_1_CHAINS, type BridgeQuote, type ChainId } from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { fmtUsd } from "@/lib/format";

const NATIVE: Record<ChainId, string> = {
  solana: "So11111111111111111111111111111111111111112",
  ethereum: "0x0000000000000000000000000000000000000000",
  base: "0x0000000000000000000000000000000000000000",
  arbitrum: "0x0000000000000000000000000000000000000000",
  avalanche: "0x0000000000000000000000000000000000000000",
};

/** Compact bridge quote on the dashboard; execute in the full Bridge tab. */
export function MiniBridgeWidget() {
  const [from, setFrom] = useState<ChainId>("base");
  const [to, setTo] = useState<ChainId>("arbitrum");
  const [amount, setAmount] = useState("0.05");
  const q = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/bridge-quote", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromChain: from, toChain: to, fromToken: NATIVE[from], toToken: NATIVE[to], amountIn: BigInt(Math.round(Number(amount) * 1e18)).toString(), slippageBps: 50 }),
      });
      const b = (await r.json()) as { quote?: BridgeQuote; error?: string };
      if (!r.ok || !b.quote) throw new Error(b.error ?? "No route");
      return b.quote;
    },
  });
  return (
    <div className="panel panel-brackets p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="cell-label">Bridge</span>
        <Link href="/bridge" className="text-[10px] text-amber hover:underline">Full bridge →</Link>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <select value={from} onChange={(e) => setFrom(e.target.value as ChainId)} className="border border-line bg-ink-950 px-1 py-1">
          {PHASE_1_CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-fg-dim">→</span>
        <select value={to} onChange={(e) => setTo(e.target.value as ChainId)} className="border border-line bg-ink-950 px-1 py-1">
          {PHASE_1_CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-16 border border-line bg-ink-950 px-1 py-1" />
      </div>
      <button onClick={() => q.mutate()} disabled={q.isPending} className="btn-amber mt-2 w-full py-1.5 text-xs">
        {q.isPending ? "…" : "Get route"}
      </button>
      {q.data && (
        <p className="mt-2 text-[11px] text-fg-mute">
          via {q.data.tool} · fees {fmtUsd(q.data.feesUsd, false)} · ~{q.data.estimatedSeconds < 90 ? `${q.data.estimatedSeconds}s` : `${Math.round(q.data.estimatedSeconds / 60)}min`}
        </p>
      )}
      {q.error && <p className="mt-1 text-[11px] text-down">{(q.error as Error).message}</p>}
    </div>
  );
}
