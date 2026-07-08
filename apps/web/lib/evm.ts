"use client";

import { erc20Abi, maxUint256, type Address } from "viem";
import type { Config } from "wagmi";
import {
  readContract,
  sendTransaction,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import type { EvmSwapTx } from "@cterminal/core";

const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase();

/**
 * EVM execution (spec Fase 2 §1.1) — complete flow, now with ERC-20
 * approvals so selling tokens works, not just buying with native.
 *
 * Flow: ensure chain → (if selling ERC-20) check allowance → approve if
 * needed → send the 1inch-built swap tx → wait for receipt.
 *
 * MEV note: 1inch on Ethereum mainnet can be broadcast via a private RPC
 * (Flashbots Protect) configured in wagmi's transport. On L2s (Base,
 * Arbitrum) there is no public mempool to protect against, so we broadcast
 * normally and the UI says so honestly.
 */
export async function executeEvmSwap(opts: {
  config: Config;
  chainId: number;
  swapTx: EvmSwapTx;
  /** the token being SOLD (input). Native = no approval needed. */
  inputToken: string;
  amountIn: string;
  owner: Address;
  onStep?: (s: "switching" | "approving" | "swapping" | "confirming") => void;
}): Promise<`0x${string}`> {
  const { config, chainId, swapTx, inputToken, amountIn, owner, onStep } = opts;

  onStep?.("switching");
  await switchChain(config, { chainId });

  // ERC-20 input needs allowance to the 1inch router (swapTx.to)
  if (inputToken.toLowerCase() !== NATIVE) {
    const spender = swapTx.to as Address;
    const allowance = await readContract(config, {
      chainId,
      address: inputToken as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    });
    if (allowance < BigInt(amountIn)) {
      onStep?.("approving");
      const approveHash = await writeContract(config, {
        chainId,
        address: inputToken as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, maxUint256],
      });
      await waitForTransactionReceipt(config, { chainId, hash: approveHash });
    }
  }

  onStep?.("swapping");
  const hash = await sendTransaction(config, {
    chainId,
    to: swapTx.to as Address,
    data: swapTx.data as `0x${string}`,
    value: BigInt(swapTx.value),
  });
  onStep?.("confirming");
  await waitForTransactionReceipt(config, { chainId, hash });
  return hash;
}
