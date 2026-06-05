import { makeChain } from "./chain";
import { observe } from "./swarm/scout";
import { assess } from "./swarm/warden";
import { act, pushPrices, readVaultState } from "./swarm/operator";
import { enrichReason } from "./llm";
import { loadState, saveState, pushCycle } from "./state";
import { EXPLORER, NETWORK, ANTHROPIC_API_KEY, SYMBOLS, RISK, STABLE, YIELD } from "./config";
import { c, fmtUsd, fmtPct, sleep, shortAddr } from "./util";
import type { MandateView } from "./brain/decide";
import type { CycleResult, Decision, MarketView, VaultState } from "./types";
import type { Chain } from "./chain";

function parseArgs() {
  const a = process.argv.slice(2);
  const demo = a.includes("--demo");
  const get = (flag: string, d: number) => {
    const i = a.indexOf(flag);
    return i >= 0 && a[i + 1] ? Number(a[i + 1]) : d;
  };
  return {
    mode: demo ? "demo" : "live",
    cycles: get("--cycles", demo ? 6 : Infinity),
    intervalMs: get("--interval", demo ? 5 : 30) * 1000,
  };
}

function actionColor(action: string): (s: string) => string {
  if (action === "ENTER") return c.green;
  if (action === "DERISK" || action === "EXIT") return c.yellow;
  if (action === "HOLD") return c.gray;
  return c.cyan;
}

function weightsBar(state: VaultState): string {
  return SYMBOLS.map((s) => `${s} ${(state.weightsBps[s] / 100).toFixed(0)}%`).join("  ");
}

function render(cycle: number, view: MarketView, decision: Decision, txHash: string | null, state: VaultState) {
  const ac = actionColor(decision.action);
  console.log("\n" + c.dim("──── Cycle " + cycle + " " + "─".repeat(46)));
  console.log(c.cyan(" SCOUT   ") + "🔭 senses the market");
  for (const n of view.notes) console.log("         " + c.dim(n));
  console.log(
    c.magenta(" WARDEN  ") +
      "🛡  target " +
      c.bold((decision.targetWeightBps / 100).toFixed(0) + "%") +
      " mETH  (now " +
      (decision.currentWeightBps / 100).toFixed(0) +
      "%)  → " +
      ac(decision.action) +
      "  conf " +
      (decision.confidenceBps / 100).toFixed(0) +
      "%"
  );
  console.log("         " + (decision.vetoed ? c.red(decision.reason) : decision.reason));
  const opLine =
    txHash != null
      ? "⛓  " + c.green("on-chain") + " " + c.dim(`${EXPLORER}/tx/${txHash}`)
      : decision.action === "HOLD"
        ? "⛓  no trade this cycle"
        : "⛓  " + c.yellow("declined / no tx");
  console.log(c.blue(" OPERATOR") + " " + opLine);
  const pnlStr = state.pnlUsd >= 0 ? c.green("+" + fmtUsd(state.pnlUsd)) : c.red(fmtUsd(state.pnlUsd));
  console.log(
    c.dim(" PORTFOLIO ") +
      "NAV " +
      c.bold(fmtUsd(state.navUsd)) +
      "  PnL " +
      pnlStr +
      "  " +
      c.dim("| " + weightsBar(state)) +
      (state.halted ? c.red("  | HALTED") : "")
  );
}

async function readMandate(chain: Chain): Promise<MandateView> {
  const m = await chain.vault.mandate();
  return {
    maxSingleTradeBps: Number(m.maxSingleTradeBps),
    maxAssetWeightBps: Number(m.maxAssetWeightBps),
    maxDrawdownBps: Number(m.maxDrawdownBps),
  };
}

async function main() {
  const { mode, cycles, intervalMs } = parseArgs();
  const chain = await makeChain();
  const mandate = await readMandate(chain);
  const agentState = loadState();

  console.log(c.bold("\n╔══════════════════════════════════════════════════════════════╗"));
  console.log(c.bold("║  SENTINEL — self-proving autonomous trading agent on Mantle   ║"));
  console.log(c.bold("╚══════════════════════════════════════════════════════════════╝"));
  console.log(
    c.dim(
      ` network ${NETWORK} · agentId ${chain.agentId} · operator ${shortAddr(chain.wallet.address)} · mode ${mode}`
    )
  );
  console.log(c.dim(` vault    ${EXPLORER}/address/${chain.addr.vault}`));
  console.log(c.dim(` registry ${EXPLORER}/address/${chain.addr.registry}  (every decision is logged here)`));
  console.log(
    c.dim(
      ` mandate  ≤${mandate.maxSingleTradeBps / 100}%/trade · ≤${mandate.maxAssetWeightBps / 100}% per asset · halt at ${mandate.maxDrawdownBps / 100}% drawdown`
    )
  );
  console.log(c.dim(ANTHROPIC_API_KEY ? " brain    deterministic engine + Claude rationale" : " brain    deterministic engine (set ANTHROPIC_API_KEY for NL rationale)"));

  let cycle = 0;
  let stop = false;
  process.on("SIGINT", () => {
    console.log(c.dim("\nstopping after this cycle…"));
    stop = true;
  });

  while (cycle < cycles && !stop) {
    cycle++;
    try {
      const pre = await readVaultState(chain);
      const view = await observe(agentState);
      await pushPrices(chain, view); // commit REAL prices on-chain → NAV/PnL reflect the live market
      const mid = await readVaultState(chain);
      const decision = assess(view, mid, mandate, chain);

      if (ANTHROPIC_API_KEY && decision.action !== "HOLD") {
        const nl = await enrichReason(view, decision);
        if (nl) decision.reason = nl;
      }

      const txHash = await act(chain, decision, view);
      const post = await readVaultState(chain);
      render(cycle, view, decision, txHash, post);

      const summary: CycleResult = { cycle, view, decision: { ...decision, amountIn: 0n }, txHash, state: post, ts: Date.now() };
      pushCycle(agentState, JSON.parse(JSON.stringify(summary, (_k, v) => (typeof v === "bigint" ? v.toString() : v))));
      saveState(agentState);
      void pre;
    } catch (e: any) {
      console.error(c.red("\n cycle error: ") + String(e?.shortMessage || e?.message || e).slice(0, 200));
    }

    if (cycle < cycles && !stop) await sleep(intervalMs);
  }

  console.log(c.dim("\nSentinel run complete. Proof of every decision is on-chain at:"));
  console.log(c.dim(` ${EXPLORER}/address/${chain.addr.registry}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
