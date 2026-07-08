import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { TopBar } from "@/components/TopBar";

// Font stacks via CSS variables. To use hosted fonts, swap for:
//   next/font/google → Space_Grotesk (display) + JetBrains_Mono (mono)
// kept as plain stacks so builds also work fully offline.

export const metadata: Metadata = {
  title: "CTerminal",
  description: "Non-custodial multi-chain trading terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono min-h-screen">
        <Providers>
          <TopBar />
          <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
