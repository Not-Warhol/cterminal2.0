"use client";

import { useState } from "react";
import { computePnl, formatHold, type TradeRecord } from "@cterminal/core";
import { fmtUsd } from "@/lib/format";

/**
 * Share PnL button + preview (spec Fase 2 §1.4). Builds the /pnl image URL
 * from a TradeRecord, previews it, and offers copy-link + share-to-X.
 * Non-custodial and stateless: the card is just a URL with query params.
 */
export function SharePnl({ trade, caption }: { trade: TradeRecord; caption?: string }) {
  const [open, setOpen] = useState(false);
  const pnl = computePnl(trade);

  const url =
    `/pnl?chain=${trade.chain}&symbol=${encodeURIComponent(trade.tokenSymbol)}` +
    `&entry=${trade.entryPriceUsd}&exit=${trade.exitPriceUsd}&size=${trade.sizeUsd}` +
    `&opened=${trade.openedAt}&closed=${trade.closedAt}&tx=${trade.txHash}`;
  const fullUrl = typeof window !== "undefined" ? window.location.origin + url : url;

  const tweet =
    `https://twitter.com/intent/tweet?text=` +
    encodeURIComponent(
      `${pnl.isProfit ? "+" : ""}${pnl.pnlPct.toFixed(1)}% on $${trade.tokenSymbol} — traded on CTerminal`,
    ) +
    `&url=${encodeURIComponent(fullUrl)}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border border-line px-2 py-1 text-[11px] uppercase tracking-wider text-fg-mute hover:border-amber hover:text-amber"
      >
        Share PnL
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4" role="dialog" aria-modal="true">
          <div className="panel panel-brackets w-full max-w-lg p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display font-semibold">
                {pnl.isProfit ? "+" : ""}
                {pnl.pnlPct.toFixed(1)}% · ${trade.tokenSymbol}
              </h2>
              <span className="text-xs text-fg-dim">{formatHold(pnl.holdMs)} hold · {fmtUsd(pnl.pnlUsd, false)}</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="PnL card" className="w-full border border-line" />
            {caption && <p className="mt-2 text-[10px] text-fg-dim">{caption}</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => navigator.clipboard?.writeText(fullUrl)}
                className="flex-1 border border-line py-2 text-sm text-fg-mute hover:text-fg"
              >
                Copy link
              </button>
              <a href={tweet} target="_blank" rel="noreferrer" className="btn-amber flex-1 py-2 text-center text-sm">
                Share on X
              </a>
            </div>
            <button onClick={() => setOpen(false)} className="mt-2 w-full text-xs text-fg-dim hover:text-fg">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
