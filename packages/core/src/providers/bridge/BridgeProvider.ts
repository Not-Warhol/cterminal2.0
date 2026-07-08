import type { BridgeQuote, BridgeQuoteRequest, BridgeStatusRequest, BridgeStatusResult } from "../../types";

/**
 * BridgeProvider — LI.FI is primary; Across/Socket are Fase 2 fallbacks.
 * The router tries providers in order and returns the first good quote
 * (circuit-breaker per provider lives in apps/api in Fase 2).
 */
export interface BridgeProvider {
  readonly id: "lifi" | "across" | "socket";
  quote(req: BridgeQuoteRequest): Promise<BridgeQuote>;
  /** Poll the live status of an in-flight bridge (spec Fase 2 §1.2). */
  status?(req: BridgeStatusRequest): Promise<BridgeStatusResult>;
}

export class BridgeRouter {
  constructor(private readonly providers: BridgeProvider[]) {}

  async quote(req: BridgeQuoteRequest): Promise<BridgeQuote> {
    const errors: string[] = [];
    for (const p of this.providers) {
      try {
        return await p.quote(req);
      } catch (e) {
        errors.push(`${p.id}: ${(e as Error).message}`);
      }
    }
    throw new Error(`All bridge providers failed — ${errors.join(" | ")}`);
  }

  status(req: BridgeStatusRequest): Promise<BridgeStatusResult> {
    const p = this.providers.find((x) => typeof x.status === "function");
    if (!p || !p.status) throw new Error("No bridge provider supports status polling");
    return p.status(req);
  }
}
