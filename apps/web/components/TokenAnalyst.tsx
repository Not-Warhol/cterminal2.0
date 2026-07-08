"use client";

import { useMutation } from "@tanstack/react-query";
import type { ChainId } from "@cterminal/core";

/**
 * AI Token Analyst panel (spec Fase 2 request). On demand, calls /api/analyst
 * which researches news + reads on-chain/market/chart data and returns a
 * structured analysis. Rendered as light markdown-ish text.
 */
export function TokenAnalyst({ chain, address }: { chain: ChainId; address: string }) {
  const run = useMutation({
    mutationFn: async (mode: "full" | "x" | "news") => {
      const r = await fetch("/api/analyst", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chain, address, mode }),
      });
      const body = (await r.json()) as { analysis?: string; error?: string };
      if (!r.ok || !body.analysis) throw new Error(body.error ?? "Analysis failed");
      return body.analysis;
    },
  });

  return (
    <div className="panel panel-brackets p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="cell-label">AI Analyst</span>
        <div className="flex gap-1">
          <button onClick={() => run.mutate("full")} disabled={run.isPending}
            className="btn-amber px-2 py-1 text-[10px] uppercase tracking-wider">Full</button>
          <button onClick={() => run.mutate("x")} disabled={run.isPending}
            className="border border-line px-2 py-1 text-[10px] uppercase tracking-wider text-fg-mute hover:border-amber hover:text-amber">X scan</button>
          <button onClick={() => run.mutate("news")} disabled={run.isPending}
            className="border border-line px-2 py-1 text-[10px] uppercase tracking-wider text-fg-mute hover:border-amber hover:text-amber">News 24h</button>
        </div>
      </div>

      {run.isPending && (
        <p className="py-4 text-center text-xs text-fg-dim">
          Reading chart, on-chain data, and searching news… (~15s)
        </p>
      )}
      {run.error && <p className="text-xs text-down">{(run.error as Error).message}</p>}
      {run.data && (
        <div className="space-y-1 text-xs leading-relaxed text-fg-mute">
          {run.data.split("\n").filter(Boolean).map((line, i) => {
            const bold = line.replace(/\*\*(.+?)\*\*/g, "‹$1›");
            const isHeader = /^\d+\.|^#{1,3}\s|‹.+›/.test(bold);
            return (
              <p key={i} className={isHeader ? "mt-2 text-fg" : ""}>
                {bold.replace(/‹(.+?)›/g, "$1")}
              </p>
            );
          })}
        </div>
      )}
      {!run.data && !run.isPending && !run.error && (
        <p className="py-3 text-center text-[11px] text-fg-dim">
          Get a research-backed read on this token: price action, on-chain health, news, and risks.
        </p>
      )}
    </div>
  );
}
