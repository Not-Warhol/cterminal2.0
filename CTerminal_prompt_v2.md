# CTerminal — Master Spec v2 (Prompt Otimizado)

> **Como usar este documento:** Este é o *master spec*. Não pedes a um LLM para construir tudo de uma vez. Em cada sessão, forneces: (1) este master spec como contexto, (2) o prompt da fase ativa (Secção 10), (3) o código existente. O LLM implementa apenas a fase ativa e respeita os critérios de aceitação.

---

## 1. Visão Geral

CTerminal é um terminal de trading all-in-one, non-custodial, multi-chain, para traders descentralizados do Crypto Twitter. Combina a velocidade de execução exigida por traders de memecoins com ferramentas profissionais de análise, descoberta de alpha e gestão de risco.

O utilizador deve conseguir: descobrir oportunidades (novos pares, smart money, narrativas), analisar tokens (dados on-chain + contexto social), executar com o melhor preço e proteção MEV, fazer bridge entre chains dentro da app, semi-automatizar estratégias, e gerir risco.

### 1.1 Não-objetivos (explícitos — não construir)

- Custódia de fundos, private keys ou seeds em qualquer circunstância
- Order book próprio ou matching engine — toda a execução é via aggregators/protocolos existentes
- Mobile app nativa no MVP (web responsiva apenas; Tauri desktop é pós-MVP)
- Índice social próprio do Twitter — apenas integração via API com descope realista (ver 4.6)
- Suporte a chains fora da lista da Secção 2 no MVP

### 1.2 Modelo de receita (obrigatório desde o dia 1)

- **Fee sobre swaps:** taxa configurável (default 0.5–1%) aplicada via platform fee do Jupiter (Solana) e fee do 1inch/rota própria (EVM), à la Photon/BullX
- **Hyperliquid:** builder codes oficiais para revenue share em perps
- **Tiers futuros:** funcionalidades premium (automação, copy trading) atrás de subscrição ou fee reduzida — arquitetura deve prever feature flags por tier

---

## 2. Chains Suportadas

| Fase | Chains | Notas |
|------|--------|-------|
| MVP (Fase 1) | Solana, Base, Ethereum, Arbitrum | Spot apenas |
| Fase 2 | Hyperliquid | Perps; módulo isolado (L1 própria, API própria — NÃO tratar como "mais uma EVM") |
| Fase 3 | Avalanche | EVM padrão via abstração existente |
| Fase 3+ | MegaETH | **Condicional:** só integrar após verificação do estado de mainnet e estabilidade de RPC/tooling à data da implementação |

A arquitetura EVM deve tornar a adição de uma nova chain EVM uma tarefa de < 1 dia (config de chain + RPC + endereços de contratos do aggregator).

---

## 3. Tech Stack

**Frontend**
- Next.js 15 (App Router) + TypeScript strict
- Tailwind CSS + shadcn/ui + Radix UI
- Wallets: wagmi + viem (EVM), @solana/wallet-adapter (Solana)
- Charts: TradingView Lightweight Charts (modo avançado) + GeckoTerminal iframe embeds (modo principal)
- Real-time: WebSocket client com reconnect/backoff e resubscrição automática
- Tauri v2 (desktop) apenas pós-MVP

**Backend**
- NestJS + TypeScript strict
- PostgreSQL + TimescaleDB (séries temporais: trades, candles, PnL de wallets)
- Redis (cache, rate limiting, pub/sub para fan-out de WebSockets)
- Workers: BullMQ (jobs de indexação, tracking, automação)
- API: tRPC (preferido) ou REST + WebSocket server

**Data & Execução**
- Solana: Helius (RPC + Webhooks + Enhanced Transactions)
- EVM: Alchemy (principal) com fallback QuickNode
- DEX data: DexScreener API + GeckoTerminal API v2
- Swaps: Jupiter (Solana; incluir Jupiter Limit Order + DCA), 1inch (EVM; incluir Limit Order Protocol)
- Bridging: LI.FI (principal), fallback Across + Socket
- Perps: SDK oficial Hyperliquid
- Security scoring: RugCheck (Solana) + GoPlus + Honeypot.is (EVM only) + heurísticas próprias

---

## 4. Funcionalidades (com decisões técnicas resolvidas)

### 4.1 Multi-Chain Wallet & Portfolio
- Conectar múltiplas wallets EVM e Solana na mesma sessão
- Portfolio unificado: visão agregada em USD + drill-down por chain e por wallet
- Preços via DexScreener/GeckoTerminal com cache Redis (ver Secção 6)

### 4.2 Modelo de execução e automação (DECISÃO ARQUITETURAL CENTRAL)

O produto é non-custodial. Isto cria dois modos de execução, e todo o código deve distinguir claramente entre eles:

**Modo Manual (MVP):** o utilizador assina cada transação na wallet. Todas as funcionalidades da Fase 1 funcionam neste modo.

**Modo Semi-Automático (Fase 2):** o backend deteta condições (limit atingido, smart money comprou, volume spike) e envia alerta push/in-app com botão de execução 1-click. O utilizador assina. Nenhuma transação ocorre sem assinatura explícita.

**Modo Automático (Fase 3+):** exige capacidade de assinar sem o utilizador presente:
- **Solana:** delegação limitada / programa próprio com allowances restritas, ou uso dos produtos nativos do Jupiter (Limit Order e DCA são executados pelos keepers do Jupiter — sem custódia nossa)
- **EVM:** smart accounts via ERC-4337 ou EIP-7702 com session keys com scopes limitados (tokens permitidos, valor máximo, expiração)
- **Hyperliquid:** agent wallets nativas da Hyperliquid (API wallets), que suportam exatamente este modelo

O "kill switch global" é, no MVP e Fase 2, um fluxo de liquidação assistida: a app prepara todas as transações de venda em todas as chains e o utilizador assina em sequência rápida (uma assinatura por chain no mínimo possível). Só se torna verdadeiramente automático com o Modo Automático ativo.

### 4.3 Trading Terminal
- Aggregator por chain: Jupiter (Solana), 1inch (EVM), com camada de abstração `SwapProvider` comum
- **MEV protection:** Jito tips/bundles na Solana; Flashbots Protect RPC (ou equivalente privado) nas EVM mainnet — documentar quais chains têm proteção real e mostrar isso na UI
- **Simulation obrigatória** antes de qualquer assinatura: `simulateTransaction` (Solana), `eth_call`/simulação Alchemy (EVM); mostrar balanços resultantes estimados
- Tipos de ordem:
  - Market: direto via aggregator
  - Limit: Jupiter Limit Order (Solana), 1inch Limit Order Protocol (EVM)
  - DCA: Jupiter DCA (Solana); nas EVM só no Modo Automático (Fase 3)
  - Grid e Snipe: Fase 3 (exigem Modo Automático + infra de keepers)
- Position sizing automático: input de risco % do portfolio → cálculo do tamanho da posição
- Botão **"Ape with Risk Check"**: simula a transação, mostra price impact, security score, % do portfolio, liquidez do par — e só depois permite assinar

### 4.4 Gráficos e Análise
- Modo principal: GeckoTerminal embed (iframe com tema customizado)
- Modo avançado: Lightweight Charts alimentado por candles da GeckoTerminal API + trades em tempo real (Helius webhooks na Solana; logs de swap via Alchemy nas EVM)
- Painel lateral fixo: Liquidity, Volume 5m/1h/24h, Buys/Sells ratio, Age, FDV/MCap, Top Traders, Security Score
- Markers no gráfico: trades de smart money wallets seguidas + movimentos grandes

### 4.5 In-App Bridging
- LI.FI como aggregator principal; fallback Across + Socket atrás de uma abstração `BridgeProvider`
- Fluxo "Bridge & Swap": origem (Chain A) → destino (Chain B), rota calculada automaticamente
- Mostrar sempre: tempo estimado, fees totais discriminadas, slippage, e nível de risco da rota
- **Máquina de estados explícita por operação de bridge:** `quoted → submitted → pending_source → pending_bridge → pending_dest → completed | failed | stuck` — com UI de tracking, retry quando aplicável e instruções de recuperação quando uma bridge fica presa
- Suporte Solana ↔ EVM e EVM ↔ EVM

### 4.6 Smart Money & Alpha Tracking
- Curadoria inicial: lista seed de wallets com histórico verificado (importável/editável)
- Tracking em tempo real: Helius webhooks (Solana), Alchemy webhooks/logs (EVM)
- PnL por wallet e por chain calculado a partir do histórico on-chain indexado em TimescaleDB
- Filtros: chain, narrativa (tags manuais + heurísticas), performance, tempo de hold

### 4.7 Social Alpha Context (descope realista)
- Integração X/Twitter API v2 — **assumir tier pago com rate limits apertados; todo o design deve minimizar chamadas (cache agressivo, fetch só quando o utilizador abre um token)**
- Mapeamento handle → wallet por camadas de confiança:
  1. **Verificado:** utilizadores do CTerminal que ligam o X à sua wallet por assinatura de mensagem
  2. **Auto-declarado:** wallet no perfil/bio, parse best-effort
  3. **Terceiros:** bases de wallet tags públicas quando disponíveis
- A UI mostra sempre o nível de confiança do mapeamento; nunca apresentar PnL "verificado" sem mapeamento de nível 1
- Leaderboard de callers apenas com mapeamentos de nível 1 e 2
- **Fallback obrigatório:** se a API do X estiver indisponível/fora de budget, a app degrada graciosamente (painel social escondido, resto intacto)

### 4.8 Copy Trading
- Fase 2: modo semi-automático (alerta + 1-click)
- Fase 3: automático via session keys/smart accounts (ver 4.2)
- Regras configuráveis: tamanho máx. por trade, exposição máx. por wallet seguida, tempo mínimo de hold, filtro por chains e narrativas

### 4.9 Automação e Bots
- Workers BullMQ; triggers: novo par, smart money entry, volume spike, condições de preço
- Builder baseado em regras (condição → ação); builder visual só depois do sistema de regras estar sólido
- Templates prontos: New Pair Snipe, Smart Money Copy, Volume Spike + Smart Money Entry, estratégias perps Hyperliquid
- Todas as ações respeitam o modo de execução ativo (4.2)

### 4.10 Risk Management
- Heatmap do portfolio por chain e narrativa
- Exposure limits com alertas (hard limits só no Modo Automático)
- Trailing stops: semi-auto na Fase 2, auto na Fase 3
- Kill switch: ver 4.2
- Stress test simples: cenários de drawdown -30/-50/-80% nos ativos ilíquidos

---

## 5. Arquitetura

- Frontend Next.js ↔ backend NestJS via tRPC + WebSockets
- **Assinatura exclusivamente no frontend** (ou via mecanismos do 4.2); o backend nunca vê material de chaves
- Abstrações obrigatórias (interfaces + implementações por provider):
  - `ChainAdapter` (EVM genérico via viem + adapter Solana + adapter Hyperliquid isolado)
  - `SwapProvider` (Jupiter, 1inch)
  - `BridgeProvider` (LI.FI, Across, Socket)
  - `DataProvider` (DexScreener, GeckoTerminal)
  - `SecurityProvider` (RugCheck, GoPlus, Honeypot.is)
- Indexação: workers consomem webhooks/logs → TimescaleDB; API lê da BD, nunca diretamente dos providers em hot path
- Real-time: providers → backend → Redis pub/sub → WebSocket fan-out para clientes (um stream por token/wallet subscrita; **nunca polling por cliente aos providers**)

## 6. Estratégia de dados, cache e rate limits (obrigatório)

- Todos os providers externos têm rate limits — o backend é o único que lhes fala; clientes falam só com o backend
- TTLs de cache Redis por tipo de dado (valores iniciais, ajustáveis por config):
  - Preço/candle do token ativo no ecrã: 2–5s via stream; 30s via cache para tokens em listas
  - Metadata de token (nome, supply, socials): 1h
  - Security score: 10min
  - Portfolio balances: 15–30s com invalidação após transação do próprio utilizador
- Circuit breakers por provider + fallback (ex.: DexScreener falha → GeckoTerminal)
- Budget de chamadas documentado por provider no código

## 7. Segurança

- Nunca guardar private keys/seeds; nunca pedir seed phrases na UI
- Simulation obrigatória antes de qualquer assinatura
- Session keys/smart accounts com scopes mínimos (tokens, valores máx., expiração) — Fase 3
- Avisos claros de risco: bridging, leverage, tokens com security score baixo, liquidez fina
- Validação server-side de todos os inputs; sanitização de dados vindos de APIs externas antes de renderizar
- **Compliance mínimo:** geo-blocking configurável para perps (Hyperliquid) em jurisdições restritas; disclaimer de risco; ToS. Não é aconselhamento financeiro.

## 8. Performance e UX (metas realistas)

- UI: interações < 100ms, gráficos e navegação < 200ms percebidos; skeletons/optimistic UI em tudo
- **Time-to-sign** (do clique ao popup da wallet com transação pronta e simulada): < 1s alvo
- Confirmação on-chain é a que a chain der (Solana ~1–2s, EVM L2 segundos, mainnet mais) — a UI mostra estados honestos, nunca finge instantaneidade
- Dark theme premium, estética de terminal profissional, densidade de informação alta mas legível
- Indicador permanente e inequívoco da chain ativa; mudar de chain nunca perde estado do ecrã
- Web responsiva (mobile-friendly); desktop-first na densidade

## 9. Qualidade, testing e observabilidade

- TypeScript strict em todo o lado; ESLint + Prettier; sem `any` não justificado
- Testes: unit para toda a lógica de pricing/sizing/PnL; integration para SwapProvider/BridgeProvider contra testnets ou mocks gravados; e2e dos fluxos críticos (connect → quote → simulate → sign)
- Observabilidade: logs estruturados, métricas de latência por provider, alertas de circuit breaker
- CI: lint + typecheck + testes em cada PR
- Decisões técnicas importantes documentadas em `docs/adr/` (Architecture Decision Records curtos)

---

## 10. Prompts por fase (usar UM de cada vez)

### Prompt Fase 1 — MVP
> Usando o master spec CTerminal v2 como contexto, implementa a Fase 1: Solana + Base + Ethereum + Arbitrum, spot trading em Modo Manual, GeckoTerminal embeds, portfolio multi-wallet, bridging básico via LI.FI, security scores, e o botão "Ape with Risk Check". Inclui as abstrações ChainAdapter/SwapProvider/BridgeProvider/DataProvider/SecurityProvider desde já. NÃO implementes: perps, copy trading, automação, Social Alpha, Modo Automático.
>
> **Critérios de aceitação:** conectar wallet Solana e EVM em simultâneo; ver portfolio agregado; abrir um token e ver gráfico + painel de dados + security score; obter quote, simular e executar um swap em cada uma das 4 chains; executar um bridge Base→Arbitrum e Solana→Base com tracking de estado até `completed`; fee de plataforma aplicada e verificável on-chain.

### Prompt Fase 2 — Perps + Smart Money + Bridging completo
> Implementa: módulo Hyperliquid isolado (perps, agent wallets, builder codes), smart money tracking cross-chain (webhooks → TimescaleDB → PnL por wallet), alertas semi-automáticos com execução 1-click, bridging com fallbacks Across/Socket e máquina de estados completa.
>
> **Critérios de aceitação:** abrir/fechar posição perp na Hyperliquid; seguir 3 wallets e receber alerta em tempo real de uma compra; ver PnL histórico por wallet; um bridge que falha no provider principal completa via fallback.

### Prompt Fase 3 — Automação + Copy Trading + Social + Avalanche
> Implementa: Modo Automático (smart accounts EVM, delegação Solana, agent wallets HL), copy trading automático com regras, sistema de automação por regras com os 4 templates, Social Alpha com os 3 níveis de confiança de mapeamento, e chain Avalanche. Avaliar MegaETH conforme estado de mainnet.
>
> **Critérios de aceitação:** copy trade executado sem intervenção dentro dos limites configurados; regra "New Pair Snipe" dispara e executa em testnet; painel social mostra nível de confiança; revogação de session key funciona instantaneamente.

### Prompt Fase 4 — Risk avançado + performance
> Implementa: heatmap, exposure limits automáticos, trailing stops automáticos, kill switch no Modo Automático, stress testing, e otimização de performance guiada por métricas (p95 de time-to-sign e de latência de dados).

---

## 11. Instruções finais para o LLM

- Implementa **apenas a fase ativa**; se algo da fase exigir infra de outra fase, cria a interface e um stub documentado
- Código limpo, tipado, modular; abstrações fortes para chains/aggregators/bridges
- Prioriza velocidade percebida e clareza para o trader; o fluxo "Bridge & Trade" é uma experiência de primeira classe
- Nunca assumas single-chain: multi-chain simultâneo é o default
- Em cada decisão técnica relevante, escreve um ADR curto em `docs/adr/`
- Se uma API/provider mencionado tiver mudado ou estiver indisponível, di-lo explicitamente e propõe alternativa — não inventes endpoints
