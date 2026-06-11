// Client-safe formatting helpers (zero deps — keeps viem out of the browser bundle).
// Locale pinned to en-US everywhere: the server renders with Node's ICU, so an
// unpinned locale hydration-mismatches (and corrupts decimals) for non-en-US visitors.
export const fmtUsd = (v: number) =>
  (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 });

export const fmtUsd0 = (v: number) =>
  (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

export const fmtPct = (v: number, dp = 2) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(dp) + "%";
export const bpsToPct = (bps: number | bigint) => Number(bps) / 100;
export const shortHash = (h: string) => (h && h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);
export const shortAddr = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function actionTone(action: string): "buy" | "sell" | "hold" | "neutral" {
  if (action === "ENTER") return "buy";
  if (action === "DERISK" || action === "EXIT") return "sell";
  if (action === "HOLD") return "hold";
  return "neutral";
}
