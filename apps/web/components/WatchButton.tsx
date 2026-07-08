"use client";

import { useEffect, useState } from "react";
import type { ChainId } from "@cterminal/core";

const KEY = "cterm.watchlist";
interface WatchItem { chain: ChainId; address: string; symbol: string; above: number | null; below: number | null; }

/** Add/remove a token from the localStorage watchlist. */
export function WatchButton({ chain, address, symbol }: { chain: ChainId; address: string; symbol: string }) {
  const [watched, setWatched] = useState(false);
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as WatchItem[];
      setWatched(list.some((w) => w.chain === chain && w.address === address));
    } catch { /* noop */ }
  }, [chain, address]);

  function toggle() {
    let list: WatchItem[] = [];
    try { list = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { /* noop */ }
    if (watched) list = list.filter((w) => !(w.chain === chain && w.address === address));
    else list.push({ chain, address, symbol, above: null, below: null });
    localStorage.setItem(KEY, JSON.stringify(list));
    setWatched(!watched);
  }

  return (
    <button onClick={toggle}
      className={`border px-2 py-1 text-[11px] uppercase tracking-wider ${watched ? "border-amber text-amber" : "border-line text-fg-mute hover:border-amber hover:text-amber"}`}>
      {watched ? "★ Watching" : "☆ Watch"}
    </button>
  );
}
