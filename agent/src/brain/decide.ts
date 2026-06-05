import { clamp } from "../util";
import { STRATEGY, RISK, STABLE, YIELD } from "../config";
import type { MarketView, VaultState } from "../types";

export interface Proposal {
  targets: Record<string, number>; // bps target weight per symbol
  targetWeightBps: number; // mETH target (for display)
  currentWeightBps: number; // mETH current (for display)
  action: "ENTER" | "DERISK" | "REBALANCE" | "HOLD";
  fromSymbol: string;
  toSymbol: string;
  sizeUsd: number;
  predictedDirectionBps: number;
  confidenceBps: number;
  reason: string;
  riskOff: boolean;
}

export interface MandateView {
  maxSingleTradeBps: number;
  maxAssetWeightBps: number;
  maxDrawdownBps: number;
}

/**
 * Deterministic RWA yield/risk allocator. Computes a target weight for each sleeve
 * (mETH risk / mRWA RWA-yield / mUSD buffer) from momentum + on-chain flow + volatility +
 * regime (+ optional Allora), then proposes the single best rebalancing trade toward those
 * targets, sized within the mandate. Idle USD is deployed into RWA yield; risk is cut into
 * yield + buffer on shocks. Runs with NO API key.
 */
export function propose(view: MarketView, state: VaultState, mandate: MandateView): Proposal {
  const s = STRATEGY;
  const cap = Math.min(10000, mandate.maxAssetWeightBps);

  // 1) Risk sleeve (mETH) target.
  let meth =
    s.baseRiskWeightBps +
    s.kMomentum * view.momentumBps +
    s.kFlow * view.flowSignal -
    s.kVol * Math.max(0, view.volatilityBps - s.volFloorBps);
  if (view.allora.ok && view.allora.directionBps !== null) meth += s.kAllora * view.allora.directionBps;
  if (view.regime === "shock") meth *= s.anomalyDerisk; // cut risk hard on a whale-shock
  meth = clamp(meth, 0, cap);

  // 2) USD buffer (dry powder) sized by regime; 3) RWA yield soaks up the rest (capped).
  const buffer = Math.min(s.bufferBps[view.regime], 10000 - meth);
  let rwa = 10000 - meth - buffer;
  let usd = buffer;
  if (rwa > cap) {
    usd += rwa - cap;
    rwa = cap;
  }
  const targets: Record<string, number> = { [RISK]: meth, [YIELD]: rwa, [STABLE]: usd };

  const cur: Record<string, number> = {
    [RISK]: state.weightsBps[RISK] ?? 0,
    [YIELD]: state.weightsBps[YIELD] ?? 0,
    [STABLE]: state.weightsBps[STABLE] ?? 0,
  };

  // 4) Pick the single best rebalancing trade: sell the most-overweight, buy the most-underweight.
  const syms = [STABLE, RISK, YIELD];
  const gap = (sym: string) => targets[sym] - (cur[sym] ?? 0); // + = want more, − = want less
  const from = syms.reduce((a, b) => (gap(b) < gap(a) ? b : a)); // most negative gap
  const to = syms.reduce((a, b) => (gap(b) > gap(a) ? b : a)); // most positive gap

  const nav = state.navUsd;
  const minTradeUsd = Math.max(s.minTradeUsdFloor, (nav * s.minTradeBps) / 10000);
  const sizeBps = Math.min(-gap(from), gap(to)); // amount we can move that helps both sides
  let sizeUsd = clamp((sizeBps / 10000) * nav, 0, (mandate.maxSingleTradeBps / 10000) * nav);

  const predictedDirectionBps = Math.round(
    0.6 * view.momentumBps + (view.allora.ok && view.allora.directionBps !== null ? 0.4 * view.allora.directionBps : 0)
  );
  const confidenceBps = Math.round(view.confidence * 10000);
  const pct = (bps: number) => (bps / 100).toFixed(0);
  const base = {
    targets,
    targetWeightBps: Math.round(meth),
    currentWeightBps: Math.round(cur[RISK]),
    predictedDirectionBps,
    confidenceBps,
    riskOff: view.regime === "shock",
  };

  if (from === to || sizeBps <= 0 || sizeUsd < minTradeUsd) {
    return {
      ...base,
      action: "HOLD",
      fromSymbol: RISK,
      toSymbol: RISK,
      sizeUsd: 0,
      reason: `HOLD — on target (mETH ${pct(cur[RISK])}% / RWA ${pct(cur[YIELD])}% / USD ${pct(cur[STABLE])}%), ${view.regime}.`,
    };
  }

  const action: Proposal["action"] = to === RISK ? "ENTER" : from === RISK ? "DERISK" : "REBALANCE";
  let reason: string;
  if (action === "ENTER") {
    reason = `ENTER mETH +${pct(sizeBps)}% from ${from} (mom ${(view.momentumBps / 100).toFixed(1)}%, ${view.regime}, conf ${(view.confidence * 100).toFixed(0)}%).`;
  } else if (action === "DERISK") {
    reason = `DERISK mETH ${pct(sizeBps)}% → ${to} (${view.regime}; ${to === YIELD ? "rotate into RWA yield" : "raise USD buffer"}).`;
  } else {
    reason = `REBALANCE ${from}→${to} ${pct(sizeBps)}% — ${to === YIELD ? "deploy idle USD into RWA yield" : "raise USD buffer"} (${view.regime}).`;
  }

  return { ...base, action, fromSymbol: from, toSymbol: to, sizeUsd, reason };
}
