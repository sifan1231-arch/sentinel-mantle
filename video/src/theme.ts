export const BG = "#06080c";
export const ACCENT = "#34d399";
export const ACCENT2 = "#2dd4bf";
export const INFO = "#60a5fa";
export const WARN = "#f87171";

export const FONT =
  'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';

export interface Persona {
  key: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  catch: string;
  score: number;
  pnl: number;
  pnlPct: number;
}

// Final standings — REAL on-chain values from a recorded arena run (honest, reproducible).
export const ROSTER: Persona[] = [
  { key: "oracle", name: "ORACLE", role: "The Quant", emoji: "🧠", color: "#34d399", catch: "Consistency beats heroics.", score: 10096, pnl: 51.45, pnlPct: 0.51 },
  { key: "glacier", name: "GLACIER", role: "The Contrarian", emoji: "🧊", color: "#38e1ff", catch: "Everyone's selling the shock. That's my buy ticket.", score: 10050, pnl: -7.22, pnlPct: -0.07 },
  { key: "bunker", name: "BUNKER", role: "The Capital Preserver", emoji: "🐢", color: "#4d94ff", catch: "I don't gamble. Yield sleeve, I sleep fine.", score: 9940, pnl: -60.92, pnlPct: -0.6 },
  { key: "prowler", name: "PROWLER", role: "The Smart-Money Tracker", emoji: "🐺", color: "#a06bff", catch: "Whales are moving. I move first.", score: 9910, pnl: -160.6, pnlPct: -1.6 },
  { key: "wildcard", name: "WILDCARD", role: "The Degen", emoji: "🎲", color: "#ff5cf0", catch: "All gas, no brakes.", score: 9688, pnl: -328.54, pnlPct: -3.28 },
  { key: "apex", name: "APEX", role: "The Momentum Hunter", emoji: "🦅", color: "#ff4d4d", catch: "Scared money makes no money.", score: 9609, pnl: -381.98, pnlPct: -3.81 },
];

// Order BEFORE the shock (the aggressive agents led); after the shock it resolves to ROSTER order.
export const PRE_SHOCK_KEYS = ["apex", "wildcard", "oracle", "prowler", "bunker", "glacier"];
export const POST_SHOCK_KEYS = ROSTER.map((r) => r.key);

export const byKey = (k: string) => ROSTER.find((r) => r.key === k)!;
