import type { PnlSummary, TradeRecord } from "../types";

/** Pure PnL math for the Share PnL card (spec Fase 2 §1.4). */
export function computePnl(t: TradeRecord): PnlSummary {
  const entryValue = t.sizeUsd;
  const qty = t.entryPriceUsd > 0 ? entryValue / t.entryPriceUsd : 0;
  const exitValue = qty * t.exitPriceUsd;
  const pnlUsd = exitValue - entryValue;
  const pnlPct = entryValue > 0 ? (pnlUsd / entryValue) * 100 : 0;
  return {
    pnlUsd,
    pnlPct,
    holdMs: Math.max(0, t.closedAt - t.openedAt),
    isProfit: pnlUsd >= 0,
  };
}

export function formatHold(ms: number): string {
  const h = ms / 3.6e6;
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${Math.round(h / 24)}d`;
}
