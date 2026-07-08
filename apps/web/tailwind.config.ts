import type { Config } from "tailwindcss";

/**
 * CTerminal design tokens.
 * Palette: "ink & amber" — deep blue-black surfaces, Bloomberg-style amber
 * as the single accent, phosphor green/red strictly reserved for PnL signs.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#08090C", 900: "#0B0D11", 800: "#12151B", 700: "#1A1E26", 600: "#232936" },
        line: "#1F2530",
        fg: { DEFAULT: "#E9EDF4", mute: "#8B94A7", dim: "#5B6372" },
        amber: { DEFAULT: "#FFB020", soft: "#FFB02022" },
        up: "#2FD180",
        down: "#FF4D5E",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
