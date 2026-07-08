"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { short } from "@/lib/format";

interface Launch {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  ts: number;
  solInPool?: number;
  marketCapSol?: number;
  uri?: string;
}

const WS_URL = "wss://pumpportal.fun/api/data";
const WATCH_KEY = "cterm.pumpfun.watch";

/**
 * Pump.fun zone (BullX-style, spec Fase 4). Live launch feed via the
 * PumpPortal public websocket — KEYLESS for the data stream. Every new
 * pump.fun token appears here the second it's created, with creator
 * address, and a deployer watchlist: add address X and their launches get
 * pinned + highlighted (the "buy everything dev X launches" radar — the
 * detection half; auto-BUYING needs a PumpPortal trade API key + Modo
 * Automático and is deliberately not simulated as done).
 */
export default function PumpFunPage() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [watch, setWatch] = useState<string[]>([]);
  const [watchInput, setWatchInput] = useState("");
  const [onlyWatched, setOnlyWatched] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => { try { setWatch(JSON.parse(localStorage.getItem(WATCH_KEY) ?? "[]")); } catch { /* noop */ } }, []);
  function saveWatch(next: string[]) { setWatch(next); localStorage.setItem(WATCH_KEY, JSON.stringify(next)); }

  useEffect(() => {
    let closed = false;
    function connect() {
      if (closed) return;
      setStatus("connecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setStatus("live");
        ws.send(JSON.stringify({ method: "subscribeNewToken" }));
      };
      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data as string) as Record<string, unknown>;
          if (!d.mint) return;
          const l: Launch = {
            mint: String(d.mint),
            name: String(d.name ?? "?"),
            symbol: String(d.symbol ?? "?"),
            creator: String(d.traderPublicKey ?? d.creator ?? ""),
            ts: Date.now(),
            solInPool: typeof d.solInPool === "number" ? d.solInPool : undefined,
            marketCapSol: typeof d.marketCapSol === "number" ? d.marketCapSol : undefined,
          };
          setLaunches((prev) => [l, ...prev].slice(0, 150));
        } catch { /* skip malformed */ }
      };
      ws.onerror = () => setStatus("error");
      ws.onclose = () => { if (!closed) setTimeout(connect, 3000); };
    }
    connect();
    return () => { closed = true; wsRef.current?.close(); };
  }, []);

  const watchSet = new Set(watch.map((w) => w.toLowerCase()));
  const rows = launches.filter((l) => !onlyWatched || watchSet.has(l.creator.toLowerCase()));
  const pinned = launches.filter((l) => watchSet.has(l.creator.toLowerCase()));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-semibold">Pump.fun</h1>
        <span className={`text-[10px] uppercase tracking-widest ${status === "live" ? "text-up" : status === "error" ? "text-down" : "text-fg-dim"}`}>
          ● {status === "live" ? "live stream" : status}
        </span>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-fg-mute">
          <input type="checkbox" checked={onlyWatched} onChange={(e) => setOnlyWatched(e.target.checked)} />
          only watched deployers
        </label>
      </div>

      <div className="panel mb-4 p-3">
        <div className="cell-label mb-2">Deployer watch — pin every launch from these addresses</div>
        <div className="flex gap-1">
          <input value={watchInput} onChange={(e) => setWatchInput(e.target.value)} placeholder="Solana address of the deployer"
            className="flex-1 border border-line bg-ink-950 px-2 py-1.5 text-xs outline-none focus:border-amber" />
          <button onClick={() => { const a = watchInput.trim(); if (a) { saveWatch([...new Set([...watch, a])]); setWatchInput(""); } }}
            className="btn-amber px-3 text-xs">Watch</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {watch.map((w) => (
            <span key={w} className="flex items-center gap-1 border border-amber px-1.5 py-0.5 text-[10px] text-amber">
              {short(w)}
              <button onClick={() => saveWatch(watch.filter((x) => x !== w))} className="text-fg-dim hover:text-down">✕</button>
            </span>
          ))}
          {watch.length === 0 && <span className="text-[11px] text-fg-dim">No deployers watched yet.</span>}
        </div>
        <p className="mt-2 text-[10px] text-fg-dim">
          Detection is live and keyless. Auto-BUY on a watched deployer needs a PumpPortal trade API key
          (pumpportal.fun) + unattended signing — coming with Modo Automático. For now: instant pin + one-click open.
        </p>
      </div>

      {pinned.length > 0 && !onlyWatched && (
        <div className="panel panel-brackets mb-4 border-amber p-3">
          <div className="cell-label mb-2 text-amber">Watched deployer launches</div>
          {pinned.slice(0, 5).map((l) => <LaunchRow key={l.mint} l={l} watched />)}
        </div>
      )}

      <div className="panel panel-brackets p-3">
        <div className="cell-label mb-2">New launches · live</div>
        {rows.length === 0 && (
          <p className="py-6 text-center text-xs text-fg-dim">
            {status === "live" ? "Waiting for the next launch… (they come fast)" : "Connecting to the pump.fun stream…"}
          </p>
        )}
        <div className="max-h-[540px] overflow-y-auto">
          {rows.map((l) => <LaunchRow key={l.mint} l={l} watched={watchSet.has(l.creator.toLowerCase())} />)}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-fg-dim">
        Stream: PumpPortal public websocket. Bonded tokens graduate to Raydium and become tradeable in the terminal. Not financial advice.
      </p>
    </div>
  );
}

function LaunchRow({ l, watched }: { l: Launch; watched?: boolean }) {
  const ageS = Math.round((Date.now() - l.ts) / 1000);
  return (
    <div className={`flex items-center gap-2 border-b border-line/40 py-1.5 text-xs ${watched ? "bg-amber-soft" : ""}`}>
      <span className="text-amber">{l.symbol}</span>
      <span className="max-w-[180px] truncate text-fg-mute">{l.name}</span>
      {watched && <span className="border border-amber px-1 text-[9px] uppercase text-amber">watched dev</span>}
      <span className="text-[10px] text-fg-dim">dev {short(l.creator)}</span>
      {l.marketCapSol !== undefined && <span className="text-[10px] text-fg-dim">{l.marketCapSol.toFixed(1)} SOL mc</span>}
      <span className="ml-auto text-[10px] text-fg-dim">{ageS < 60 ? `${ageS}s` : `${Math.round(ageS / 60)}m`}</span>
      <a href={`https://pump.fun/coin/${l.mint}`} target="_blank" rel="noreferrer" className="border border-line px-1.5 py-0.5 text-[10px] uppercase text-fg-mute hover:border-amber hover:text-amber">pump.fun ↗</a>
      <Link href={`/token/solana/${l.mint}`} className="btn-amber px-1.5 py-0.5 text-[10px] uppercase">Open</Link>
    </div>
  );
}
