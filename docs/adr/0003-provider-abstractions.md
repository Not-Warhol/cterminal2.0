# ADR-0003 — Interface-per-capability provider abstractions

**Status:** accepted · **Spec:** §5

`SwapProvider`, `BridgeProvider`, `DataProvider`, `SecurityProvider` are
plain TypeScript interfaces in `@cterminal/core` with a thin Router each
(chain dispatch, ordered fallback). Implementations are fetch-based with
zero runtime dependencies so they run identically in Next route handlers,
NestJS services, workers and tests.

Adding Avalanche took exactly one entry in `chains.ts` plus a wagmi transport — the mechanism works. Adding Across =
one class implementing `BridgeProvider` + registering it in the router.
Hyperliquid deliberately gets its own adapter module in Fase 2 — it is
its own L1 with its own signing model and is never treated as "another
EVM chain".
