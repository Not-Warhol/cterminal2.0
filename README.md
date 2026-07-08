# CTerminal

Non-custodial, multi-chain trading terminal for decentralized Crypto Twitter
traders. **Fase 1 (MVP)** implementation of the [Master Spec v2](./CTerminal_prompt_v2.md):
Solana + Base + Ethereum + Arbitrum + Avalanche, spot trading in Modo Manual,
GeckoTerminal charts, multi-wallet portfolio, LI.FI bridging, security
scores, and the "Ape with Risk Check" flow.

```
cterminal/
├── packages/core     # chain registry, types, provider abstractions + implementations
│                     # (Jupiter, 1inch, LI.FI, DexScreener, GeckoTerminal, RugCheck, GoPlus),
│                     # risk-check logic, bridge state machine — zero runtime deps
├── apps/web          # Next.js 15 terminal UI + /api route handlers (Fase 1 backend, ADR-0002)
├── apps/api          # NestJS skeleton — Fase 2 home (indexing, smart money, streams)
└── docs/adr          # architecture decision records
```

## Setup

```bash
npm install                 # workspaces: core + web + api
cp .env.example apps/web/.env.local
npm run dev:web             # http://localhost:3000
```

Works keyless out of the box for: trending (GeckoTerminal), token data
(DexScreener), security scores (RugCheck/GoPlus), Solana quotes + swaps
(Jupiter lite API), bridge quotes (LI.FI), native balances (public RPC).

Add keys to unlock:

| Key | Unlocks |
|---|---|
| `ONEINCH_API_KEY` | EVM quotes + swap execution (portal.1inch.dev) |
| `LIFI_API_KEY` | higher bridge-quote rate limits (li.quest) |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | reliable EVM RPC (public RPCs rate-limit fast) |
| `NEXT_PUBLIC_HELIUS_API_KEY` | reliable Solana RPC + (Fase 2) webhooks |
| `NEXT_PUBLIC_FEE_ACCOUNT_*` + `NEXT_PUBLIC_PLATFORM_FEE_BPS` | platform revenue on swaps (spec §1.2) |

## Fase 1 acceptance criteria — status

- [x] Connect Solana + EVM wallets simultaneously (TopBar, two independent slots)
- [x] Aggregated portfolio view (native balances live; token discovery → Fase 2 indexer)
- [x] Token screen: GeckoTerminal chart + data rail + security score
- [x] Quote + simulate + execute swap — Solana (Jupiter build → simulate → sign → send) and EVM (1inch build server-side → chain switch → estimateGas simulation → sign) fully wired
- [x] Bridge quote with state-machine tracking model (LI.FI; execution/tracking loop → Fase 1.1)
- [x] Platform fee plumbing (Jupiter `platformFeeBps` + fee account; 1inch `fee`/`referrer`)

## Security model

Keys never leave the wallet. Every swap is simulated before the wallet
opens (`simulateTransaction` on Solana; `eth_call`/estimateGas on EVM).
Security scores are heuristic and the UI says so. Red risk verdicts demote
the confirm button but never hide it — the trader decides. Nothing here
is financial advice.

## Deploy (Vercel — fastest path to a live URL)

1. Push this repo to GitHub (`.gitignore` already excludes env files).
2. vercel.com → Add New Project → import the repo.
3. **Root Directory: `apps/web`** (Vercel auto-detects the npm workspace and installs from the repo root).
4. Add Environment Variables: `ONEINCH_API_KEY`, `LIFI_API_KEY`,
   `NEXT_PUBLIC_ALCHEMY_API_KEY`, `NEXT_PUBLIC_HELIUS_API_KEY`,
   `NEXT_PUBLIC_PLATFORM_FEE_BPS` (+ fee accounts when ready).
5. Deploy → live at `<project>.vercel.app`. Custom domain: Project →
   Settings → Domains, point your registrar's DNS at Vercel.

After it's live: restrict the Alchemy key (dashboard → key → allowed
domains) and the Helius key to your domain — both ship in the browser
bundle by design. Rotate any key that has ever been shared in plain text.

## Next (Fase 2)

Hyperliquid module (agent wallets + builder codes), smart money indexing
(Helius/Alchemy webhooks → TimescaleDB), Redis + WebSocket fan-out,
semi-automatic alerts with 1-click execution, bridge fallbacks
(Across/Socket). Module map: `apps/api/src/modules/README.md`.
