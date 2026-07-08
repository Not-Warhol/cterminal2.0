"use client";

import { useQuery } from "@tanstack/react-query";

/** AI daily market read (dashboard). Uses /api/market-analysis. */
export function MarketAnalysisWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["marketAnalysis"],
    queryFn: async () => (await (await fetch("/api/market-analysis")).json()) as { analysis: string; configured: boolean },
    staleTime: 900_000,
  });
  return (
    <div className="panel panel-brackets p-3">
      <div className="cell-label mb-2">Market read · today</div>
      {isLoading && <p className="py-3 text-center text-xs text-fg-dim">Reading the tape and news… (~15s)</p>}
      {error && <p className="text-xs text-down">Analysis unavailable.</p>}
      {data && (
        <div className="space-y-1 text-xs leading-relaxed text-fg-mute">
          {data.analysis.split("\n").filter(Boolean).map((line, i) => {
            const clean = line.replace(/\*\*(.+?)\*\*/g, "$1");
            const header = /^-?\s*\*\*|Tone|Rotations|Watch/.test(line);
            return <p key={i} className={header ? "text-fg" : ""}>{clean}</p>;
          })}
        </div>
      )}
    </div>
  );
}
