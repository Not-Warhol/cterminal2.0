import type { BridgeState } from "../types";

/**
 * Bridge operation state machine (spec §4.5).
 * Every bridge op is tracked through these states; illegal transitions
 * throw so bugs surface immediately instead of corrupting tracking.
 */
const TRANSITIONS: Record<BridgeState, BridgeState[]> = {
  quoted: ["submitted", "failed"],
  submitted: ["pending_source", "failed"],
  pending_source: ["pending_bridge", "failed", "stuck"],
  pending_bridge: ["pending_dest", "failed", "stuck"],
  pending_dest: ["completed", "failed", "stuck"],
  completed: [],
  failed: [],
  stuck: ["pending_bridge", "pending_dest", "completed", "failed"], // recovery paths
};

export function canTransition(from: BridgeState, to: BridgeState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(from: BridgeState, to: BridgeState): BridgeState {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal bridge transition ${from} → ${to}`);
  }
  return to;
}

export const TERMINAL_STATES: BridgeState[] = ["completed", "failed"];

/** Human-readable labels the UI uses — same vocabulary end-to-end. */
export const STATE_LABELS: Record<BridgeState, string> = {
  quoted: "Quoted",
  submitted: "Submitted",
  pending_source: "Confirming on source chain",
  pending_bridge: "Bridging",
  pending_dest: "Arriving on destination",
  completed: "Completed",
  failed: "Failed",
  stuck: "Stuck — action needed",
};
