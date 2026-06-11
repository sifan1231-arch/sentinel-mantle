// Shared, client-safe arena metadata + types. NO viem here — the browser never
// talks to the RPC directly; all chain access lives in lib/arena-server.ts.
import deployment from "./deployment.generated.json";

export const DEP = deployment as any;
const ZERO = "0x0000000000000000000000000000000000000000";

export const isConfigured: boolean =
  DEP?.mode === "arena" &&
  !!DEP?.addresses?.arena &&
  /^0x[0-9a-fA-F]{40}$/.test(DEP.addresses.arena) &&
  DEP.addresses.arena !== ZERO &&
  !!DEP?.abis?.AgentArena;

export const explorer: string = DEP.explorer || "";
export const addresses = DEP.addresses || {};
export const network: string = DEP.network || "mantleSepolia";
export const agentsMeta: any[] = DEP.agents || [];
export const seedUsd: number = DEP.seedUsd || 10000;
export const startBlock: number = DEP.startBlock || 0;

export const TURING_FORMULA = "10000 + return(bps) + activity bonus − drawdown penalty − halt penalty";

export interface Standing {
  rank: number;
  agentId: number;
  name: string;
  persona: string;
  emoji: string;
  color: string;
  catchphrase: string;
  blurb: string;
  vault: string;
  navUsd: number;
  pnlUsd: number;
  pnlBps: number; // %
  decisions: number;
  halted: boolean;
  turingScore: number;
}

export interface DecisionRow {
  agentId: number;
  name: string;
  emoji: string;
  color: string;
  action: string;
  fromSymbol: string;
  toSymbol: string;
  predictedDirectionBps: number;
  confidenceBps: number;
  realizedPnl: number;
  reason: string;
  txHash: string;
  blockNumber: number;
  seq: number;
}

/** The single payload the dashboard consumes (SSR seed + /api/arena polling). */
export interface ArenaPayload {
  ok: boolean; // last chain read succeeded
  board: Standing[];
  feed: DecisionRow[];
  latestBlock: number;
  at: number; // server timestamp (ms) of last successful refresh
}

export const EMPTY_PAYLOAD: ArenaPayload = { ok: false, board: [], feed: [], latestBlock: 0, at: 0 };

export function symbolOf(addr: string): string {
  if (!addr) return "";
  for (const s of ["mUSD", "mETH", "mRWA"]) {
    if (String(addresses[s]).toLowerCase() === addr.toLowerCase()) return s;
  }
  return "";
}
