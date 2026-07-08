"use client";

import { useEffect, useState } from "react";
import { MoversWidget, GainersLosersWidget } from "@/components/widgets/MoversWidget";
import { MarketAnalysisWidget } from "@/components/widgets/MarketAnalysisWidget";
import { TweetsWidget } from "@/components/widgets/TweetsWidget";
import { QuickSwapWidget } from "@/components/widgets/QuickSwapWidget";
import { MiniBridgeWidget } from "@/components/widgets/MiniBridgeWidget";
import { AlertsWidget } from "@/components/widgets/AlertsWidget";

/**
 * Dashboard homepage (spec Fase 2). A customizable widget board: the trader
 * picks which panels to show; the choice persists in localStorage. Defaults
 * to the most important panels. Each widget is self-contained and reuses the
 * app's real data endpoints.
 */
interface WidgetDef {
  id: string;
  label: string;
  span: "half" | "full";
  Comp: React.ComponentType;
  defaultOn: boolean;
}

const WIDGETS: WidgetDef[] = [
  { id: "market", label: "Market read (AI)", span: "full", Comp: MarketAnalysisWidget, defaultOn: true },
  { id: "movers", label: "Top movers", span: "half", Comp: MoversWidget, defaultOn: true },
  { id: "gl", label: "Gainers / Losers", span: "half", Comp: GainersLosersWidget, defaultOn: true },
  { id: "tweets", label: "Important tweets", span: "half", Comp: TweetsWidget, defaultOn: true },
  { id: "swap", label: "Quick swap", span: "half", Comp: QuickSwapWidget, defaultOn: true },
  { id: "bridge", label: "Bridge", span: "half", Comp: MiniBridgeWidget, defaultOn: false },
  { id: "alerts", label: "Alerts", span: "half", Comp: AlertsWidget, defaultOn: false },
];

const STORAGE_KEY = "cterm.dashboard.widgets";

export default function Dashboard() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(WIDGETS.map((w) => [w.id, w.defaultOn])),
  );
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setEnabled((e) => ({ ...e, ...JSON.parse(saved) }));
    } catch { /* noop */ }
  }, []);

  function toggle(id: string) {
    setEnabled((e) => {
      const next = { ...e, [id]: !e[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const visible = WIDGETS.filter((w) => enabled[w.id]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Dashboard</h1>
        <button
          onClick={() => setCustomizing((v) => !v)}
          className="border border-line px-2.5 py-1 text-[11px] uppercase tracking-wider text-fg-mute hover:border-amber hover:text-amber"
        >
          {customizing ? "Done" : "Customize"}
        </button>
      </div>

      {customizing && (
        <div className="panel mb-4 p-3">
          <div className="cell-label mb-2">Widgets</div>
          <div className="flex flex-wrap gap-2">
            {WIDGETS.map((w) => (
              <button
                key={w.id}
                onClick={() => toggle(w.id)}
                className={`border px-2 py-1 text-xs ${enabled[w.id] ? "border-amber text-amber" : "border-line text-fg-dim"}`}
              >
                {enabled[w.id] ? "✓ " : "＋ "}{w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visible.map((w) => (
          <div key={w.id} className={w.span === "full" ? "lg:col-span-2" : ""}>
            <w.Comp />
          </div>
        ))}
        {visible.length === 0 && (
          <p className="py-12 text-center text-sm text-fg-dim lg:col-span-2">
            No widgets enabled. Click Customize to add some.
          </p>
        )}
      </div>
    </div>
  );
}
