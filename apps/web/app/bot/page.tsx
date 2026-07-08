"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChainId, SecuritySeverity, TokenMarketData } from "@cterminal/core";
import { fmtUsd } from "@/lib/format";
import { ChainBadge } from "@/components/ChainBadge";

interface RadarRow extends TokenMarketData { heat: number; screen: SecuritySeverity | null; }
interface Position { chain: ChainId; address: string; symbol: string; entry: number; qty: number; sizeUsd: number; openedAt: number; }
interface Closed extends Position { exit: number; pnl: number; closedAt: number; reason: string; }
interface BotState { bal: number; startBal: number; running: boolean; strategy: "snipe" | "momentum"; positions: Position[]; closed: Closed[]; log: string[]; }

const KEY = "cterm.bot";
const FRESH: BotState = { bal: 1000, startBal: 1000, running: false, strategy: "momentum", positions: [], closed: [], log: [] };

// Strategy parameters (visible, honest, tweakable later)
const CFG = {
  sizeUsd: 100,          // per trade
  maxPositions: 4,
  tpPct: 40,             // take profit
  slPct: -20,            // stop loss
  maxHoldMin: 60,        // time stop
  minHeat: { momentum: 55, snipe: 35 },
  snipeMaxAgeMin: 30,
};

/**
 * Paper Trading Bot (from the GOON mockup, made honest). Runs entirely in
 * your browser on REAL market data: it watches the Radar, enters simulated
 * positions per the chosen strategy, and exits on TP/SL/time. Virtual money
 * only — this exists to validate strategies BEFORE risking funds. Real
 * unattended execution requires Modo Automático (session keys, Fase 3
 * backend); until then, anything that trades for you while you sleep is
 * either custodial or lying.
 */
export default function BotPage() {
  const [s, setS] = useState<BotState>(FRESH);
  const sRef = useRef(s);
  sRef.current = s;

  useEffect(() => { try { const saved = localStorage.getItem(KEY); if (saved) setS(JSON.parse(saved)); } catch { /* noop */ } }, []);
  function save(next: BotState) { setS(next); localStorage.setItem(KEY, JSON.stringify(next)); }
  function log(st: BotState, msg: string): BotState {
    return { ...st, log: [`${new Date().toLocaleTimeString()} ${msg}`, ...st.log].slice(0, 60) };
  }

  // Main loop: every 20s, refresh radar + manage positions.
  useEffect(() => {
    if (!s.running) return;
    let stop = false;
    async function tick() {
      if (stop) return;
      try {
        const st0 = sRef.current;
        const { rows } = (await (await fetch("/api/radar")).json()) as { rows: RadarRow[] };
        let st = { ...st0, positions: [...st0.positions], closed: [...st0.closed] };

        // 1) manage exits with live prices
        for (const p of [...st.positions]) {
          const live = rows.find((r) => r.address === p.address);
          let px = live?.priceUsd;
          if (px === undefined) {
            try {
              const t = (await (await fetch(`/api/token?chain=${p.chain}&address=${p.address}`)).json()) as { data: TokenMarketData | null };
              px = t.data?.priceUsd;
            } catch { /* keep holding */ }
          }
          if (px === undefined || px <= 0) continue;
          const pct = (px / p.entry - 1) * 100;
          const heldMin = (Date.now() - p.openedAt) / 60000;
          let reason: string | null = null;
          if (pct >= CFG.tpPct) reason = `TP +${CFG.tpPct}%`;
          else if (pct <= CFG.slPct) reason = `SL ${CFG.slPct}%`;
          else if (heldMin >= CFG.maxHoldMin) reason = "time stop";
          if (reason) {
            const out = p.qty * px;
            const pnl = out - p.sizeUsd;
            st.positions = st.positions.filter((x) => x !== p);
            st.closed = [{ ...p, exit: px, pnl, closedAt: Date.now(), reason }, ...st.closed].slice(0, 50);
            st.bal += out;
            st = log(st, `CLOSE ${p.symbol} ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${reason})`);
          }
        }

        // 2) entries per strategy — only clean/caution screens, never danger/unscreened
        if (st.positions.length < CFG.maxPositions && st.bal >= CFG.sizeUsd) {
          const candidates = rows.filter((r) => {
            if (st.positions.some((p) => p.address === r.address)) return false;
            if (r.screen !== "ok" && r.screen !== "warn") return false;
            if (r.priceUsd <= 0 || r.liquidityUsd < 10_000) return false;
            if (st.strategy === "snipe") {
              const ageMin = r.pairCreatedAt ? (Date.now() - r.pairCreatedAt) / 60000 : Infinity;
              return ageMin <= CFG.snipeMaxAgeMin && r.heat >= CFG.minHeat.snipe;
            }
            return r.heat >= CFG.minHeat.momentum;
          });
          const pick = candidates[0];
          if (pick) {
            const qty = CFG.sizeUsd / pick.priceUsd;
            st.positions = [...st.positions, { chain: pick.chain, address: pick.address, symbol: pick.symbol, entry: pick.priceUsd, qty, sizeUsd: CFG.sizeUsd, openedAt: Date.now() }];
            st.bal -= CFG.sizeUsd;
            st = log(st, `OPEN ${pick.symbol} @ ${fmtUsd(pick.priceUsd, false)} (heat ${pick.heat}, ${pick.screen})`);
          }
        }
        save(st);
      } catch { /* next tick */ }
      if (!stop) setTimeout(tick, 20_000);
    }
    void tick();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.running, s.strategy]);

  const closedPnl = s.closed.reduce((a, c) => a + c.pnl, 0);
  const wins = s.closed.filter((c) => c.pnl > 0).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-semibold">Bot</h1>
        <span className="border border-line px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber">paper trading</span>
        <div className="ml-auto flex items-center gap-2">
          <select value={s.strategy} onChange={(e) => save({ ...s, strategy: e.target.value as BotState["strategy"] })}
            disabled={s.running} className="border border-line bg-ink-950 px-2 py-1 text-xs">
            <option value="momentum">Momentum (heat ≥ {CFG.minHeat.momentum})</option>
            <option value="snipe">New-pair snipe (≤ {CFG.snipeMaxAgeMin}min, heat ≥ {CFG.minHeat.snipe})</option>
          </select>
          <button onClick={() => save(log({ ...s, running: !s.running }, s.running ? "bot stopped" : `bot started (${s.strategy})`))}
            className={s.running ? "border border-down px-3 py-1 text-xs uppercase text-down" : "btn-amber px-3 py-1 text-xs uppercase"}>
            {s.running ? "Stop" : "Start"}
          </button>
          <button onClick={() => save(FRESH)} className="border border-line px-2 py-1 text-xs uppercase text-fg-dim hover:text-fg">Reset</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Balance" value={fmtUsd(s.bal, false)} />
        <Stat label="Open positions" value={String(s.positions.length)} />
        <Stat label="Closed PnL" value={`${closedPnl >= 0 ? "+" : ""}${fmtUsd(closedPnl, false)}`} tone={closedPnl >= 0 ? "up" : "down"} />
        <Stat label="Win rate" value={s.closed.length ? `${Math.round((wins / s.closed.length) * 100)}%` : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel panel-brackets p-3">
          <div className="cell-label mb-2">Open positions</div>
          {s.positions.length === 0 && <p className="py-3 text-center text-xs text-fg-dim">{s.running ? "Waiting for a setup…" : "Bot stopped."}</p>}
          {s.positions.map((p) => (
            <div key={p.address} className="flex items-center gap-2 border-b border-line/40 py-1 text-xs">
              <ChainBadge chain={p.chain} />
              <Link href={`/token/${p.chain}/${p.address}`} className="text-amber hover:underline">{p.symbol}</Link>
              <span className="text-fg-dim">entry {fmtUsd(p.entry, false)}</span>
              <span className="ml-auto text-fg-dim">{Math.round((Date.now() - p.openedAt) / 60000)}m</span>
            </div>
          ))}
        </div>
        <div className="panel panel-brackets p-3">
          <div className="cell-label mb-2">Closed trades</div>
          {s.closed.length === 0 && <p className="py-3 text-center text-xs text-fg-dim">No closed trades yet.</p>}
          <div className="max-h-56 overflow-y-auto">
            {s.closed.map((c, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-line/40 py-1 text-xs">
                <span className="text-fg">{c.symbol}</span>
                <span className={c.pnl >= 0 ? "text-up" : "text-down"}>{c.pnl >= 0 ? "+" : ""}{fmtUsd(c.pnl, false)}</span>
                <span className="ml-auto text-fg-dim">{c.reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel mt-4 p-3">
        <div className="cell-label mb-2">Log</div>
        <div className="max-h-40 overflow-y-auto text-[11px] text-fg-mute">
          {s.log.length === 0 ? <p className="text-fg-dim">—</p> : s.log.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-fg-dim">
        Rules: ${CFG.sizeUsd}/trade · max {CFG.maxPositions} positions · TP +{CFG.tpPct}% · SL {CFG.slPct}% · time stop {CFG.maxHoldMin}min ·
        only screened tokens (clean/caution), never danger or unscreened. Runs while this tab is open — validating a strategy, not replacing you.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="border border-line bg-ink-900 px-3 py-2">
      <div className="cell-label">{label}</div>
      <div className={`mt-0.5 text-sm ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-fg"}`}>{value}</div>
    </div>
  );
}
