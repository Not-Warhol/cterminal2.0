import type { SecurityReportV2 } from "../../types";
import type { ChainId } from "../../chains";

/**
 * SecurityProvider — RugCheck (Solana) + GoPlus (EVM).
 * Reports are heuristic. The UI must never present a score as a
 * guarantee; scores gate the "Ape with Risk Check" flow (spec §4.3).
 */
export interface SecurityProvider {
  readonly id: "rugcheck" | "goplus";
  supports(chain: ChainId): boolean;
  report(chain: ChainId, address: string): Promise<SecurityReportV2>;
}

export class SecurityRouter {
  constructor(private readonly providers: SecurityProvider[]) {}
  async report(chain: ChainId, address: string): Promise<SecurityReportV2 | null> {
    const p = this.providers.find((x) => x.supports(chain));
    if (!p) return null;
    try {
      return await p.report(chain, address);
    } catch {
      return null; // degrade gracefully — UI shows "score unavailable" warning
    }
  }
}
