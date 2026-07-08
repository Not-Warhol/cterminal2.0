/**
 * Chain registry — the single source of truth for supported chains.
 * Adding a new EVM chain = adding one entry here + aggregator support check.
 * (ADR-0003: provider abstractions)
 */

export type ChainKind = "evm" | "solana";

export interface ChainConfig {
  /** Internal stable id used across the app, DB and URLs */
  id: ChainId;
  kind: ChainKind;
  name: string;
  /** EVM numeric chain id (undefined for Solana) */
  evmChainId?: number;
  /** Native gas token symbol */
  nativeSymbol: string;
  /** Slug used by GeckoTerminal API/embeds */
  geckoTerminalNetwork: string;
  /** Slug used by DexScreener API */
  dexscreenerChain: string;
  /** Slug used by LI.FI */
  lifiChainKey: string;
  /** Whether real MEV protection exists (shown honestly in the UI) */
  mevProtection: "jito" | "private-rpc" | "none";
  /** Block explorer base url */
  explorer: string;
  /** Phase in which the chain ships */
  phase: 1 | 2 | 3;
}

export type ChainId =
  | "solana"
  | "ethereum"
  | "base"
  | "arbitrum"
  | "avalanche"
  | "robinhood";

export const CHAINS: Record<ChainId, ChainConfig> = {
  solana: {
    id: "solana",
    kind: "solana",
    name: "Solana",
    nativeSymbol: "SOL",
    geckoTerminalNetwork: "solana",
    dexscreenerChain: "solana",
    lifiChainKey: "SOL",
    mevProtection: "jito",
    explorer: "https://solscan.io",
    phase: 1,
  },
  ethereum: {
    id: "ethereum",
    kind: "evm",
    name: "Ethereum",
    evmChainId: 1,
    nativeSymbol: "ETH",
    geckoTerminalNetwork: "eth",
    dexscreenerChain: "ethereum",
    lifiChainKey: "ETH",
    mevProtection: "private-rpc", // Flashbots Protect RPC
    explorer: "https://etherscan.io",
    phase: 1,
  },
  base: {
    id: "base",
    kind: "evm",
    name: "Base",
    evmChainId: 8453,
    nativeSymbol: "ETH",
    geckoTerminalNetwork: "base",
    dexscreenerChain: "base",
    lifiChainKey: "BAS",
    mevProtection: "none", // sequencer-ordered; no public mempool, no protect RPC needed
    explorer: "https://basescan.org",
    phase: 1,
  },
  arbitrum: {
    id: "arbitrum",
    kind: "evm",
    name: "Arbitrum",
    evmChainId: 42161,
    nativeSymbol: "ETH",
    geckoTerminalNetwork: "arbitrum",
    dexscreenerChain: "arbitrum",
    lifiChainKey: "ARB",
    mevProtection: "none",
    explorer: "https://arbiscan.io",
    phase: 1,
  },
  avalanche: {
    id: "avalanche",
    kind: "evm",
    name: "Avalanche",
    evmChainId: 43114,
    nativeSymbol: "AVAX",
    geckoTerminalNetwork: "avax",
    dexscreenerChain: "avalanche",
    lifiChainKey: "AVA",
    mevProtection: "none",
    explorer: "https://snowtrace.io",
    phase: 1,
  },
  robinhood: {
    id: "robinhood",
    kind: "evm",
    name: "Robinhood",
    evmChainId: 4663, // mainnet live 2026-07-01; gas in ETH
    nativeSymbol: "ETH",
    // Data-provider slugs unverified on GT/DexScreener yet — feeds may be
    // empty until they index the chain; wallet/balances work regardless.
    geckoTerminalNetwork: "robinhood-chain",
    dexscreenerChain: "robinhoodchain",
    lifiChainKey: "RBH",
    mevProtection: "none", // FCFS sequencer, no public mempool
    explorer: "https://robinhoodchain.blockscout.com",
    phase: 1,
  },
};

// NOTE: keep PHASE_1_CHAINS in the intended UI order.
export const PHASE_1_CHAINS: ChainId[] = ["solana", "ethereum", "base", "arbitrum", "avalanche", "robinhood"];

export function getChain(id: string): ChainConfig {
  const c = CHAINS[id as ChainId];
  if (!c) throw new Error(`Unsupported chain: ${id}`);
  return c;
}

export function isEvm(id: ChainId): boolean {
  return CHAINS[id].kind === "evm";
}
