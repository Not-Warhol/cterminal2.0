import { NextRequest, NextResponse } from "next/server";
import type { ChainId } from "@cterminal/core";

export const revalidate = 20; // spec §6: balances ~20s

/**
 * Unified portfolio token discovery (spec Fase 2 request):
 *  - EVM: Alchemy Data API (tokens + prices in one call across networks)
 *  - Solana: Helius DAS searchAssets (fungibles with price_info)
 * Each position carries a `suspicious` flag (heuristic scam/spam detection)
 * so the UI can hide junk by default. Keys stay server-side.
 */

interface Position {
  chain: ChainId;
  address: string; // token contract / mint
  symbol: string;
  name: string;
  amountUi: number;
  priceUsd: number | null;
  valueUsd: number | null;
  logo?: string;
  suspicious: boolean;
}

const ALCHEMY_NET: Partial<Record<ChainId, string>> = {
  ethereum: "eth-mainnet",
  base: "base-mainnet",
  arbitrum: "arb-mainnet",
  avalanche: "avax-mainnet",
};
const NET_TO_CHAIN: Record<string, ChainId> = {
  "eth-mainnet": "ethereum",
  "base-mainnet": "base",
  "arb-mainnet": "arbitrum",
  "avax-mainnet": "avalanche",
};

const SCAM_WORDS = /(https?:|www\.|\.com|\.xyz|\.io|claim|reward|airdrop|voucher|visit|\$ ?free|t\.me\/)/i;

/**
 * Heuristic scam detection. A missing price is NOT enough to flag — many
 * legit small-caps lack an Alchemy price. We flag only clear scam signals:
 * scammy name/symbol (URLs, "claim", "airdrop"…), a missing/garbage symbol,
 * or priced dust worth under $0.50.
 */
function isSuspicious(p: { symbol: string; name: string; valueUsd: number | null }): boolean {
  if (SCAM_WORDS.test(p.symbol) || SCAM_WORDS.test(p.name)) return true;
  if (!p.symbol || p.symbol === "?" || p.symbol.length > 15) return true;
  if (p.valueUsd !== null && p.valueUsd < 0.5) return true; // priced dust
  return false;
}

async function evmPositions(address: string, apiKey: string): Promise<Position[]> {
  const res = await fetch(`https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/by-address`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      addresses: [{ address, networks: Object.values(ALCHEMY_NET) }],
      withMetadata: true,
      withPrices: true,
    }),
  });
  if (!res.ok) throw new Error(`Alchemy ${res.status}`);
  const body = (await res.json()) as {
    data?: {
      tokens?: {
        network: string;
        tokenAddress: string | null;
        tokenBalance: string;
        tokenMetadata?: { symbol?: string; name?: string; decimals?: number; logo?: string };
        tokenPrices?: { value: string }[];
      }[];
    };
  };
  const out: Position[] = [];
  for (const t of body.data?.tokens ?? []) {
    const chain = NET_TO_CHAIN[t.network];
    if (!chain || !t.tokenAddress) continue;
    const dec = t.tokenMetadata?.decimals ?? 18;
    const amountUi = Number(BigInt(t.tokenBalance || "0")) / 10 ** dec;
    if (amountUi <= 0) continue;
    const priceUsd = t.tokenPrices?.[0] ? Number(t.tokenPrices[0].value) : null;
    const valueUsd = priceUsd !== null ? amountUi * priceUsd : null;
    const symbol = t.tokenMetadata?.symbol ?? "?";
    const name = t.tokenMetadata?.name ?? "";
    out.push({
      chain, address: t.tokenAddress, symbol, name, amountUi, priceUsd, valueUsd,
      logo: t.tokenMetadata?.logo,
      suspicious: isSuspicious({ symbol, name, valueUsd }),
    });
  }
  return out;
}

async function solanaPositions(owner: string, apiKey: string): Promise<Position[]> {
  const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "cterminal", method: "searchAssets",
      params: { ownerAddress: owner, tokenType: "fungible", page: 1, limit: 200, options: { showZeroBalance: false } },
    }),
  });
  if (!res.ok) throw new Error(`Helius ${res.status}`);
  const body = (await res.json()) as {
    result?: { items?: {
      id: string;
      content?: { metadata?: { symbol?: string; name?: string } };
      token_info?: { balance?: number; decimals?: number; symbol?: string; price_info?: { price_per_token?: number; total_price?: number } };
    }[] };
  };
  const out: Position[] = [];
  for (const it of body.result?.items ?? []) {
    const ti = it.token_info;
    if (!ti || !ti.balance) continue;
    const dec = ti.decimals ?? 0;
    const amountUi = ti.balance / 10 ** dec;
    if (amountUi <= 0) continue;
    const priceUsd = ti.price_info?.price_per_token ?? null;
    const valueUsd = ti.price_info?.total_price ?? (priceUsd !== null ? amountUi * priceUsd : null);
    const symbol = ti.symbol ?? it.content?.metadata?.symbol ?? "?";
    const name = it.content?.metadata?.name ?? "";
    out.push({
      chain: "solana", address: it.id, symbol, name, amountUi, priceUsd, valueUsd,
      suspicious: isSuspicious({ symbol, name, valueUsd }),
    });
  }
  return out;
}

const NATIVE_META: { chain: ChainId; symbol: string; coingecko: string; rpc: (a: string) => Promise<number> }[] = [];

async function evmNative(rpcUrl: string, address: string): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
  });
  const b = (await res.json()) as { result?: string };
  return b.result ? Number(BigInt(b.result)) / 1e18 : 0;
}

async function nativePositions(evm: string | null, sol: string | null, alchemy?: string, helius?: string): Promise<Position[]> {
  const out: Position[] = [];
  // prices (keyless, cached by route revalidate)
  let px: Record<string, { usd: number }> = {};
  try {
    px = (await (await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,avalanche-2,solana&vs_currencies=usd",
    )).json()) as Record<string, { usd: number }>;
  } catch { /* prices null-out below */ }
  const p = (id: string) => px[id]?.usd ?? null;

  const jobs: Promise<void>[] = [];
  if (evm && alchemy) {
    const evmChains: { chain: ChainId; url: string; symbol: string; gecko: string }[] = [
      { chain: "ethereum", url: `https://eth-mainnet.g.alchemy.com/v2/${alchemy}`, symbol: "ETH", gecko: "ethereum" },
      { chain: "base", url: `https://base-mainnet.g.alchemy.com/v2/${alchemy}`, symbol: "ETH", gecko: "ethereum" },
      { chain: "arbitrum", url: `https://arb-mainnet.g.alchemy.com/v2/${alchemy}`, symbol: "ETH", gecko: "ethereum" },
      { chain: "avalanche", url: `https://avax-mainnet.g.alchemy.com/v2/${alchemy}`, symbol: "AVAX", gecko: "avalanche-2" },
      { chain: "robinhood", url: "https://rpc.mainnet.chain.robinhood.com", symbol: "ETH", gecko: "ethereum" },
    ];
    for (const c of evmChains) {
      jobs.push((async () => {
        try {
          const amt = await evmNative(c.url, evm);
          if (amt > 0) {
            const priceUsd = p(c.gecko);
            out.push({ chain: c.chain, address: "native", symbol: c.symbol, name: `${c.symbol} (native)`, amountUi: amt, priceUsd, valueUsd: priceUsd !== null ? amt * priceUsd : null, suspicious: false });
          }
        } catch { /* skip chain */ }
      })());
    }
  }
  if (sol && helius) {
    jobs.push((async () => {
      try {
        const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${helius}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [sol] }),
        });
        const b = (await res.json()) as { result?: { value?: number } };
        const amt = (b.result?.value ?? 0) / 1e9;
        if (amt > 0) {
          const priceUsd = p("solana");
          out.push({ chain: "solana", address: "native", symbol: "SOL", name: "SOL (native)", amountUi: amt, priceUsd, valueUsd: priceUsd !== null ? amt * priceUsd : null, suspicious: false });
        }
      } catch { /* skip */ }
    })());
  }
  await Promise.all(jobs);
  return out;
}

export async function GET(req: NextRequest) {
  const evm = req.nextUrl.searchParams.get("evm");
  const sol = req.nextUrl.searchParams.get("sol");
  const alchemy = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const helius = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

  const positions: Position[] = [];
  const errors: string[] = [];
  await Promise.all([
    (async () => { if (evm && alchemy) { try { positions.push(...(await evmPositions(evm, alchemy))); } catch (e) { errors.push(`EVM tokens: ${(e as Error).message}`); } } })(),
    (async () => { if (sol && helius) { try { positions.push(...(await solanaPositions(sol, helius))); } catch (e) { errors.push(`Solana tokens: ${(e as Error).message}`); } } })(),
    (async () => { try { positions.push(...(await nativePositions(evm, sol, alchemy, helius))); } catch (e) { errors.push(`Natives: ${(e as Error).message}`); } })(),
  ]);

  positions.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  const totalUsd = positions.filter((p) => !p.suspicious).reduce((a, p) => a + (p.valueUsd ?? 0), 0);
  return NextResponse.json({ positions, totalUsd, errors });
}
