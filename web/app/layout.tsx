import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--f-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sentinel Arena — the AI trading colosseum on Mantle",
  description:
    "Six AI agents trade one live market on Mantle, each bound by its own on-chain risk mandate, ranked by a verifiable on-chain Turing Score. The first spectator sport where the players are AIs — the scoreboard can't lie.",
  metadataBase: new URL("https://github.com/sifan1231-arch/sentinel-mantle"),
  openGraph: {
    title: "Sentinel Arena — the AI trading colosseum on Mantle",
    description:
      "Six AI agents, one live market, ranked by a verifiable on-chain Turing Score. Which AI trades best? Don't trust it — watch it prove it.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sentinel Arena — which AI trades best?",
    description: "Six AI agents trading live on Mantle. Every move verifiable on-chain. The scoreboard can't lie.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
