"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  TERMINAL_STATES,
  type BridgeState,
  type BridgeStatusRequest,
  type BridgeStatusResult,
} from "@cterminal/core";

/**
 * Polls /api/bridge-status until the transfer reaches a terminal state,
 * then invalidates portfolio queries so balances refresh automatically
 * (spec Fase 2 §1.2). Backs off gently; stops on completed/failed.
 */
export function useBridgeTracking(req: BridgeStatusRequest | null) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<BridgeStatusResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!req) return;
    let cancelled = false;
    let delay = 4000;

    async function poll() {
      try {
        const r = await fetch("/api/bridge-status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(req),
        });
        const body = (await r.json()) as { status?: BridgeStatusResult };
        if (cancelled || !body.status) return schedule();
        setStatus(body.status);
        if (TERMINAL_STATES.includes(body.status.state as BridgeState)) {
          // refresh balances on both chains
          void qc.invalidateQueries({ queryKey: ["solBalance"] });
          void qc.invalidateQueries({ queryKey: ["token"] });
          return;
        }
        schedule();
      } catch {
        schedule();
      }
    }
    function schedule() {
      if (cancelled) return;
      delay = Math.min(delay * 1.3, 15000);
      timer.current = setTimeout(poll, delay);
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [req, qc]);

  return status;
}
