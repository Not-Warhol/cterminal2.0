"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, base, arbitrum, avalanche } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { useState } from "react";

/**
 * Multi-chain wallet context: wagmi (all EVM) + Solana wallet adapter,
 * mounted simultaneously — connecting one never disconnects the other
 * (spec §4.1). Solana wallets arrive via Wallet Standard auto-detection
 * (Phantom, Solflare, Backpack register themselves — no adapter list,
 * no heavy meta-package). Alchemy RPC when key present; public fallback.
 */
const alchemy = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

export const wagmiConfig = createConfig({
  chains: [mainnet, base, arbitrum, avalanche],
  connectors: [injected()],
  transports: {
    // Ethereum mainnet: Flashbots Protect RPC shields swaps from sandwich MEV
    [mainnet.id]: http("https://rpc.flashbots.net/fast"),
    [base.id]: http(alchemy ? `https://base-mainnet.g.alchemy.com/v2/${alchemy}` : undefined),
    [arbitrum.id]: http(alchemy ? `https://arb-mainnet.g.alchemy.com/v2/${alchemy}` : undefined),
    [avalanche.id]: http(alchemy ? `https://avax-mainnet.g.alchemy.com/v2/${alchemy}` : undefined),
  },
});

const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
const solanaRpc = heliusKey
  ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
  : "https://api.mainnet-beta.solana.com";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider endpoint={solanaRpc}>
          <WalletProvider wallets={[]} autoConnect>
            {children}
          </WalletProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
