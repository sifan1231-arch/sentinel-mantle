import * as fs from "node:fs";
import * as path from "node:path";
import { REPO_ROOT } from "./config";

const STATE_DIR = path.join(REPO_ROOT, "agent", ".state");
const STATE_FILE = path.join(STATE_DIR, "state.json");

export interface AgentState {
  priceHistory: Record<string, number[]>; // symbol -> recent prices
  cycles: any[]; // recent cycle summaries (for the optional local feed)
  updatedAt: number;
}

const DEFAULT: AgentState = { priceHistory: {}, cycles: [], updatedAt: 0 };

export function loadState(): AgentState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return { ...DEFAULT, ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) };
    }
  } catch {
    /* ignore corrupt state */
  }
  return structuredClone(DEFAULT);
}

export function saveState(s: AgentState) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  s.updatedAt = Date.now();
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

export function pushPrice(s: AgentState, symbol: string, price: number, keep = 60) {
  const arr = s.priceHistory[symbol] ?? [];
  arr.push(price);
  while (arr.length > keep) arr.shift();
  s.priceHistory[symbol] = arr;
}

export function pushCycle(s: AgentState, summary: any, keep = 50) {
  s.cycles.push(summary);
  while (s.cycles.length > keep) s.cycles.shift();
}
