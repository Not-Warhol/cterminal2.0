"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import type { ChainId } from "@cterminal/core";
import { ChainBadge } from "@/components/ChainBadge";
import { fmtUsd, short } from "@/lib/format";

interface Position {
  chain: ChainId;
  address: string;
  symbol: string;
  name: string;
  amountUi: number;
  priceUsd: number | null;
  valueUsd: number | null;
  logo?: string;
  suspicious: boolean;
}

/**
 * Portfolio (spec Fase 2 request): every token an address holds, across all
 * chains, priced in USD, with suspicious/scam tokens hidden by default
 * behind a toggle. Data from /api/portfolio (Alchemy EVM + Helius Solana).
 */
export default function PortfolioPage() {
  const evm = useAccount();
  const sol = useWallet();
  const [showHidden, setShowHidden] = useState(false);

  const evmAddr = evm.address;
  const solAddr = sol.publicKey?.toBase58();

  const { data, isLoading } = useQuery({
    queryKey: ["portfolio", evmAddr, solAddr],
    enabled: Boolean(evmAddr || solAddr),
    refetchInterval: 30_000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (evmAddr) params.set("evm", evmAddr);
      if (solAddr) params.set("sol", solAddr);
      const r = await fetch(`/api/portfolio?${params}`);
      return (await r.json()) as { positions: Position[]; totalUsd: number; errors: string[] };
    },
  });

  const nothingConnected = !evmAddr && !solAddr;
  const positions = data?.positions ?? [];
  const hiddenCount = positions.filter((p) => p.suspicious).length;
  const visible = positions.filter((p) => showHidden || !p.suspicious);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Portfolio</h1>
          {data && <p className="text-sm text-fg-mute">Total {fmtUsd(data.totalUsd)}</p>}
        </div>
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="border border-line px-2 py-1 text-[11px] uppercase tracking-wider text-fg-mute hover:border-amber hover:text-amber"
          >
            {showHidden ? "Hide" : "Show"} {hiddenCount} suspicious
          </button>
        )}
      </div>

      {nothingConnected ? (
        <div className="panel p-8 text-center text-sm text-fg-mute">
          Connect an EVM or Solana wallet in the top bar to see all your tokens across chains.
        </div>
      ) : (
        <div className="panel panel-brackets overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="cell-label border-b border-line">
                {["Token", "Chain", "Amount", "Price", "Value", ""].map((h) => (
                  <th key={h} className="px-3 py-2 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-fg-dim">Loading balances…</td></tr>
              )}
              {!isLoading && visible.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-fg-dim">No tokens found.</td></tr>
              )}
              {visible.map((p) => (
                <tr key={`${p.chain}-${p.address}`} className={`border-b border-line/50 hover:bg-ink-800 ${p.suspicious ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2">
                    <Link href={`/token/${p.chain}/${p.address}`} className="text-amber hover:underline">{p.symbol}</Link>
                    {p.suspicious && <span className="ml-2 text-[9px] uppercase text-down">suspicious</span>}
                  </td>
                  <td className="px-3 py-2"><ChainBadge chain={p.chain} /></td>
                  <td className="px-3 py-2">{p.amountUi.toLocaleString("en", { maximumFractionDigits: 4 })}</td>
                  <td className="px-3 py-2">{fmtUsd(p.priceUsd, false)}</td>
                  <td className="px-3 py-2">{fmtUsd(p.valueUsd)}</td>
                  <td className="px-3 py-2 text-right text-[10px] text-fg-dim">{short(p.address)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-fg-dim">
        Balances via Alchemy (EVM) + Helius (Solana). Suspicious = no price, dust, or scam-like name — hidden from totals.
      </p>
    </div>
  );
}
