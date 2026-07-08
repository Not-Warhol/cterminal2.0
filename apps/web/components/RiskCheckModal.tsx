"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useAccount, useConfig } from "wagmi";
import { CHAINS, type ChainId, type EvmSwapTx, type RiskCheckResult, type SwapQuote } from "@cterminal/core";
import { executeSolanaSwap } from "@/lib/execute";
import { executeEvmSwap } from "@/lib/evm";

const VERDICT_STYLE = {
  green: "border-up text-up",
  yellow: "border-amber text-amber",
  red: "border-down text-down",
} as const;

/**
 * The gate before every signature: simulation summary + findings +
 * explicit confirm. On red verdicts the confirm is demoted, never hidden —
 * the trader decides, the terminal informs (spec §4.3).
 */
export function RiskCheckModal({
  chain,
  quote,
  result,
  tokenSymbol,
  swapParams,
  onClose,
}: {
  chain: ChainId;
  quote: SwapQuote;
  result: RiskCheckResult;
  tokenSymbol: string;
  swapParams: { inputToken: string; outputToken: string; amountIn: string; slippageBps: number };
  onClose: () => void;
}) {
  const cfg = CHAINS[chain];
  const solWallet = useWallet();
  const { connection } = useConnection();
  const evm = useAccount();
  const wagmiConfig = useConfig();
  const [status, setStatus] = useState<{ kind: "idle" | "sending" | "sent" | "error"; msg?: string }>({ kind: "idle" });
  const [step, setStep] = useState<string | null>(null);

  async function confirm() {
    setStatus({ kind: "sending" });
    try {
      if (chain === "solana") {
        const sig = await executeSolanaSwap({ quote, wallet: solWallet, connection });
        setStatus({ kind: "sent", msg: sig });
      } else {
        if (!evm.address) throw new Error("EVM wallet not connected");
        // 1) Build tx server-side (1inch key stays on the server)
        const r = await fetch("/api/swap-tx", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chain, ...swapParams, taker: evm.address }),
        });
        const body = (await r.json()) as { tx?: EvmSwapTx; error?: string };
        if (!r.ok || !body.tx) throw new Error(body.error ?? "Swap build failed");
        // Full flow: chain switch → ERC-20 approval (if selling) → sign → confirm
        const hash = await executeEvmSwap({
          config: wagmiConfig,
          chainId: cfg.evmChainId!,
          swapTx: body.tx,
          inputToken: swapParams.inputToken,
          amountIn: swapParams.amountIn,
          owner: evm.address,
          onStep: (st) => setStep(st),
        });
        setStatus({ kind: "sent", msg: hash });
      }
    } catch (e) {
      setStatus({ kind: "error", msg: (e as Error).message });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4" role="dialog" aria-modal="true">
      <div className="panel panel-brackets w-full max-w-md p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display font-semibold">Risk check · {tokenSymbol}</h2>
          <div className="flex items-center gap-2">
            <span className={`border px-2 py-0.5 text-xs uppercase ${VERDICT_STYLE[result.verdict]}`}>
              {result.verdict}
            </span>
            <button onClick={onClose} aria-label="Close" className="px-1.5 text-fg-dim hover:text-fg">✕</button>
          </div>
        </div>

        <div className="space-y-1 text-xs text-fg-mute">
          <p>
            <span className="text-fg">Best price via {quote.provider === "jupiter" ? "Jupiter" : "1inch"}</span>
            {" "}— aggregated across DEXes{quote.route.length ? ` (${quote.route.length} hop${quote.route.length > 1 ? "s" : ""}: ${quote.route.join(" → ")})` : ""}
          </p>
          {quote.priceImpactPct !== null && <p>Price impact: {quote.priceImpactPct.toFixed(2)}%</p>}
          <p>Min received (slippage-protected): {quote.minAmountOut} raw units</p>
          <p>Simulation: transaction will be simulated before your wallet opens.</p>
        </div>

        {result.signals && (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-[11px]">
            <SignalRow label="Risk score" value={`${result.riskScore}/100`} bad={result.riskScore >= 60} />
            <SignalRow label="Holders" value={result.signals.holderCount?.toLocaleString() ?? "?"} />
            <SignalRow label="Top holder" value={result.signals.topHolderPct !== null ? `${result.signals.topHolderPct.toFixed(0)}%` : "?"} bad={(result.signals.topHolderPct ?? 0) > 20} />
            <SignalRow label="Top 10" value={result.signals.top10Pct !== null ? `${result.signals.top10Pct.toFixed(0)}%` : "?"} />
            <SignalRow label="LP locked" value={result.signals.lpLocked === null ? "?" : result.signals.lpLocked ? "yes" : "no"} bad={result.signals.lpLocked === false} />
            <SignalRow label="Creator" value={result.signals.creatorPct !== null ? `${result.signals.creatorPct.toFixed(0)}%` : "?"} bad={(result.signals.creatorPct ?? 0) > 5} />
          </div>
        )}
        {result.findings.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
            {result.findings.map((f, i) => (
              <li key={i} className={f.severity === "danger" ? "text-down" : f.severity === "warn" ? "text-amber" : "text-fg-mute"}>
                ▸ {f.label}
              </li>
            ))}
          </ul>
        )}

        {status.kind === "sent" ? (
          <div className="mt-4">
            <p className="text-xs text-up">Transaction sent.</p>
            <a
              className="text-xs text-amber underline"
              href={`${cfg.explorer}/tx/${status.msg}`}
              target="_blank"
              rel="noreferrer"
            >
              View on explorer ↗
            </a>
            <button onClick={onClose} className="btn-amber mt-3 w-full py-2 text-sm">Done</button>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <button onClick={onClose} className="flex-1 border border-line py-2 text-sm text-fg-mute hover:text-fg">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={status.kind === "sending"}
              className={`flex-1 py-2 text-sm ${result.verdict === "red" ? "border border-down text-down hover:bg-down/10" : "btn-amber"}`}
            >
              {status.kind === "sending" ? (step ? `${step}…` : "Signing…") : result.verdict === "red" ? "Ape anyway" : "Sign in wallet"}
            </button>
          </div>
        )}
        {status.kind === "error" && <p className="mt-2 text-xs text-down">{status.msg}</p>}
      </div>
    </div>
  );
}

function SignalRow({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-fg-dim">{label}</span>
      <span className={bad ? "text-down" : "text-fg"}>{value}</span>
    </div>
  );
}
