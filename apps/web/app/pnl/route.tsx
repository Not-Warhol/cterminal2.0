import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { computePnl, formatHold, getChain, type ChainId, type TradeRecord } from "@cterminal/core";

export const runtime = "edge";

/**
 * Share PnL card (spec Fase 2 §1.4). Renders a 1200×630 image from trade
 * params in the query string, so it can be shared as a link that unfurls
 * on X (OpenGraph) or copied directly. PnL math comes from core.computePnl
 * — single source of truth with the app.
 *
 * /pnl?chain=base&symbol=DEGEN&entry=0.01&exit=0.023&size=500&opened=..&closed=..&tx=0x..
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const chain = (p.get("chain") ?? "base") as ChainId;
  const trade: TradeRecord = {
    chain,
    tokenAddress: "",
    tokenSymbol: p.get("symbol") ?? "TOKEN",
    entryPriceUsd: Number(p.get("entry") ?? 0),
    exitPriceUsd: Number(p.get("exit") ?? 0),
    sizeUsd: Number(p.get("size") ?? 0),
    openedAt: Number(p.get("opened") ?? 0),
    closedAt: Number(p.get("closed") ?? Date.now()),
    txHash: p.get("tx") ?? "",
  };
  const pnl = computePnl(trade);
  const color = pnl.isProfit ? "#2FD180" : "#FF4D5E";
  const sign = pnl.isProfit ? "+" : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#0B0D11",
          color: "#E9EDF4",
          fontFamily: "monospace",
          padding: "64px",
          border: "2px solid #1F2530",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 34, letterSpacing: 2 }}>
            C<span style={{ color: "#FFB020" }}>TERMINAL</span>
          </div>
          <div style={{ fontSize: 26, color: "#8B94A7", textTransform: "uppercase" }}>
            {getChain(chain).name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, color: "#8B94A7" }}>${trade.tokenSymbol}</div>
          <div style={{ fontSize: 150, fontWeight: 700, color, lineHeight: 1.05 }}>
            {sign}
            {pnl.pnlPct.toFixed(1)}%
          </div>
          <div style={{ fontSize: 44, color }}>
            {sign}${Math.abs(pnl.pnlUsd).toLocaleString("en", { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 48, fontSize: 28, color: "#8B94A7" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 20, color: "#5B6372" }}>ENTRY</span>
            <span style={{ color: "#E9EDF4" }}>${trade.entryPriceUsd}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 20, color: "#5B6372" }}>EXIT</span>
            <span style={{ color: "#E9EDF4" }}>${trade.exitPriceUsd}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 20, color: "#5B6372" }}>HOLD</span>
            <span style={{ color: "#E9EDF4" }}>{formatHold(pnl.holdMs)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 20, color: "#5B6372" }}>SIZE</span>
            <span style={{ color: "#E9EDF4" }}>${trade.sizeUsd.toLocaleString()}</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
