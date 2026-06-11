// Server-only arena data layer. One server poll feeds every visitor:
//  - viem fallback transport across multiple public Mantle Sepolia RPCs
//  - leaderboard = a single eth_call (cheap, robust)
//  - decisions  = INCREMENTAL chunked eth_getLogs (never re-scans a growing
//    range from genesis - the exact failure mode that broke direct-from-browser reads)
//  - a hard wall-clock deadline keeps every refresh far inside Vercel's 10s limit
//  - module-level cache + in-flight dedupe; partial failures keep last-good data
// (imported only from server components / route handlers, never from "use client" files)
import { createPublicClient, fallback, http, defineChain, hexToString, type Address } from "viem";
import {
  DEP,
  isConfigured,
  addresses,
  startBlock,
  symbolOf,
  type ArenaPayload,
  type Standing,
  type DecisionRow,
  EMPTY_PAYLOAD,
} from "./arena-core";

const RPCS: string[] = [DEP.rpc || "https://rpc.sepolia.mantle.xyz", "https://mantle-sepolia.drpc.org"].filter(Boolean);

const chain = isConfigured
  ? defineChain({
      id: Number(DEP.chainId),
      name: DEP.network,
      nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
      rpcUrls: { default: { http: RPCS } },
    })
  : undefined;

// Tight per-call budget: worst case (timeout x retries x both transports) must
// stay well under Vercel's 10s function limit, with the deadline as the backstop.
const client = isConfigured
  ? createPublicClient({
      chain,
      transport: fallback(
        RPCS.map((u) => http(u, { timeout: 3_500, retryCount: 1, retryDelay: 300 })),
        { rank: false }
      ),
    })
  : null;

const num = (x: any) => (typeof x === "bigint" ? Number(x) : Number(x ?? 0));
const META_BY_ID = new Map<number, any>((DEP.agents || []).map((a: any) => [Number(a.agentId), a]));
const FALLBACK_META = { emoji: "\u{1F916}", color: "#34d399", catchphrase: "", blurb: "", name: "", persona: "" };
const DASH = "—";

function actionLabel(actionTypeHex: string): string {
  try {
    return hexToString(actionTypeHex as `0x${string}`).replace(/ +$/g, "") || DASH;
  } catch {
    return DASH;
  }
}

async function readLeaderboard(): Promise<Standing[]> {
  const raw: any[] = (await client!.readContract({
    address: addresses.arena as Address,
    abi: DEP.abis.AgentArena,
    functionName: "leaderboard",
  } as any)) as any[];
  const list: Standing[] = raw.map((s) => {
    const m = META_BY_ID.get(num(s.agentId)) || FALLBACK_META;
    return {
      rank: 0,
      agentId: num(s.agentId),
      name: String(s.name),
      persona: String(s.persona),
      emoji: m.emoji ?? FALLBACK_META.emoji,
      color: m.color ?? "#34d399",
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

// ---- incremental decision-log scanner ----
// NOTE: BigInt via constructor calls, never literals - @vercel/nft's build-time
// static evaluator crashes ("Cannot mix BigInt") when folding BigInt literal arithmetic.
const CHUNK = BigInt(9000); // public Mantle RPCs reject big eth_getLogs ranges
const ONE = BigInt(1);
const SAFE_LAG = BigInt(5); // fallback RPCs can trail the head; never mark trailing blocks scanned
const COLD_MAX_CHUNKS = 8; // cold start: scan back <=72k blocks for history
const KEEP = 200;

let scanned: { last: bigint; rows: DecisionRow[] } | null = null;

function parseLogs(logs: any[]): DecisionRow[] {
  return logs.map((l) => {
    const a = l.args as any;
    const id = num(a.agentId);
    const m = META_BY_ID.get(id) || FALLBACK_META;
    return {
      agentId: id,
      name: m.name || `Agent ${id}`,
      emoji: m.emoji || FALLBACK_META.emoji,
      color: m.color || "#34d399",
      action: actionLabel(a.actionType),
      fromSymbol: symbolOf(String(a.fromAsset)),
      toSymbol: symbolOf(String(a.toAsset)),
      predictedDirectionBps: num(a.predictedDirectionBps),
      confidenceBps: num(a.confidenceBps),
      realizedPnl: num(a.realizedPnl) / 1e8,
      reason: String(a.reason ?? ""),
      txHash: String(l.transactionHash),
      blockNumber: num(l.blockNumber ?? 0),
      seq: num(a.seq),
    };
  });
}

async function getEvents(fromBlock: bigint, toBlock: bigint): Promise<any[]> {
  return client!.getContractEvents({
    address: addresses.registry as Address,
    abi: DEP.abis.DecisionRegistry,
    eventName: "AgentDecision",
    fromBlock,
    toBlock,
  });
}

function dedupe(rows: DecisionRow[]): DecisionRow[] {
  const seen = new Set<string>();
  const out: DecisionRow[] = [];
  for (const r of rows) {
    const k = `${r.agentId}-${r.seq}-${r.txHash}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

async function refreshDecisions(latest: bigint, deadline: number): Promise<DecisionRow[]> {
  const START = BigInt(startBlock || 0);
  // clamp the scan head a few blocks behind the reported tip: getBlockNumber may be
  // answered by the RPC that is ahead while getLogs falls back to the one behind,
  // which would silently return empty for blocks it has not seen yet
  const head = latest > START + SAFE_LAG ? latest - SAFE_LAG : latest;
  if (!scanned) {
    // cold start: walk backwards in chunks until we hit the deploy block / deadline
    const collected: any[] = [];
    let to = head;
    let lastFrom = head;
    for (let i = 0; i < COLD_MAX_CHUNKS && to >= START; i++) {
      if (Date.now() > deadline) break;
      const from = to - CHUNK + ONE > START ? to - CHUNK + ONE : START;
      const logs = await getEvents(from, to);
      collected.unshift(...logs);
      lastFrom = from;
      if (from === START) break;
      to = from - ONE;
    }
    scanned = { last: head, rows: dedupe(parseLogs(collected)).slice(-KEEP) };
    void lastFrom;
  } else if (head > scanned.last) {
    // warm: only the new tail (bounded - if the instance slept long, skip the gap)
    let from = scanned.last + ONE;
    if (head - from > CHUNK * BigInt(6)) from = head - CHUNK * BigInt(6);
    let cursor = from;
    const fresh: any[] = [];
    while (cursor <= head) {
      if (Date.now() > deadline) break;
      const to = cursor + CHUNK - ONE > head ? head : cursor + CHUNK - ONE;
      fresh.push(...(await getEvents(cursor, to)));
      cursor = to + ONE;
    }
    scanned.rows = dedupe([...scanned.rows, ...parseLogs(fresh)]).slice(-KEEP);
    // only mark what was actually scanned; an early deadline break resumes next poll
    scanned.last = cursor - ONE;
  }
  return [...scanned.rows].reverse().slice(0, 40); // newest first
}

// ---- cached payload (5s TTL, in-flight dedupe, partial-failure keeps last-good) ----
let cache: ArenaPayload | null = null;
let inflight: Promise<void> | null = null;
let inflightAt = 0;
const TTL_MS = 5_000;
const REFRESH_BUDGET_MS = 6_500; // hard wall-clock budget per refresh
const AWAIT_CAP_MS = 7_000; // never block a render/request longer than this

async function refresh(): Promise<void> {
  const deadline = Date.now() + REFRESH_BUDGET_MS;
  const next: ArenaPayload = cache ? { ...cache } : { ...EMPTY_PAYLOAD };
  let anyOk = false;
  try {
    const latest = await client!.getBlockNumber();
    next.latestBlock = Number(latest);
    next.board = await readLeaderboard(); // sequential, never bursts the RPC
    anyOk = true;
    try {
      next.feed = await refreshDecisions(latest, deadline);
    } catch {
      /* keep last-good feed */
    }
  } catch {
    /* keep last-good board */
  }
  next.ok = anyOk;
  if (anyOk) next.at = Date.now();
  cache = next;
}

export async function getArena(): Promise<ArenaPayload> {
  if (!isConfigured || !client) return EMPTY_PAYLOAD;
  if (cache && Date.now() - cache.at < TTL_MS && cache.ok) return cache;
  // treat a refresh as stalled if the platform froze its invocation mid-flight
  if (!inflight || Date.now() - inflightAt > 8_000) {
    inflightAt = Date.now();
    inflight = refresh().finally(() => (inflight = null));
  }
  try {
    await Promise.race([inflight, new Promise((r) => setTimeout(r, AWAIT_CAP_MS))]);
  } catch {
    /* cache already holds last-good */
  }
  return cache ?? EMPTY_PAYLOAD;
}
