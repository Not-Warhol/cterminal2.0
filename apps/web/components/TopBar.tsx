"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { short } from "@/lib/format";
import { SearchBox } from "@/components/SearchBox";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/radar", label: "Radar" },
  { href: "/discover", label: "Discover" },
  { href: "/alpha", label: "Alpha" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/bot", label: "Bot" },
  { href: "/bridge", label: "Bridge" },
];

/**
 * Persistent shell: brand, nav, and the two wallet slots (EVM + Solana).
 * The active-chain indicator lives with the content that owns it (token
 * page, bridge flow) so it is always unambiguous (spec §8).
 */
export function TopBar() {
  const path = usePathname();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const sol = useWallet();
  const [showSolPicker, setShowSolPicker] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink-950/95 backdrop-blur">
      <div className="tape flex items-center gap-4 px-4 py-1">
        <span className="text-amber">● live</span>
        <span>non-custodial — keys never leave your wallet</span>
        <span className="ml-auto hidden sm:block">mode: manual (fase 1)</span>
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-2.5">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          C<span className="text-amber">TERMINAL</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1 ${
                path === n.href ? "bg-ink-800 text-amber" : "text-fg-mute hover:text-fg"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs">
          {isConnected && address ? (
            <button onClick={() => disconnect()} className="border border-line px-2.5 py-1.5 hover:border-amber" title="Disconnect EVM wallet">
              EVM · {short(address)}
            </button>
          ) : (
            <button
              onClick={() => connectors[0] && connect({ connector: connectors[0] })}
              className="border border-line px-2.5 py-1.5 text-fg-mute hover:border-amber hover:text-fg"
            >
              Connect EVM
            </button>
          )}
          {sol.connected && sol.publicKey ? (
            <button onClick={() => sol.disconnect()} className="border border-line px-2.5 py-1.5 hover:border-amber" title="Disconnect Solana wallet">
              SOL · {short(sol.publicKey.toBase58())}
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowSolPicker((v) => !v)}
                className="border border-line px-2.5 py-1.5 text-fg-mute hover:border-amber hover:text-fg"
              >
                Connect Solana
              </button>
              {showSolPicker && (
                <div className="absolute right-0 z-50 mt-1 w-48 border border-line bg-ink-900 p-1 shadow-xl">
                  {sol.wallets.length === 0 && (
                    <p className="px-2 py-2 text-[11px] text-fg-dim">No Solana wallet detected. Install Phantom.</p>
                  )}
                  {sol.wallets.map((w) => (
                    <button
                      key={w.adapter.name}
                      onClick={() => {
                        sol.select(w.adapter.name);
                        setShowSolPicker(false);
                        void sol.connect().catch(() => {});
                      }}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-fg-mute hover:bg-ink-800 hover:text-fg"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {w.adapter.icon && <img src={w.adapter.icon} alt="" className="h-4 w-4" />}
                      {w.adapter.name}
                      {w.readyState === "Installed" && <span className="ml-auto text-[9px] text-up">detected</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-2">
        <SearchBox />
      </div>
    </header>
  );
}
