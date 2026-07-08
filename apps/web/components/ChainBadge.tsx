import { CHAINS, type ChainId } from "@cterminal/core";

const DOT: Record<ChainId, string> = {
  solana: "bg-[#9945FF]",
  ethereum: "bg-[#627EEA]",
  base: "bg-[#0052FF]",
  arbitrum: "bg-[#12AAFF]",
  avalanche: "bg-[#E84142]",
};

export function ChainBadge({ chain, active = true }: { chain: ChainId; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border border-line px-2 py-0.5 text-[11px] uppercase tracking-wider ${
        active ? "text-fg" : "text-fg-dim"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[chain]}`} />
      {CHAINS[chain].name}
    </span>
  );
}
