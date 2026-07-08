"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChainId, SocialFilter, SocialPost } from "@cterminal/core";
import { fmtUsd, short } from "@/lib/format";

const FILTERS: { id: SocialFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "kol", label: "KOLs" },
  { id: "smart_money", label: "Smart Money" },
];

const CONFIDENCE_STYLE = {
  verified: "text-up border-up",
  declared: "text-amber border-amber",
  none: "text-fg-dim border-line",
} as const;

/**
 * Alpha / X Posts (spec Fase 2 §1.5). Renders relevant X posts for a token
 * with a filter and, crucially, an HONEST confidence badge on any
 * handle→wallet mapping. When the X API isn't configured, shows a clear
 * empty state rather than fabricated engagement (master spec §4.7).
 */
export function XPosts({ chain, address }: { chain: ChainId; address: string }) {
  const [filter, setFilter] = useState<SocialFilter>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["social", chain, address, filter],
    queryFn: async () => {
      const r = await fetch(`/api/social?chain=${chain}&address=${address}&filter=${filter}`);
      return (await r.json()) as { posts: SocialPost[]; configured: boolean; error?: string; mode?: "cashtag" | "keyword" };
    },
    staleTime: 300_000,
  });

  return (
    <div className="panel panel-brackets p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="cell-label">Alpha · X Posts</span>
        <div className="flex items-center gap-2">
          {data?.mode && (
            <span className="text-[9px] uppercase tracking-widest text-fg-dim" title={data.mode === "cashtag" ? "Searching by $cashtag" : "Cashtag not available on this API tier — searching by keyword"}>
              {data.mode === "cashtag" ? "$cashtag" : "keyword"}
            </span>
          )}
          <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`border px-1.5 py-0.5 text-[10px] uppercase ${filter === f.id ? "border-amber text-amber" : "border-line text-fg-dim"}`}
            >
              {f.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {isLoading && <p className="py-4 text-center text-xs text-fg-dim">Loading posts…</p>}

      {!isLoading && data && !data.configured && (
        <p className="py-4 text-center text-xs text-fg-dim">
          X feed not connected. Add an X API key to surface relevant posts and on-chain-verified callers here.
        </p>
      )}

      {!isLoading && data?.error && (
        <p className="py-4 text-center text-xs text-down">X API error: {data.error.slice(0, 160)}</p>
      )}
      {!isLoading && data?.configured && !data.error && data.posts.length === 0 && (
        <p className="py-4 text-center text-xs text-fg-dim">No relevant posts found for this token.</p>
      )}

      <ul className="space-y-2">
        {data?.posts.map((post) => (
          <li key={post.id} className="border border-line p-2 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-fg">
                {post.author.name} <span className="text-fg-dim">@{post.author.handle}</span>
              </span>
              <span className={`border px-1 text-[9px] uppercase ${CONFIDENCE_STYLE[post.mapping.confidence]}`}>
                {post.mapping.confidence === "verified" ? "on-chain ✓" : post.mapping.confidence === "declared" ? "declared" : "unverified"}
              </span>
            </div>
            <p className="text-fg-mute">{post.text}</p>
            <div className="mt-1 flex items-center gap-3 text-[10px] text-fg-dim">
              <span>♥ {post.metrics.likes.toLocaleString()}</span>
              <span>↻ {post.metrics.reposts.toLocaleString()}</span>
              {post.mapping.confidence === "verified" && post.mapping.tokenPnlUsd !== null && (
                <span className={post.mapping.tokenPnlUsd >= 0 ? "text-up" : "text-down"}>
                  PnL {fmtUsd(post.mapping.tokenPnlUsd, false)}
                </span>
              )}
              {post.mapping.wallet && <span>{short(post.mapping.wallet)}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
