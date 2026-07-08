/**
 * Server-side singletons for @cterminal/core providers.
 * Route handlers are the ONLY consumers of external APIs (spec §6);
 * `next: { revalidate }` on responses gives us the cache layer until
 * Redis arrives with apps/api in Fase 2.
 */
import {
  BridgeRouter,
  DataRouter,
  DexScreenerProvider,
  GeckoTerminalProvider,
  GoPlusProvider,
  JupiterProvider,
  LifiProvider,
  OneInchProvider,
  RugCheckProvider,
  SecurityRouter,
  SwapRouter,
  TwitterProvider,
} from "@cterminal/core";

const feeBps = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? 0);
// Jupiter only carries the fee when a Solana referral token account exists;
// otherwise swaps would fail with "feeAccount is required". All-or-nothing.
const hasSolFeeAccount = Boolean(process.env.NEXT_PUBLIC_FEE_ACCOUNT_SOLANA);

export const swapRouter = new SwapRouter([
  new JupiterProvider(feeBps, hasSolFeeAccount),
  new OneInchProvider(
    process.env.ONEINCH_API_KEY ?? "",
    feeBps,
    process.env.NEXT_PUBLIC_FEE_ACCOUNT_EVM,
  ),
]);

export const dataRouter = new DataRouter([
  new DexScreenerProvider(),
  new GeckoTerminalProvider(),
]);

export const trendingRouter = new DataRouter([
  new GeckoTerminalProvider(), // only GT has trending
  new DexScreenerProvider(),
]);

export const securityRouter = new SecurityRouter([
  new RugCheckProvider(),
  new GoPlusProvider(),
]);

export const bridgeRouter = new BridgeRouter([new LifiProvider(process.env.LIFI_API_KEY)]);

export const socialProvider = new TwitterProvider(process.env.X_BEARER_TOKEN);
