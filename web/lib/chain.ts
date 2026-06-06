import { createPublicClient, http, defineChain, type Address } from "viem";
import deployment from "./deployment.generated.json";
import { actionLabel } from "./format";

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

const chain = isConfigured
  ? defineChain({
      id: Number(DEP.chainId),
      name: DEP.network,
      nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
      rpcUrls: { default: { http: [DEP.rpc] } },
      blockExplorers: { default: { name: "Explorer", url: DEP.explorer } },
    })
  : undefined;

export const client = isConfigured ? createPublicClient({ chain, transport: http(DEP.rpc) }) : null;

const num = (x: any) => (typeof x === "bigint" ? Number(x) : Number(x ?? 0));

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

const META_BY_ID = new Map<number, any>(agentsMeta.map((a) => [Number(a.agentId), a]));
const FALLBACK = { emoji: "🤖", color: "#34d399", catchphrase: "", blurb: "" };

export async function readLeaderboard(): Promise<Standing[]> {
  if (!client) return [];
  const raw: any[] = (await client.readContract({
    address: addresses.arena as Address,
    abi: DEP.abis.AgentArena,
    functionName: "leaderboard",
  } as any)) as any[];

  const list: Standing[] = raw.map((s) => {
    const m = META_BY_ID.get(num(s.agentId)) || FALLBACK;
    return {
      rank: 0,
      agentId: num(s.agentId),
      name: String(s.name),
      persona: String(s.persona),
      emoji: m.emoji ?? FALLBACK.emoji,
      color: m.color ?? FALLBACK.color,
      catchphrase: m.catchphrase ?? "",
      blurb: m.blurb ?? "",
      vault: String(s.vault),
      navUsd: num(s.navUsd) / 1e8,
      pnlUsd: num(s.pnlUsd) / 1e8,
      pnlBps: num(s.pnlBps) / 100,
      decisions: num(s.decisions),
      halted: Boolean(s.halted),
      turingScore: num(s.turingScore),
    };
  });
  list.sort((a, b) => b.turingScore - a.turingScore || b.pnlUsd - a.pnlUsd);
  list.forEach((s, i) => (s.rank = i + 1));
  return list;
}

export interface DecisionRow {
  agentId: number;
  name: string;
  emoji: string;
  color: string;
  action: string;
  fromAsset: string;
  toAsset: string;
  predictedDirectionBps: number;
  confidenceBps: number;
  realizedPnl: number;
  reason: string;
  txHash: string;
  blockNumber: bigint;
  seq: number;
}

const NAME_BY_ID = new Map<number, any>(agentsMeta.map((a) => [Number(a.agentId), a]));

export async function readDecisions(limit = 40): Promise<DecisionRow[]> {
  if (!client) return [];
  const fromStart = BigInt(startBlock || 0);
  let logs: any[] = [];
  try {
    logs = await client.getContractEvents({
      address: addresses.registry as Address,
      abi: DEP.abis.DecisionRegistry,
      eventName: "AgentDecision",
      fromBlock: fromStart,
      toBlock: "latest",
    });
  } catch {
    const latest = await client.getBlockNumber();
    const fb = latest > 90000n ? latest - 90000n : 0n;
    logs = await client.getContractEvents({
      address: addresses.registry as Address,
      abi: DEP.abis.DecisionRegistry,
      eventName: "AgentDecision",
      fromBlock: fb,
      toBlock: "latest",
    });
  }

  const rows: DecisionRow[] = logs.map((l) => {
    const a = l.args as any;
    const id = num(a.agentId);
    const m = NAME_BY_ID.get(id) || {};
    return {
      agentId: id,
      name: m.name || `Agent ${id}`,
      emoji: m.emoji || "🤖",
      color: m.color || "#34d399",
      action: actionLabel(a.actionType),
      fromAsset: String(a.fromAsset),
      toAsset: String(a.toAsset),
      predictedDirectionBps: num(a.predictedDirectionBps),
      confidenceBps: num(a.confidenceBps),
      realizedPnl: num(a.realizedPnl) / 1e8,
      reason: String(a.reason ?? ""),
      txHash: String(l.transactionHash),
      blockNumber: BigInt(l.blockNumber ?? 0),
      seq: num(a.seq),
    };
  });

  return rows.reverse().slice(0, limit);
}

export function symbolOf(addr: string): string {
  if (!addr) return "";
  for (const s of ["mUSD", "mETH", "mRWA"]) if (String(addresses[s]).toLowerCase() === addr.toLowerCase()) return s;
  return "";
}
