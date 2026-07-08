# ADR-0004 — Fase 2 execution, tracking, risk, social

**Status:** accepted

## EVM execution (§1.1)
1inch Swap API behind the existing `SwapProvider`. Full flow now includes
ERC-20 approval (checked against the router `spender`, approve max once),
so selling tokens works — not just buying with native. Mainnet swaps route
through Flashbots Protect RPC for MEV protection; L2s have no public mempool
so they broadcast normally and the UI says so. The 1inch key stays
server-side (`/api/swap-tx`); the browser only ever receives a built tx.

## Bridge tracking (§1.2)
`BridgeProvider.status()` polls LI.FI `/status`, mapped into our existing
`BridgeState` machine. A client hook (`useBridgeTracking`) polls with
backoff until a terminal state, then invalidates portfolio queries so
balances refresh automatically. EVM→EVM execution signs the LI.FI
`transactionRequest` via wagmi; Solana bridge execution is a documented
stub (Fase 2.1).

## Risk check (§1.3)
`runRiskCheck` now consumes structured `OnChainSignals` (holder
concentration, top-10 %, creator %, LP lock, holder count, age) extracted
by GoPlus/RugCheck into `SecurityReportV2`. Produces a 0–100 composite
risk score. Missing signals are never treated as safe. "Ape anyway"
remains on red.

## Share PnL (§1.4)
A stateless OG-image route (`/pnl`) renders a 1200×630 card from query
params, using `core.computePnl` as the single source of PnL math.
Shareable via link (OG unfurl) or X intent. On the token page it currently
uses a 24h-performance basis, clearly captioned; real per-trade cost basis
arrives with the trades indexer.

## Social / X posts (§1.5) — honest scope
`SocialProvider` abstraction + `TwitterProvider` stub. Two unsolved
problems shape this (master spec §4.7): the X API v2 is paid/rate-limited
(hence 5-min server cache, fetch-on-open only), and handle→wallet mapping
is largely unsolved. Every post carries a `MappingConfidence`; we NEVER
show a "verified" PnL without a tier-1 signature-linked mapping. Unconfigured
→ honest empty state, never fabricated engagement.
