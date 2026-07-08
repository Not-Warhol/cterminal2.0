"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TokenMarketData } from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { fmtUsd } from "@/lib/format";

/**
 * Global token search (spec Fase 3). Debounced query to /api/search
 * (DexScreener) — finds tokens by symbol, name, or contract address,
 * including fresh launches trending feeds miss. Enter or click → token page.
 */
export function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TokenMarketData[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const body = (await r.json()) as { results: TokenMarketData[] };
        setResults(body.results);
        setOpen(true);
      } catch { /* noop */ } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(t: TokenMarketData) {
    setOpen(false); setQ("");
    router.push(`/token/${t.chain}/${t.address}`);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && results[0] && go(results[0])}
        placeholder="Search token or paste address…"
        className="w-full border border-line bg-ink-950 px-3 py-1.5 text-sm outline-none focus:border-amber"
      />
      {open && (q.trim().length >= 2) && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto border border-line bg-ink-900 shadow-xl">
          {loading && <p className="px-3 py-2 text-xs text-fg-dim">Searching…</p>}
          {!loading && results.length === 0 && <p className="px-3 py-2 text-xs text-fg-dim">No tokens found.</p>}
          {results.map((t) => (
            <button key={`${t.chain}-${t.address}`} onClick={() => go(t)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-ink-800">
              <ChainBadge chain={t.chain} />
              <span className="text-amber">{t.symbol}</span>
              <span className="truncate text-fg-dim">{t.name}</span>
              <span className="ml-auto text-fg-mute">{fmtUsd(t.liquidityUsd)} liq</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
