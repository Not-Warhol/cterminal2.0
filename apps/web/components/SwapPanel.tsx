"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { erc20Abi, type Address } from "viem";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  CHAINS,
  runRiskCheck,
  type ChainId,
  type RiskCheckResult,
  type SecurityReportV2,
  type SwapQuote,
  type TokenMarketData,
} from "@cterminal/core";
import { fmtUsd } from "@/lib/format";
import { RiskCheckModal } from "@/components/RiskCheckModal";

/** Native/quote-side token per chain, in aggregator notation. */
const QUOTE_TOKEN: Record<ChainId, { address: string; symbol: string; decimals: number }> = {
  solana: { address: "So11111111111111111111111111111111111111112", symbol: "SOL", decimals: 9 },
  ethereum: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", decimals: 18 },
  base: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", decimals: 18 },
  arbitrum: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", decimals: 18 },
  avalanche: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "AVAX", decimals: 18 },
  robinhood: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", decimals: 18 },
};

type Direction = "buy" | "sell";

/**
 * Swap panel with BUY and SELL (spec Fase 2 fix).
 *  - Buy: native → token, amount in native units.
 *  - Sell: token → native, sized as a % of the wallet's actual balance
 *    (read live; no manual decimals). EVM sells go through the approval
 *    flow in lib/evm.ts; Solana through Jupiter.
 * Both route to the same mandatory Risk Check gate.
 */
export function SwapPanel({
  chain,
  tokenAddress,
  market,
  security,
}: {
  chain: ChainId;
  tokenAddress: string;
  market: TokenMarketData | null;
  security: SecurityReportV2 | null;
}) {
  const [dir, setDir] = useState<Direction>("buy");
  const [amount, setAmount] = useState("0.1"); // buy: native amount
  const [sellPct, setSellPct] = useState(100); // sell: % of holdings
  const [slippage, setSlippage] = useState(100);
  const [risk, setRisk] = useState<{ quote: SwapQuote; result: RiskCheckResult; amountIn: string } | null>(null);
  const evm = useAccount();
  const sol = useWallet();
  const { connection } = useConnection();
  const wagmiConfig = useConfig();
  const qt = QUOTE_TOKEN[chain];
  const cfg = CHAINS[chain];
  const walletReady = cfg.kind === "evm" ? evm.isConnected : sol.connected;

  // Live token balance (base units + ui), only needed for Sell.
  const balance = useQuery({
    queryKey: ["tokenBalance", chain, tokenAddress, evm.address, sol.publicKey?.toBase58()],
    enabled: dir === "sell" && walletReady,
    refetchInterval: 20_000,
    queryFn: async (): Promise<{ raw: bigint; ui: number; decimals: number }> => {
      if (cfg.kind === "evm" && evm.address) {
        const [raw, decimals] = await Promise.all([
          readContract(wagmiConfig, { chainId: cfg.evmChainId, address: tokenAddress as Address, abi: erc20Abi, functionName: "balanceOf", args: [evm.address] }),
          readContract(wagmiConfig, { chainId: cfg.evmChainId, address: tokenAddress as Address, abi: erc20Abi, functionName: "decimals" }),
        ]);
        return { raw, ui: Number(raw) / 10 ** Number(decimals), decimals: Number(decimals) };
      }
      if (sol.publicKey) {
        const accts = await connection.getParsedTokenAccountsByOwner(sol.publicKey, { mint: new PublicKey(tokenAddress) });
        const info = accts.value[0]?.account.data.parsed.info.tokenAmount;
        if (!info) return { raw: 0n, ui: 0, decimals: 0 };
        return { raw: BigInt(info.amount), ui: info.uiAmount ?? 0, decimals: info.decimals };
      }
      return { raw: 0n, ui: 0, decimals: 0 };
    },
  });

  const quote = useMutation({
    mutationFn: async (): Promise<{ quote: SwapQuote; amountIn: string }> => {
      let inputToken: string, outputToken: string, amountIn: string;
      if (dir === "buy") {
        inputToken = qt.address;
        outputToken = tokenAddress;
        amountIn = BigInt(Math.round(Number(amount) * 10 ** qt.decimals)).toString();
      } else {
        if (!balance.data || balance.data.raw === 0n) throw new Error("No balance to sell");
        inputToken = tokenAddress;
        outputToken = qt.address;
        amountIn = ((balance.data.raw * BigInt(sellPct)) / 100n).toString();
      }
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chain, inputToken, outputToken, amountIn, slippageBps: slippage, taker: evm.address }),
      });
      const body = (await r.json()) as { quote?: SwapQuote; error?: string };
      if (!r.ok || !body.quote) throw new Error(body.error ?? "Quote failed");
      return { quote: body.quote, amountIn };
    },
    onSuccess: ({ quote: q, amountIn }) => {
      setRisk({
        amountIn,
        quote: q,
        result: runRiskCheck({ quote: q, market, security, portfolioValueUsd: 0, tradeValueUsd: 0, maxRiskPct: 2 }),
      });
    },
  });

  const inputToken = dir === "buy" ? qt.address : tokenAddress;
  const outputToken = dir === "buy" ? tokenAddress : qt.address;

  return (
    <div className="panel panel-brackets p-3">
      {/* Buy / Sell toggle */}
      <div className="mb-3 flex border border-line">
        {(["buy", "sell"] as Direction[]).map((d) => (
          <button
            key={d}
            onClick={() => setDir(d)}
            className={`flex-1 py-1.5 text-xs uppercase tracking-wider ${dir === d ? (d === "buy" ? "bg-up/15 text-up" : "bg-down/15 text-down") : "text-fg-dim"}`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="cell-label">{dir === "buy" ? "Buy" : "Sell"} · {market?.symbol ?? cfg.name}</span>
        <span className="text-[10px] text-fg-dim">MEV: {cfg.mevProtection === "none" ? "n/a" : cfg.mevProtection}</span>
      </div>

      {dir === "buy" ? (
        <>
          <label className="cell-label" htmlFor="amt">Amount ({qt.symbol})</label>
          <input id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
            className="mt-1 w-full border border-line bg-ink-950 px-2 py-1.5 text-sm outline-none focus:border-amber" />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between text-[11px]">
            <span className="cell-label">Sell amount</span>
            <span className="text-fg-dim">
              Holding: {balance.isLoading ? "…" : (balance.data?.ui ?? 0).toLocaleString("en", { maximumFractionDigits: 4 })} {market?.symbol}
            </span>
          </div>
          <div className="mt-1 flex gap-1">
            {[25, 50, 100].map((pct) => (
              <button key={pct} onClick={() => setSellPct(pct)}
                className={`flex-1 border py-1 text-xs ${sellPct === pct ? "border-amber text-amber" : "border-line text-fg-mute"}`}>
                {pct}%
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-2 flex items-center gap-2 text-[11px] text-fg-mute">
        <span>Slippage</span>
        {[50, 100, 300].map((bps) => (
          <button key={bps} onClick={() => setSlippage(bps)}
            className={`border px-1.5 py-0.5 ${slippage === bps ? "border-amber text-amber" : "border-line"}`}>
            {bps / 100}%
          </button>
        ))}
      </div>

      <button
        onClick={() => quote.mutate()}
        disabled={!walletReady || quote.isPending || (dir === "sell" && !balance.data?.raw)}
        className={`mt-3 w-full py-2 text-sm ${dir === "sell" ? "border border-down text-down hover:bg-down/10" : "btn-amber"}`}
      >
        {!walletReady
          ? `Connect ${cfg.kind === "evm" ? "EVM" : "Solana"} wallet`
          : quote.isPending
            ? "Simulating…"
            : dir === "buy"
              ? "Ape with Risk Check"
              : "Sell with Risk Check"}
      </button>
      {quote.error && <p className="mt-2 text-xs text-down">{(quote.error as Error).message}</p>}
      {market && (
        <p className="mt-2 text-[10px] text-fg-dim">
          Pool liquidity {fmtUsd(market.liquidityUsd)} · fee {Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? 0) / 100}%
        </p>
      )}
      {risk && (
        <RiskCheckModal
          chain={chain}
          quote={risk.quote}
          result={risk.result}
          tokenSymbol={market?.symbol ?? "token"}
          swapParams={{ inputToken, outputToken, amountIn: risk.amountIn, slippageBps: slippage }}
          onClose={() => { setRisk(null); void balance.refetch(); }}
        />
      )}
    </div>
  );
}
