import { ethers } from "ethers";
import * as fs from "node:fs";
import * as path from "node:path";
import { RPC, CHAIN_ID, AGENT_PRIVATE_KEY, REPO_ROOT, NETWORK, EXPLORER, SYMBOLS, RISK, mergeStrategy, type Strategy } from "./config";
import { observe } from "./swarm/scout";
import { assess } from "./swarm/warden";
import { act, pushPrices, readVaultState } from "./swarm/operator";
import { loadState, saveState } from "./state";
import { c, fmtUsd, fmtPct, sleep, clamp } from "./util";
import type { Chain } from "./chain";
import type { MandateView } from "./brain/decide";
import type { Decision, MarketView, VaultState } from "./types";

interface ArenaAgent {
  key: string;
  name: string;
  persona: string;
  emoji: string;
  color: string;
  catchphrase: string;
  blurb: string;
  vaultAddr: string;
  agentId: number;
  mandate: MandateView & { slippageBps: number; cooldown: number };
  strategy: Strategy;
  vault: any;
}

function loadArena() {
  const depPath = path.join(REPO_ROOT, "contracts", "deployments", `arena.${NETWORK}.json`);
  const abisPath = path.join(REPO_ROOT, "contracts", "deployments", "abis.json");
  if (!fs.existsSync(depPath)) throw new Error(`No arena deployment at ${depPath}. Run "npm run deploy:arena" first.`);
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const abis = JSON.parse(fs.readFileSync(abisPath, "utf8"));
  const personas = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "personas.json"), "utf8")).personas;
  return { dep, abis, personas };
}

async function build() {
  const { dep, abis, personas } = loadArena();
  if (!/^0x[0-9a-fA-F]{64}$/.test(AGENT_PRIVATE_KEY)) throw new Error("Set PRIVATE_KEY (or AGENT_PRIVATE_KEY) in .env.");
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
  // Mantle's eth_estimateGas via raw ethers can fail with "missing revert data"
  // (the L1-data-fee gas model trips ethers' estimate). Fall back to a safe cap so
  // writes still send — hardhat's deploy works because it carries this handling.
  const _estimate = provider.estimateGas.bind(provider);
  (provider as any).estimateGas = async (tx: any) => {
    try {
      const g = await _estimate(tx);
      return g > 8_000_000n ? g : (g * 13n) / 10n; // +30% headroom on Mantle
    } catch {
      return 12_000_000n;
    }
  };
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);

  const oracle = new ethers.Contract(dep.addresses.oracle, abis.SentinelOracle, wallet) as any;
  const registry = new ethers.Contract(dep.addresses.registry, abis.DecisionRegistry, wallet) as any;
  const arena = new ethers.Contract(dep.addresses.arena, abis.AgentArena, wallet) as any;

  const tokens: Record<string, any> = {};
  const decimals: Record<string, number> = {};
  for (const sym of SYMBOLS) {
    tokens[sym] = new ethers.Contract(dep.addresses[sym], abis.MockERC20, wallet) as any;
    decimals[sym] = Number(await tokens[sym].decimals());
  }

  const shared = { provider, wallet, oracle, registry, tokens, decimals, addr: dep.addresses } as unknown as Chain;
  const pmap = new Map<string, any>(personas.map((p: any) => [p.key, p]));
  const agents: ArenaAgent[] = dep.agents.map((a: any) => ({
    ...a,
    vaultAddr: a.vault,
    mandate: a.mandate,
    strategy: mergeStrategy(pmap.get(a.key)?.strategy),
    vault: new ethers.Contract(a.vault, abis.SentinelVault, wallet) as any,
  }));
  return { shared, arena, agents, dep };
}

// ---- shock-replay: a deterministic adverse scenario to show the board reshuffle on camera ----
function applyShock(view: MarketView, phase: number) {
  // phase 0: −9% crash + shock regime; 1: −3% more; 2: +5% snap-back; 3+: settle.
  const path = [-0.09, -0.03, 0.05, 0.02];
  const d = path[Math.min(phase, path.length - 1)];
  view.prices.mETH = view.prices.mETH * (1 + d);
  view.momentumBps = clamp((d > 0 ? 700 : -1) * (d * 100), -1500, 1500);
  view.regime = d <= 0 ? "shock" : "trend";
  view.anomalyZ = d <= 0 ? 3.5 : 1.5;
  view.flowSignal = d <= 0 ? -0.6 : 0.6;
  view.confidence = 0.7;
  view.signalsHash = ethers.id(JSON.stringify({ shock: phase, p: view.prices.mETH }));
  view.notes = [`⚡ SHOCK REPLAY phase ${phase}: mETH ${(d * 100).toFixed(0)}% → $${view.prices.mETH.toFixed(2)}, regime ${view.regime}`];
}

const persColor = (hex: string) => {
  // map a hex to the nearest of a few ANSI colors for the terminal broadcast
  const f = (h: string) => parseInt(h, 16);
  const r = f(hex.slice(1, 3)), g = f(hex.slice(3, 5)), b = f(hex.slice(5, 7));
  if (r > 180 && g < 130 && b < 130) return c.red;
  if (b > 180 && r < 130) return g > 180 ? c.cyan : c.blue;
  if (r > 180 && g > 150 && b < 120) return c.yellow;
  if (r > 150 && b > 150 && g < 150) return c.magenta;
  if (g > 180 && r < 150) return c.green;
  return c.cyan;
};

function renderBoard(cycle: number, view: MarketView, board: any[], last: Map<number, Decision>, agents: ArenaAgent[]) {
  const byId = new Map(agents.map((a) => [a.agentId, a]));
  const ranked = [...board].sort((x, y) => Number(y.turingScore) - Number(x.turingScore));
  const shock = /shock/i.test(view.notes[0] || "") || view.regime === "shock";
  console.log("\n" + c.dim("════ Cycle " + cycle + " ").padEnd(64, "═"));
  console.log(
    c.dim(" market ") +
      `mETH ${c.bold("$" + view.prices.mETH.toFixed(2))}  regime ${shock ? c.red(view.regime.toUpperCase()) : c.cyan(view.regime)}  ` +
      (shock ? c.red("⚡ SHOCK") : "")
  );
  console.log(c.dim(" ┌──── LEADERBOARD · Turing Score ─────────────────────────────┐"));
  ranked.forEach((s, i) => {
    const a = byId.get(Number(s.agentId));
    const col = a ? persColor(a.color) : c.cyan;
    const pnl = Number(s.pnlUsd) / 1e8;
    const pnlBps = Number(s.pnlBps) / 100;
    const dec = last.get(Number(s.agentId));
    const action = dec ? dec.action : "—";
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
    const pnlStr = pnl >= 0 ? c.green(`+${fmtUsd(pnl)} (${fmtPct(pnlBps)})`) : c.red(`${fmtUsd(pnl)} (${fmtPct(pnlBps)})`);
    const score = c.bold(String(Number(s.turingScore)));
    const name = col(`${a ? a.emoji : "🤖"} ${s.name.padEnd(9)}`);
    console.log(` ${medal} ${name} score ${score.padStart(5)}  ${pnlStr}  ${c.dim(action)}${s.halted ? c.red(" HALT") : ""}`);
  });
  console.log(c.dim(" └─────────────────────────────────────────────────────────────┘"));
}

function parseArgs() {
  const a = process.argv.slice(2);
  const demo = a.includes("--demo");
  const num = (flag: string, d: number) => {
    const i = a.indexOf(flag);
    return i >= 0 && a[i + 1] ? Number(a[i + 1]) : d;
  };
  return {
    mode: demo ? "demo" : "live",
    cycles: num("--cycles", demo ? 12 : Infinity),
    intervalMs: num("--interval", demo ? 3 : 25) * 1000,
    shock: a.includes("--shock"),
    shockAt: num("--shock-at", 4),
  };
}

async function main() {
  const { mode, cycles, intervalMs, shock, shockAt } = parseArgs();
  const { shared, arena, agents } = await build();
  const agentState = loadState();

  console.log(c.bold("\n╔══════════════════════════════════════════════════════════════╗"));
  console.log(c.bold("║   SENTINEL ARENA — six AI agents, one live market, on-chain   ║"));
  console.log(c.bold("╚══════════════════════════════════════════════════════════════╝"));
  console.log(c.dim(` network ${NETWORK} · ${agents.length} agents · mode ${mode}` + (shock ? ` · shock@${shockAt}` : "")));
  console.log(c.dim(` arena ${EXPLORER}/address/${(shared as any).addr.arena}`));
  console.log(c.dim(" roster " + agents.map((a) => persColor(a.color)(`${a.emoji}${a.name}`)).join(" ")));

  let cycle = 0;
  let stop = false;
  process.on("SIGINT", () => {
    console.log(c.dim("\nstopping after this cycle…"));
    stop = true;
  });

  while (cycle < cycles && !stop) {
    cycle++;
    try {
      const view = await observe(agentState);
      if (shock && cycle >= shockAt) applyShock(view, cycle - shockAt);
      await pushPrices(shared, view); // shared signal bus → one on-chain price for all

      const last = new Map<number, Decision>();
      for (const ag of agents) {
        try {
          const state = await readVaultState(shared, ag.vault, ag.agentId);
          const decision = assess(view, state, ag.mandate, shared, ag.strategy);
          await act(shared, ag.vault, ag.agentId, decision, view);
          last.set(ag.agentId, decision);
        } catch (e: any) {
          console.warn(c.red(`  ${ag.name} cycle error: `) + String(e?.shortMessage || e?.message || e).slice(0, 90));
        }
      }

      const board = await arena.leaderboard();
      renderBoard(cycle, view, board, last, agents);
      saveState(agentState);
    } catch (e: any) {
      console.error(c.red("\n cycle error: ") + String(e?.shortMessage || e?.message || e).slice(0, 160));
    }
    if (cycle < cycles && !stop) await sleep(intervalMs);
  }

  console.log(c.dim("\nArena run complete. Every decision is provable on-chain:"));
  console.log(c.dim(` ${EXPLORER}/address/${(shared as any).addr.registry}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
