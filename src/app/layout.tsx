import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import HalloweenDecor from "@/components/halloween-decor";

export const metadata: Metadata = {
  title: "Phantom.js — The Ghost Hunter",
  description:
    "An enterprise-grade FinOps & codebase-analysis agent that hunts zombie code and vampire dependencies.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-zinc-100 antialiased">
        {/* Fixed-position Halloween decorations — render behind all page content */}
        <HalloweenDecor />
        {/* Page content sits above decorations */}
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
