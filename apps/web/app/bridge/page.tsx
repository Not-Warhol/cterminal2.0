"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { sendTransaction, switchChain } from "wagmi/actions";
import {
  getChain,
  isEvm,
  PHASE_1_CHAINS,
  STATE_LABELS,
  type BridgeQuote,
  type BridgeState,
  type BridgeStatusRequest,
  type ChainId,
} from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { useBridgeTracking } from "@/lib/useBridgeTracking";
import { fmtUsd } from "@/lib/format";

/** Native-token defaults per chain for the MVP bridge flow. */
const NATIVE: Record<ChainId, { address: string; symbol: string; decimals: number }> = {
  solana: { address: "So11111111111111111111111111111111111111112", symbol: "SOL", decimals: 9 },
  ethereum: { address: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18 },
  base: { address: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18 },
  arbitrum: { address: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18 },
  avalanche: { address: "0x0000000000000000000000000000000000000000", symbol: "AVAX", decimals: 18 },
};

const TIMELINE: BridgeState[] = ["quoted", "submitted", "pending_source", "pending_bridge", "pending_dest", "completed"];

/**
 * Bridge & Swap flow (spec §4.5): pick chains + amount → LI.FI route with
 * honest time/fee/slippage breakdown → state-machine timeline.
 * Execution (sign + track) wires to LI.FI transactionRequest in Fase 1.1;
 * tracking states map 1:1 to core/bridge/stateMachine.ts.
 */
export default function BridgePage() {
  const [from, setFrom] = useState<ChainId>("base");
  const [to, setTo] = useState<ChainId>("arbitrum");
  const [amount, setAmount] = useState("0.05");
  const [track, setTrack] = useState<BridgeStatusRequest | null>(null);
  const [execErr, setExecErr] = useState<string | null>(null);
  const evm = useAccount();
  const wagmiConfig = useConfig();
  const liveStatus = useBridgeTracking(track);

  const quote = useMutation({
    mutationFn: async () => {
      const amountIn = BigInt(Math.round(Number(amount) * 10 ** NATIVE[from].decimals)).toString();
      const r = await fetch("/api/bridge-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromChain: from,
          toChain: to,
          fromToken: NATIVE[from].address,
          toToken: NATIVE[to].address,
          amountIn,
          slippageBps: 50,
        }),
      });
      const body = (await r.json()) as { quote?: BridgeQuote; error?: string };
      if (!r.ok || !body.quote) throw new Error(body.error ?? "No route found");
      return body.quote;
    },
  });

  const q = quote.data;

  // EVM→EVM execution: LI.FI quote raw carries a transactionRequest we sign.
  // Solana bridging execution is a documented stub (needs Solana tx path).
  const execute = useMutation({
    mutationFn: async () => {
      setExecErr(null);
      if (!q) throw new Error("Get a route first");
      if (!isEvm(from)) throw new Error("Solana bridge execution ships in Fase 2.1");
      if (!evm.address) throw new Error("Connect an EVM wallet");
      const raw = q.raw as { transactionRequest?: { to: string; data: string; value?: string; chainId?: number } };
      const txReq = raw.transactionRequest;
      if (!txReq) throw new Error("No transaction in route");
      await switchChain(wagmiConfig, { chainId: getChain(from).evmChainId! });
      const hash = await sendTransaction(wagmiConfig, {
        chainId: getChain(from).evmChainId!,
        to: txReq.to as `0x${string}`,
        data: txReq.data as `0x${string}`,
        value: BigInt(txReq.value ?? "0"),
      });
      setTrack({ tool: q.tool, fromChain: from, toChain: to, txHash: hash });
      return hash;
    },
    onError: (e) => setExecErr((e as Error).message),
  });

  // Highlight the timeline up to the live state (falls back to "quoted").
  const activeState: BridgeState = liveStatus?.state ?? (track ? "submitted" : "quoted");
  const activeIdx = useMemo(() => TIMELINE.indexOf(activeState), [activeState]);
  const outUi = q ? Number(q.estimatedAmountOut) / 10 ** NATIVE[to].decimals : null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display mb-4 text-xl font-semibold">Bridge</h1>
      <div className="panel panel-brackets space-y-4 p-4">
        <ChainRow label="From" value={from} exclude={to} onChange={setFrom} />
        <ChainRow label="To" value={to} exclude={from} onChange={setTo} />
        <div>
          <label className="cell-label" htmlFor="bamt">Amount ({NATIVE[from].symbol})</label>
          <input
            id="bamt"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full border border-line bg-ink-950 px-2 py-1.5 text-sm outline-none focus:border-amber"
          />
        </div>
        <button
          onClick={() => quote.mutate()}
          disabled={quote.isPending || !Number(amount)}
          className="btn-amber w-full py-2 text-sm"
        >
          {quote.isPending ? "Finding best route…" : "Get route"}
        </button>
        {quote.error && <p className="text-xs text-down">{(quote.error as Error).message}</p>}

        {q && (
          <div className="border-t border-line pt-3 text-xs">
            <div className="grid grid-cols-2 gap-y-1 text-fg-mute">
              <span>Route</span><span className="text-right text-fg">{q.provider} · {q.tool}</span>
              <span>You receive (est.)</span>
              <span className="text-right text-fg">{outUi?.toFixed(5)} {NATIVE[to].symbol}</span>
              <span>Bridge fees</span><span className="text-right text-fg">{fmtUsd(q.feesUsd, false)}</span>
              <span>Gas (est.)</span><span className="text-right text-fg">{fmtUsd(q.gasUsd, false)}</span>
              <span>Time (est.)</span>
              <span className="text-right text-fg">
                {q.estimatedSeconds < 90 ? `${q.estimatedSeconds}s` : `${Math.round(q.estimatedSeconds / 60)}min`}
              </span>
            </div>
            <ol className="mt-4 flex flex-wrap gap-x-1 gap-y-2">
              {TIMELINE.map((s, i) => {
                const done = activeIdx >= 0 && i < activeIdx;
                const current = i === activeIdx;
                return (
                  <li key={s} className="flex items-center gap-1">
                    <span className={`px-1.5 py-0.5 text-[10px] uppercase ${current ? "bg-amber-soft text-amber" : done ? "text-up" : "text-fg-dim"}`}>
                      {STATE_LABELS[s]}
                    </span>
                    {i < TIMELINE.length - 1 && <span className="text-fg-dim">→</span>}
                  </li>
                );
              })}
            </ol>

            {liveStatus?.state === "failed" && (
              <p className="mt-2 text-xs text-down">Bridge failed{liveStatus.message ? `: ${liveStatus.message}` : "."} Funds are typically refunded on the source chain.</p>
            )}
            {liveStatus?.message && liveStatus.state !== "failed" && (
              <p className="mt-2 text-[11px] text-fg-mute">{liveStatus.message}</p>
            )}
            {liveStatus?.destTxHash && (
              <a className="mt-1 block text-[11px] text-amber underline" href={`${getChain(to).explorer}/tx/${liveStatus.destTxHash}`} target="_blank" rel="noreferrer">
                Destination transaction ↗
              </a>
            )}

            {!track ? (
              <button
                onClick={() => execute.mutate()}
                disabled={execute.isPending}
                className="btn-amber mt-4 w-full py-2 text-sm"
              >
                {execute.isPending ? "Confirm in wallet…" : isEvm(from) ? "Execute bridge" : "Solana bridging → Fase 2.1"}
              </button>
            ) : (
              <p className="mt-4 text-xs text-fg-mute">
                {liveStatus?.state === "completed" ? "✓ Bridge complete — balances refreshed." : "Tracking transfer… you can leave this open."}
              </p>
            )}
            {execErr && <p className="mt-2 text-xs text-down">{execErr}</p>}

            <p className="mt-3 text-[10px] text-fg-dim">
              Bridging moves funds across networks and can take longer than shown. If a transfer
              stalls, funds are recoverable in the vast majority of states.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChainRow({
  label,
  value,
  exclude,
  onChange,
}: {
  label: string;
  value: ChainId;
  exclude: ChainId;
  onChange: (c: ChainId) => void;
}) {
  return (
    <div>
      <div className="cell-label mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {PHASE_1_CHAINS.map((c) => (
          <button key={c} onClick={() => onChange(c)} disabled={c === exclude} className={`${value === c ? "" : "opacity-50 hover:opacity-90"} disabled:opacity-20`}>
            <ChainBadge chain={c} active={value === c} />
          </button>
        ))}
      </div>
    </div>
  );
}
