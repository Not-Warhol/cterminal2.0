export function fmtUsd(n: number | null | undefined, compact = true): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (compact && Math.abs(n) >= 1000) {
    return "$" + Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(n);
  }
  const digits = Math.abs(n) < 0.01 ? 8 : Math.abs(n) < 1 ? 5 : 2;
  return "$" + n.toLocaleString("en", { maximumFractionDigits: digits });
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(2) + "%";
}

export function fmtAge(unixMs: number | null): string {
  if (!unixMs) return "—";
  const h = (Date.now() - unixMs) / 3.6e6;
  if (h < 1) return Math.round(h * 60) + "m";
  if (h < 48) return Math.round(h) + "h";
  return Math.round(h / 24) + "d";
}

export function short(addr: string, n = 4): string {
  return addr.length > 2 * n + 2 ? addr.slice(0, n + 2) + "…" + addr.slice(-n) : addr;
}
