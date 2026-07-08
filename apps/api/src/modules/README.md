# Fase 2 module map

| Module | Responsibility | Key deps |
|---|---|---|
| `IndexerModule` | Consume Helius webhooks (Solana) + Alchemy webhooks/logs (EVM), normalize swaps, write to TimescaleDB | pg, timescale |
| `SmartMoneyModule` | Followed-wallet registry, per-wallet/per-chain PnL from indexed trades, real-time buy/sell events | IndexerModule |
| `StreamModule` | Redis pub/sub → WebSocket fan-out; one channel per token/wallet; clients NEVER poll providers (spec §6) | redis, ws |
| `BridgeTrackingModule` | Persist bridge ops, advance the state machine from LI.FI status polling + chain confirmations, recovery flows for `stuck` | @cterminal/core stateMachine |
| `AlertsModule` | Semi-automatic mode (spec §4.2): condition → alert → 1-click execute deep link | StreamModule |

Every module consumes provider abstractions from `@cterminal/core` — no
direct external API calls outside `packages/core` implementations.
