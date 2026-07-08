"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CHAINS,
  type ChainId,
  type SecurityReportV2,
  type TokenMarketData,
} from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { TokenSidePanel } from "@/components/TokenSidePanel";
import { SwapPanel } from "@/components/SwapPanel";
import { XPosts } from "@/components/XPosts";
import { SharePnl } from "@/components/SharePnl";
import { TokenAnalyst } from "@/components/TokenAnalyst";
import { WhalesPanel } from "@/components/WhalesPanel";
import { WatchButton } from "@/components/WatchButton";
import type { TradeRecord } from "@cterminal/core";

/**
 * Token screen: GeckoTerminal embed (primary chart mode, spec §4.4)
 * + fixed side panel + swap panel with "Ape with Risk Check".
 * Advanced mode (Lightweight Charts + live trades) ships in Fase 2
 * once apps/api streams trades over WebSocket.
 */
export default function TokenPage({
  params,
}: {
  params: Promise<{ chain: ChainId; address: string }>;
}) {
  const { chain, address } = use(params);
  const cfg = CHAINS[chain];

  const market = useQuery({
    queryKey: ["token", chain, address],
    queryFn: async () => {
      const r = await fetch(`/api/token?chain=${chain}&address=${address}`);
      return ((await r.json()) as { data: TokenMarketData | null }).data;
    },
    refetchInterval: 5_000, // spec §6: active token, short TTL
  });

  const security = useQuery({
    queryKey: ["security", chain, address],
    queryFn: async () => {
      const r = await fetch(`/api/security?chain=${chain}&address=${address}`);
      return ((await r.json()) as { report: SecurityReportV2 | null }).report;
    },
    staleTime: 600_000,
  });

  const pair = market.data?.pairAddress;
  const embed = pair
    ? `https://www.geckoterminal.com/${cfg.geckoTerminalNetwork}/pools/${pair}?embed=1&info=0&swaps=1&grayscale=0&light_chart=0`
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <h1 className="font-display text-xl font-semibold">{market.data?.symbol ?? "…"}</h1>
          <ChainBadge chain={chain} />
          <span className="text-[11px] text-fg-dim">{market.data?.name}</span>
          {market.data && (() => {
            const price = market.data.priceUsd;
            const h24 = market.data.priceChange.h24;
            const entry = price / (1 + h24 / 100);
            const demo: TradeRecord = {
              chain, tokenAddress: address, tokenSymbol: market.data.symbol,
              entryPriceUsd: Number(entry.toPrecision(4)), exitPriceUsd: Number(price.toPrecision(4)),
              sizeUsd: 1000, openedAt: Date.now() - 24 * 3.6e6, closedAt: Date.now(), txHash: "",
            };
            return <div className="ml-auto flex gap-2"><WatchButton chain={chain} address={address} symbol={market.data.symbol} /><SharePnl trade={demo} caption="Based on 24h token performance. Per-trade PnL with your real cost basis arrives with the trades indexer (Fase 2)." /></div>;
          })()}
        </div>
        <div className="panel panel-brackets h-[520px]">
          {embed ? (
            <iframe title="chart" src={embed} className="h-full w-full" allow="clipboard-write" />
          ) : (
            <div className="flex h-full items-center justify-center text-fg-dim">
              {market.isLoading ? "Loading chart…" : "No pool found for this token."}
            </div>
          )}
        </div>
        <div className="mt-4">
          <TokenAnalyst chain={chain} address={address} />
        </div>
      </div>
      <div className="space-y-4">
        <SwapPanel chain={chain} tokenAddress={address} market={market.data ?? null} security={security.data ?? null} />
        <TokenSidePanel market={market.data ?? null} security={security.data ?? null} />
        <WhalesPanel chain={chain} address={address} />
        <XPosts chain={chain} address={address} />
      </div>
    </div>
  );
}
