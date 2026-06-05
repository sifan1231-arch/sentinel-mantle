import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sentinel — self-proving autonomous RWA yield & risk agent on Mantle",
  description:
    "An autonomous AI agent that manages a real-world-asset portfolio on Mantle (USDY yield, mETH, stable buffer) within an on-chain risk mandate, and proves every decision on-chain. Built for the Turing Test Hackathon 2026.",
  openGraph: {
    title: "Sentinel — self-proving autonomous RWA yield & risk agent on Mantle",
    description: "Autonomous RWA yield + risk management. Every decision verifiable on-chain. ERC-8004 identity.",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Sentinel on Mantle", description: "An agent that proves itself on-chain." },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
