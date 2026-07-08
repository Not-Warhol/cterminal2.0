# ADR-0001 — Three execution modes instead of "automation everywhere"

**Status:** accepted · **Spec:** §4.2

## Context
The product is non-custodial, but several features (kill switch, copy
trading, DCA/grid, snipes) imply signing without the user present. EOA
wallets via wagmi cannot do that; pretending otherwise leads to insecure
hacks (storing keys) or dead features.

## Decision
Every action is tagged with a required execution mode:
1. **Manual (Fase 1):** user signs each tx. All Fase 1 features work here.
2. **Semi-automatic (Fase 2):** backend detects conditions → alert →
   1-click execute; user still signs.
3. **Automatic (Fase 3):** EVM smart accounts (ERC-4337 / EIP-7702 session
   keys), Jupiter keeper products on Solana (Limit/DCA), Hyperliquid agent
   wallets.

The kill switch is *assisted liquidation* until mode 3 exists: the app
pre-builds every sell tx and the user signs per chain in rapid sequence.

## Consequences
No feature ships with a custody compromise; UI copy is honest about what
runs unattended; mode 3 is additive, not a rewrite.
