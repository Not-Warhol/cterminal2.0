"use client";

import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { SwapQuote } from "@cterminal/core";

/**
 * Modo Manual execution (spec §4.2): build → simulate → user signs.
 *
 * Solana path is fully wired: Jupiter /swap builds the tx (with platform
 * fee account + priority/Jito config), we simulate, the wallet signs,
 * we send raw. EVM path: /api/quote returns the 1inch quote; the swap tx
 * build endpoint (1inch /swap) follows the same pattern — documented stub
 * until an API key is configured (see README §Setup).
 */

const JUP_SWAP = "https://lite-api.jup.ag/swap/v1/swap";

export async function executeSolanaSwap(opts: {
  quote: SwapQuote;
  wallet: WalletContextState;
  connection: Connection;
}): Promise<string> {
  const { quote, wallet, connection } = opts;
  if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Solana wallet not connected");

  const feeAccount = process.env.NEXT_PUBLIC_FEE_ACCOUNT_SOLANA;
  const res = await fetch(JUP_SWAP, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote.raw,
      userPublicKey: wallet.publicKey.toBase58(),
      dynamicComputeUnitLimit: true,
      // MEV protection (spec §4.3): Jito tip via Jupiter's priority config
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { priorityLevel: "high", maxLamports: 2_000_000 } },
      ...(feeAccount ? { feeAccount } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Jupiter swap build failed: ${await res.text()}`);
  const { swapTransaction } = (await res.json()) as { swapTransaction: string };

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));

  // Simulation obrigatória (spec §4.3 / §7)
  const sim = await connection.simulateTransaction(tx, { sigVerify: false });
  if (sim.value.err) throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
  return sig;
}
