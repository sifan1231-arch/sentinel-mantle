import { createPublicClient, http, defineChain, type Address } from "viem";
import deployment from "./deployment.generated.json";
import { actionLabel } from "./format";

export const DEP = deployment as any;

const ZERO = "0x0000000000000000000000000000000000000000";
export const isConfigured: boolean =
  !!DEP?.addresses?.vault &&
  /^0x[0-9a-fA-F]{40}$/.test(DEP.addresses.vault) &&
  DEP.addresses.vault !== ZERO &&
  !!DEP?.abis?.SentinelVault;

export const explorer: string = DEP.explorer || "";
export const addresses = DEP.addresses || {};
export const agentId: bigint = BigInt(DEP.agentId ?? 0);
export const network: string = DEP.network || "mantleSepolia";
export const SYMBOLS = ["mUSD", "mETH", "mRWA"] as const;

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

export interface VaultSnapshot {
  navUsd: number;
  pnlUsd: number;
  costBasisUsd: number;
  highWaterUsd: number;
  halted: boolean;
  weights: Record<string, number>; // % of NAV
  mandate: { maxSingleTradeBps: number; maxAssetWeightBps: number; maxDrawdownBps: number };
}

export interface AgentMeta {
  owner: string;
  canonicalAgentId: number;
  decisionCount: number;
  cumRealizedPnl: number;
}

export interface DecisionRow {
  seq: number;
  action: string;
  fromAsset: string;
  toAsset: string;
  amount: bigint;
  predictedDirectionBps: number;
  confidenceBps: number;
  realizedPnl: number;
  reason: string;
  txHash: string;
  blockNumber: bigint;
}

function num(x: any): number {
  return typeof x === "bigint" ? Number(x) : Number(x ?? 0);
}

export async function readVault(): Promise<VaultSnapshot | null> {
  if (!client) return null;
  const abi = DEP.abis.SentinelVault;
  const v = (functionName: string, args: any[] = []) =>
    client.readContract({ address: addresses.vault as Address, abi, functionName, args });

  const [nav, pnl, cost, hwm, halted, mandateRaw] = await Promise.all([
    v("nav"),
    v("totalPnlUsd"),
    v("costBasisUsd"),
    v("highWaterMarkUsd"),
    v("halted"),
    v("mandate"),
  ]);

  const navN = num(nav) / 1e8;
  const weights: Record<string, number> = {};
  for (const s of SYMBOLS) {
    const val = await v("assetValueUsd", [addresses[s]]);
    weights[s] = navN > 0 ? ((num(val) / 1e8) / navN) * 100 : 0;
  }

  const m: any = mandateRaw;
  const mandate = {
    maxSingleTradeBps: num(m.maxSingleTradeBps ?? m[0]),
    maxAssetWeightBps: num(m.maxAssetWeightBps ?? m[1]),
    maxDrawdownBps: num(m.maxDrawdownBps ?? m[2]),
  };

  return {
    navUsd: navN,
    pnlUsd: num(pnl) / 1e8,
    costBasisUsd: num(cost) / 1e8,
    highWaterUsd: num(hwm) / 1e8,
    halted: Boolean(halted),
    weights,
    mandate,
  };
}

export async function readAgent(): Promise<AgentMeta | null> {
  if (!client) return null;
  const abi = DEP.abis.DecisionRegistry;
  const a: any = await client.readContract({
    address: addresses.registry as Address,
    abi,
    functionName: "getAgent",
    args: [agentId],
  });
  return {
    owner: String(a.owner ?? a[0]),
    canonicalAgentId: num(a.canonicalAgentId ?? a[1]),
    decisionCount: num(a.count ?? a[3]),
    cumRealizedPnl: num(a.cumRealizedPnl ?? a[4]) / 1e8,
  };
}

export async function readDecisions(limit = 50): Promise<DecisionRow[]> {
  if (!client) return [];
  const abi = DEP.abis.DecisionRegistry;
  const fromStart = BigInt(DEP.startBlock ?? 0);

  let logs: any[] = [];
  try {
    logs = await client.getContractEvents({
      address: addresses.registry as Address,
      abi,
      eventName: "AgentDecision",
      fromBlock: fromStart,
      toBlock: "latest",
    });
  } catch {
    const latest = await client.getBlockNumber();
    const fb = latest > 90000n ? latest - 90000n : 0n;
    logs = await client.getContractEvents({
      address: addresses.registry as Address,
      abi,
      eventName: "AgentDecision",
      fromBlock: fb,
      toBlock: "latest",
    });
  }

  const rows: DecisionRow[] = logs.map((l) => {
    const a = l.args as any;
    return {
      seq: num(a.seq),
      action: actionLabel(a.actionType),
      fromAsset: String(a.fromAsset),
      toAsset: String(a.toAsset),
      amount: BigInt(a.amount ?? 0),
      predictedDirectionBps: num(a.predictedDirectionBps),
      confidenceBps: num(a.confidenceBps),
      realizedPnl: num(a.realizedPnl) / 1e8,
      reason: String(a.reason ?? ""),
      txHash: String(l.transactionHash),
      blockNumber: BigInt(l.blockNumber ?? 0),
    };
  });

  return rows.reverse().slice(0, limit); // newest first
}

export function symbolOf(addr: string): string {
  if (!addr) return "";
  for (const s of SYMBOLS) if (String(addresses[s]).toLowerCase() === addr.toLowerCase()) return s;
  return "";
}
