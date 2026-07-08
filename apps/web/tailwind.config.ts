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
        // DeGods/y00ts-inspired: warm near-black surfaces, cream ink, deep gold accent
        ink: { 950: "#0A0805", 900: "#12100A", 800: "#1A1710", 700: "#241F16", 600: "#312A1E" },
        line: "#2A2418",
        fg: { DEFAULT: "#F4EFE3", mute: "#A79E88", dim: "#6E6553" },
        // gold is the primary accent (kept as `amber` so existing classes work)
        amber: { DEFAULT: "#E4B24A", soft: "#E4B24A1F" },
        gold: { DEFAULT: "#E4B24A", deep: "#B8873A", light: "#F2D488" },
        // y00ts playful accents for secondary highlights
        violet: "#9A7BFF",
        lime: "#B9F24A",
        coral: "#FF7A59",
        up: "#7ED957",
        down: "#FF6B6B",
      },
      boxShadow: {
        gold: "0 0 0 1px #E4B24A33, 0 8px 30px -12px #E4B24A55",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
