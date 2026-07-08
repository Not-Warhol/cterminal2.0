"use client";

import { useQuery } from "@tanstack/react-query";
import type { SocialPost, TokenMarketData } from "@cterminal/core";

/**
 * Important tweets (dashboard). Shows top X posts for the current #1 mover's
 * ticker — a pragmatic "what's being talked about right now" until a
 * dedicated trending-tickers feed exists. Honest empty state if X unconfigured.
 */
export function TweetsWidget() {
  const movers = useQuery({
    queryKey: ["movers"],
    queryFn: async () => (await (await fetch("/api/movers")).json()) as { movers: TokenMarketData[] },
  });
  const top = movers.data?.movers[0];
  const tweets = useQuery({
    queryKey: ["dashTweets", top?.chain, top?.address],
    enabled: Boolean(top),
    staleTime: 300_000,
    queryFn: async () => (await (await fetch(`/api/social?chain=${top!.chain}&address=${top!.address}&filter=all`)).json()) as { posts: SocialPost[]; configured: boolean },
  });
  return (
    <div className="panel panel-brackets p-3">
      <div className="cell-label mb-2">Important tweets {top && <span className="text-fg-dim">· ${top.symbol}</span>}</div>
      {!tweets.data?.configured && !tweets.isLoading && (
        <p className="py-3 text-center text-xs text-fg-dim">Connect the X API to surface tweets here.</p>
      )}
      {tweets.isLoading && <p className="py-3 text-center text-xs text-fg-dim">Loading…</p>}
      <ul className="space-y-2">
        {tweets.data?.posts.slice(0, 4).map((p) => (
          <li key={p.id} className="border-b border-line/50 pb-1 text-xs">
            <span className="text-fg">@{p.author.handle}</span>
            <span className="ml-1 text-[10px] text-fg-dim">{(p.author.followers / 1000).toFixed(0)}k</span>
            <p className="text-fg-mute">{p.text.slice(0, 140)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
