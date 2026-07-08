import type { ChainId } from "./chains";

/** A token on a specific chain. `address` is mint (Solana) or contract (EVM). */
export interface TokenRef {
  chain: ChainId;
  address: string;
  symbol?: string;
  decimals?: number;
}

export interface TokenMarketData {
  chain: ChainId;
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  liquidityUsd: number;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  volume: { m5: number; h1: number; h24: number };
  txns: { m5: { buys: number; sells: number }; h1: { buys: number; sells: number } };
  priceChange: { m5: number; m15?: number; m30?: number; h1: number; h6?: number; h24: number };
  pairAddress: string;
  pairCreatedAt: number | null; // unix ms
  dex: string;
  imageUrl?: string;
}

/** Amounts are raw base-unit strings to avoid float loss. */
export interface SwapQuoteRequest {
  chain: ChainId;
  inputToken: string;
  outputToken: string;
  amountIn: string;
  slippageBps: number;
  /** wallet that will sign — needed by 1inch for tx building */
  taker?: string;
}

export interface SwapQuote {
  provider: "jupiter" | "1inch";
  chain: ChainId;
  amountIn: string;
  amountOut: string;
  minAmountOut: string;
  priceImpactPct: number | null;
  platformFeeBps: number;
  route: string[]; // human-readable hop labels
  /** Opaque payload the frontend passes back to build/sign the tx */
  raw: unknown;
}

export type BridgeState =
  | "quoted"
  | "submitted"
  | "pending_source"
  | "pending_bridge"
  | "pending_dest"
  | "completed"
  | "failed"
  | "stuck";

export interface BridgeQuoteRequest {
  fromChain: ChainId;
  toChain: ChainId;
  fromToken: string;
  toToken: string;
  amountIn: string;
  fromAddress?: string;
  toAddress?: string;
  slippageBps: number;
}

export interface BridgeQuote {
  provider: "lifi" | "across" | "socket";
  fromChain: ChainId;
  toChain: ChainId;
  amountIn: string;
  estimatedAmountOut: string;
  estimatedSeconds: number;
  feesUsd: number;
  gasUsd: number;
  tool: string; // underlying bridge (e.g. "stargate", "across")
  raw: unknown;
}

export type SecuritySeverity = "ok" | "warn" | "danger";

export interface SecurityFinding {
  label: string;
  severity: SecuritySeverity;
  detail?: string;
}

export interface SecurityReport {
  chain: ChainId;
  address: string;
  /** 0–100, higher is safer. Heuristic — never presented as a guarantee. */
  score: number;
  findings: SecurityFinding[];
  source: string[];
}

export interface PortfolioPosition {
  chain: ChainId;
  wallet: string;
  token: TokenRef;
  amountRaw: string;
  amountUi: number;
  priceUsd: number | null;
  valueUsd: number | null;
}

export interface RiskCheckInput {
  quote: SwapQuote;
  market: TokenMarketData | null;
  security: SecurityReportV2 | null;
  portfolioValueUsd: number;
  tradeValueUsd: number;
  maxRiskPct: number; // e.g. 2 => 2% of portfolio
}

export interface RiskCheckResult {
  verdict: "green" | "yellow" | "red";
  findings: SecurityFinding[];
  suggestedMaxTradeUsd: number;
  /** 0–100 composite risk score, higher = riskier (distinct from safety score) */
  riskScore: number;
  /** the on-chain signals surfaced to the trader, for the detail panel */
  signals: OnChainSignals | null;
}

// ─────────────────────────────────────────────────────────────
// Fase 2 additions
// ─────────────────────────────────────────────────────────────

/**
 * On-chain risk signals extracted from security providers.
 * These feed the enhanced Risk Check (spec Fase 2 §1.3). All optional —
 * providers fill what they can; missing = "unknown", never assumed safe.
 */
export interface OnChainSignals {
  holderCount: number | null;
  /** % of supply held by the single largest non-LP/non-burn holder */
  topHolderPct: number | null;
  /** % of supply held by top 10 holders combined */
  top10Pct: number | null;
  /** % of supply still held by the creator */
  creatorPct: number | null;
  /** Is liquidity locked or burned? null = unknown */
  lpLocked: boolean | null;
  /** Number of LP holders (proxy for lock/burn health on EVM) */
  lpHolderCount: number | null;
  /** Pair/token age in hours, if known */
  ageHours: number | null;
}

/** SecurityReport gains structured on-chain signals in Fase 2. */
export interface SecurityReportV2 extends SecurityReport {
  signals: OnChainSignals;
}

// ── Bridge status tracking (spec Fase 2 §1.2) ──────────────────

export interface BridgeStatusRequest {
  /** underlying bridge tool from the quote (e.g. "across", "stargate") */
  tool: string;
  fromChain: ChainId;
  toChain: ChainId;
  /** source-chain tx hash returned after the user signs */
  txHash: string;
}

export interface BridgeStatusResult {
  state: BridgeState;
  /** destination-chain tx hash once it lands */
  destTxHash: string | null;
  /** substatus message straight from the bridge, shown verbatim in the UI */
  message: string | null;
  raw: unknown;
}

// ── PnL / Share card (spec Fase 2 §1.4) ────────────────────────

export interface TradeRecord {
  chain: ChainId;
  tokenAddress: string;
  tokenSymbol: string;
  /** entry/exit in USD price terms */
  entryPriceUsd: number;
  exitPriceUsd: number;
  /** position size at entry, in USD */
  sizeUsd: number;
  openedAt: number; // unix ms
  closedAt: number; // unix ms
  txHash: string;
}

export interface PnlSummary {
  pnlUsd: number;
  pnlPct: number;
  holdMs: number;
  isProfit: boolean;
}

// ── Social / X posts (spec Fase 2 §1.5, master spec §4.7) ──────

/**
 * Confidence tier of a handle→wallet mapping. We NEVER present a "verified"
 * PnL without a tier-1 mapping (master spec §4.7). This is the honest core
 * of the feature: most callers cannot be on-chain verified, and the UI says so.
 */
export type MappingConfidence = "verified" | "declared" | "none";

export type SocialFilter = "all" | "kol" | "smart_money";

export interface SocialPost {
  id: string;
  author: { handle: string; name: string; followers: number; avatarUrl?: string };
  text: string;
  createdAt: number; // unix ms
  metrics: { likes: number; reposts: number; replies: number; views: number };
  url: string;
  /** on-chain link, when a mapping exists */
  mapping: {
    confidence: MappingConfidence;
    wallet: string | null;
    /** realized/unrealized PnL on THIS token, only meaningful when verified */
    tokenPnlUsd: number | null;
  };
  tags: SocialFilter[];
}

/** A single on-chain trade (for the Whales / large-trades view, spec Fase 3). */
export interface TokenTrade {
  kind: "buy" | "sell";
  volumeUsd: number;
  priceUsd: number;
  amountToken: number;
  wallet: string;
  txHash: string;
  timestamp: number; // unix ms
}
