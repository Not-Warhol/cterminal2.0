"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SocialFilter, SocialPost } from "@cterminal/core";
import { short } from "@/lib/format";

/**
 * Alpha section (spec Fase 2) — a real destination: search any ticker and
 * see the most influential X posts about it, filterable by KOLs. Smart Money
 * needs the wallet-indexer (Fase 2 backend) so it shows an honest note.
 */
const TABS: { id: SocialFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "kol", label: "KOLs" },
  { id: "smart_money", label: "Smart Money" },
];

export default function AlphaPage() {
  const [ticker, setTicker] = useState("ANSEM");
  const [query, setQuery] = useState("ANSEM");
  const [filter, setFilter] = useState<SocialFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["alpha", query, filter],
    enabled: Boolean(query),
    staleTime: 300_000,
    queryFn: async () =>
      (await (await fetch(`/api/social?symbol=${encodeURIComponent(query)}&filter=${filter}`)).json()) as {
        posts: SocialPost[]; configured: boolean; error?: string;
      },
  });

  return (
    <div>
      <h1 className="font-display mb-3 text-xl font-semibold">Alpha</h1>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center border border-line bg-ink-950">
          <span className="pl-2 text-fg-dim">$</span>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && setQuery(ticker)}
            placeholder="TICKER"
            className="w-32 bg-transparent px-1 py-1.5 text-sm outline-none"
          />
        </div>
        <button onClick={() => setQuery(ticker)} className="btn-amber px-3 py-1.5 text-sm">Search</button>
        <div className="ml-2 flex gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setFilter(t.id)}
              className={`border px-2 py-1 text-[11px] uppercase ${filter === t.id ? "border-amber text-amber" : "border-line text-fg-dim"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!isLoading && data && !data.configured && (
        <div className="panel p-8 text-center text-sm text-fg-mute">
          Connect the X API (X_BEARER_TOKEN) to enable Alpha search.
        </div>
      )}
      {filter === "smart_money" && data?.configured && (
        <p className="mb-3 text-[11px] text-fg-dim">
          Smart Money verification needs the wallet-indexer (Fase 2 backend). Showing nothing rather than mislabelling KOLs.
        </p>
      )}
      {isLoading && <p className="py-8 text-center text-sm text-fg-dim">Searching X for ${query}…</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data?.posts.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="panel p-3 hover:border-amber">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-fg">{p.author.name} <span className="text-fg-dim">@{p.author.handle}</span></span>
              <span className="text-[10px] text-fg-dim">{(p.author.followers / 1000).toFixed(0)}k followers</span>
            </div>
            <p className="text-sm text-fg-mute">{p.text}</p>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-fg-dim">
              <span>♥ {p.metrics.likes.toLocaleString()}</span>
              <span>↻ {p.metrics.reposts.toLocaleString()}</span>
              <span>👁 {p.metrics.views.toLocaleString()}</span>
              <span className="ml-auto border border-line px-1 uppercase">{p.mapping.confidence === "none" ? "unverified" : p.mapping.confidence}</span>
            </div>
          </a>
        ))}
      </div>
      {!isLoading && data?.configured && data.posts.length === 0 && filter !== "smart_money" && (
        <p className="py-8 text-center text-sm text-fg-dim">No recent posts found for ${query}.</p>
      )}
    </div>
  );
}
