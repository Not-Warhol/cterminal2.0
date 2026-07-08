import type {
  OnChainSignals,
  RiskCheckInput,
  RiskCheckResult,
  SecurityFinding,
} from "../types";

/**
 * "Ape with Risk Check" — enhanced in Fase 2 with real on-chain signals.
 *
 * Combines simulation output (quote), market data, the security report AND
 * structured on-chain signals (holder concentration, LP lock, age) into a
 * verdict + composite risk score + suggested max size (spec Fase 2 §1.3).
 *
 * Design rule: a MISSING signal is never treated as safe. Unknown holder
 * concentration adds a soft warning, not a green light. The trader always
 * keeps the "Ape anyway" escape — this function informs, it does not block.
 */
export function runRiskCheck(input: RiskCheckInput): RiskCheckResult {
  const findings: SecurityFinding[] = [];
  const { quote, market, security, portfolioValueUsd, tradeValueUsd, maxRiskPct } = input;
  const signals: OnChainSignals | null = security?.signals ?? null;
  let risk = 0; // accumulates 0..100

  // 1. Security score + provider findings
  if (!security) {
    findings.push({ label: "Security score unavailable", severity: "warn" });
    risk += 15;
  } else {
    findings.push(...security.findings);
    if (security.score < 30) risk += 45;
    else if (security.score < 60) risk += 20;
  }

  // 2. On-chain concentration (the Fase 2 upgrade)
  if (signals) {
    if (signals.topHolderPct !== null) {
      if (signals.topHolderPct > 25) risk += 30;
      else if (signals.topHolderPct > 10) risk += 12;
    } else {
      findings.push({ label: "Holder distribution unknown", severity: "warn" });
      risk += 8;
    }
    if (signals.top10Pct !== null && signals.top10Pct > 60)
      findings.push({ label: `Top 10 hold ${signals.top10Pct.toFixed(0)}%`, severity: "warn" });
    if (signals.lpLocked === false) risk += 15;
    if (signals.lpLocked === null) risk += 5;
    if (signals.holderCount !== null && signals.holderCount < 100)
      findings.push({ label: `Only ${signals.holderCount} holders`, severity: "warn" });
  }

  // 3. Price impact (from simulation/quote)
  if (quote.priceImpactPct !== null) {
    if (quote.priceImpactPct > 5) risk += 25;
    else if (quote.priceImpactPct > 1.5) risk += 10;
  }

  // 4. Liquidity vs. trade size + age
  if (market) {
    if (market.liquidityUsd < 10_000) risk += 25;
    else if (tradeValueUsd > market.liquidityUsd * 0.02)
      findings.push({ label: "Trade > 2% of pool liquidity", severity: "warn" });
    const ageH =
      signals?.ageHours ??
      (market.pairCreatedAt ? (Date.now() - market.pairCreatedAt) / 3.6e6 : null);
    if (ageH !== null && ageH < 24) {
      findings.push({ label: `Pair is ${ageH.toFixed(0)}h old`, severity: "warn" });
      risk += 10;
    }
  }

  // 5. Portfolio exposure
  const suggestedMaxTradeUsd = (portfolioValueUsd * maxRiskPct) / 100;
  if (portfolioValueUsd > 0 && tradeValueUsd > suggestedMaxTradeUsd) {
    findings.push({
      label: `Exceeds ${maxRiskPct}% risk budget ($${suggestedMaxTradeUsd.toFixed(0)})`,
      severity: "warn",
    });
    risk += 8;
  }

  const riskScore = Math.min(100, Math.round(risk));
  const hasDanger = findings.some((f) => f.severity === "danger");
  const verdict =
    hasDanger || riskScore >= 60 ? "red" : riskScore >= 30 ? "yellow" : "green";

  return { verdict, findings, suggestedMaxTradeUsd, riskScore, signals };
}

/** Position sizing: risk % of portfolio → trade size in USD. */
export function positionSizeUsd(portfolioValueUsd: number, riskPct: number): number {
  return Math.max(0, (portfolioValueUsd * riskPct) / 100);
}
