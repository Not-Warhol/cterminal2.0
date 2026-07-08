# ADR-0002 — Fase 1 data proxying lives in Next.js route handlers

**Status:** accepted · **Spec:** §5, §6

## Context
The spec mandates NestJS + Redis + TimescaleDB for the backend. Fase 1,
however, needs only: proxy + cache for DexScreener/GeckoTerminal/security
APIs, quote passthrough (Jupiter/1inch/LI.FI), and secret keeping
(1inch key). It needs no persistence and no webhooks yet.

## Decision
Fase 1 uses Next.js route handlers (`apps/web/app/api/*`) with
`revalidate` TTLs mirroring the spec §6 cache table. `apps/api` (NestJS)
boots as a skeleton with the Fase 2 module map. All provider logic lives
in `@cterminal/core`, so moving a route from Next to Nest is a ~10-line
controller, not a rewrite.

## Consequences
One process to run in Fase 1; zero infra until indexing demands it; the
"backend is the only thing that talks to providers" rule (spec §6) holds
from day one because browsers only ever hit `/api/*`.
