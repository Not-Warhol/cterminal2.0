export function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "up" | "down" | "amber";
}) {
  const color =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "amber" ? "text-amber" : "text-fg";
  return (
    <div className="border border-line bg-ink-900 px-3 py-2">
      <div className="cell-label">{label}</div>
      <div className={`mt-0.5 text-sm ${color}`}>{value}</div>
    </div>
  );
}
