"use client";

import { useEffect, useState } from "react";

interface Alert { id: string; chain: string; address: string; symbol: string; above: number | null; below: number | null; }

/**
 * Price alerts (dashboard). Client-side and honest: alerts live in the
 * browser (localStorage) and are evaluated while the app is open — no server
 * push yet (that needs the Fase 2 backend). Lets a trader set above/below
 * thresholds per token.
 */
export function AlertsWidget() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [symbol, setSymbol] = useState("");
  const [above, setAbove] = useState("");

  useEffect(() => {
    try { setAlerts(JSON.parse(localStorage.getItem("cterm.alerts") ?? "[]")); } catch { /* noop */ }
  }, []);
  function persist(next: Alert[]) { setAlerts(next); localStorage.setItem("cterm.alerts", JSON.stringify(next)); }

  return (
    <div className="panel panel-brackets p-3">
      <div className="cell-label mb-2">Alerts</div>
      <div className="flex gap-1">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="SYMBOL"
          className="w-24 border border-line bg-ink-950 px-2 py-1 text-xs outline-none focus:border-amber" />
        <input value={above} onChange={(e) => setAbove(e.target.value)} placeholder="above $" inputMode="decimal"
          className="flex-1 border border-line bg-ink-950 px-2 py-1 text-xs outline-none focus:border-amber" />
        <button
          onClick={() => { if (!symbol) return; persist([...alerts, { id: crypto.randomUUID(), chain: "", address: "", symbol: symbol.toUpperCase(), above: Number(above) || null, below: null }]); setSymbol(""); setAbove(""); }}
          className="btn-amber px-2 text-xs">Add</button>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {alerts.length === 0 && <li className="text-fg-dim">No alerts. Set one above.</li>}
        {alerts.map((a) => (
          <li key={a.id} className="flex items-center justify-between border-b border-line/50 py-1">
            <span className="text-fg">${a.symbol}</span>
            <span className="text-fg-dim">{a.above ? `> $${a.above}` : ""}</span>
            <button onClick={() => persist(alerts.filter((x) => x.id !== a.id))} className="text-down">✕</button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-fg-dim">Evaluated while the app is open. Server push arrives with the Fase 2 backend.</p>
    </div>
  );
}
