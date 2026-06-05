import { ethers } from "ethers";
import { fetchPrices } from "../signals/pyth";
import { readMantleFlow } from "../signals/onchain";
import { fetchAllora } from "../signals/allora";
import { clamp, mean, std } from "../util";
import { RISK, YIELD, STRATEGY } from "../config";
import { AgentState, pushPrice } from "../state";
import type { MarketView, Regime } from "../types";

const finite = (x: number, d = 0) => (Number.isFinite(x) ? x : d);

/**
 * The Scout senses the market: REAL Pyth prices (mETH/USDY), REAL Mantle-mainnet mETH flow,
 * and an optional Allora forecast. It derives momentum, volatility, a smart-money flow proxy,
 * a whale-anomaly z-score, and a market REGIME (trend / chop / shock) that gates risk + sizing —
 * then commits the snapshot to a hash. All outputs are sanitized against NaN/Infinity.
 */
export async function observe(agentState: AgentState): Promise<MarketView> {
  const [prices, flow, allora] = await Promise.all([fetchPrices(), readMantleFlow(), fetchAllora()]);

  const meth = prices[RISK];
  pushPrice(agentState, RISK, meth.usd);
  pushPrice(agentState, YIELD, prices[YIELD].usd);

  // Momentum: price vs Pyth EMA, refined by our own short/long history when available.
  let momentumBps = meth.emaUsd > 0 ? ((meth.usd - meth.emaUsd) / meth.emaUsd) * 10000 : 0;
  const hist = (agentState.priceHistory[RISK] ?? []).filter((x) => Number.isFinite(x) && x > 0);
  if (hist.length >= 4) {
    const shortAvg = mean(hist.slice(-3));
    const longAvg = mean(hist.slice(-Math.min(hist.length, 12)));
    if (longAvg > 0) momentumBps = 0.5 * momentumBps + 0.5 * ((shortAvg - longAvg) / longAvg) * 10000;
  }
  momentumBps = clamp(finite(momentumBps), -1500, 1500);

  // Volatility: Pyth confidence blended with realized stdev of recent returns.
  let volBps = finite(meth.confBps);
  if (hist.length >= 5) {
    const rets: number[] = [];
    for (let i = 1; i < hist.length; i++) if (hist[i - 1] > 0) rets.push((hist[i] - hist[i - 1]) / hist[i - 1]);
    volBps = Math.max(volBps, finite(std(rets) * 10000));
  }
  volBps = clamp(volBps, 0, 2000);

  // Flow: on-chain whale activity aligned with the price-vs-EMA direction.
  const anomalyZ = clamp(finite(Math.abs(flow.whaleZ)), 0, 10);
  let flowSignal = 0;
  if (flow.ok && flow.txCount > 0 && flow.totalVolume > 0) {
    const intensity = clamp(flow.largeTransferVolume / flow.totalVolume, 0, 1);
    const dir = Math.sign(momentumBps) || 1;
    flowSignal = clamp(dir * intensity, -1, 1);
  }
  flowSignal = finite(flowSignal);

  // Regime: shock dominates (anomaly or high vol); else trend if directional; else chop.
  let regime: Regime = "chop";
  if (anomalyZ > STRATEGY.anomalyZTrigger || volBps > STRATEGY.shockVolBps) regime = "shock";
  else if (Math.abs(momentumBps) > STRATEGY.trendMomentumBps) regime = "trend";

  // Confidence: strong momentum + low vol + flow agreement (+ Allora), minus anomaly/short history.
  const momentumStrength = clamp(Math.abs(momentumBps) / 600, 0, 1);
  const volPenalty = clamp(volBps / 600, 0, 1);
  const flowAgree = clamp(Math.abs(flowSignal), 0, 1);
  let confidence = clamp(0.35 + 0.4 * momentumStrength + 0.2 * flowAgree - 0.25 * volPenalty, 0.05, 0.95);
  if (allora.ok && allora.directionBps !== null && Math.sign(allora.directionBps) === Math.sign(momentumBps)) {
    confidence = clamp(confidence + 0.1, 0, 0.97);
  }
  if (regime === "shock") confidence = clamp(confidence - 0.15, 0.05, 0.95);
  if (hist.length < 8) confidence = clamp(confidence * 0.85, 0.05, 0.95); // less certain while warming up
  confidence = finite(confidence, 0.3);

  const notes: string[] = [];
  notes.push(
    `${meth.source} mETH $${meth.usd.toFixed(2)} vs EMA $${meth.emaUsd.toFixed(2)} → momentum ${(momentumBps / 100).toFixed(2)}%`
  );
  notes.push(`regime ${regime.toUpperCase()} · vol ${(volBps / 100).toFixed(2)}% · conf ${(confidence * 100).toFixed(0)}%`);
  notes.push(
    flow.ok
      ? `${flow.note}; large-flow ${(flowSignal >= 0 ? "+" : "")}${(flowSignal * 100).toFixed(0)}%, whaleZ ${flow.whaleZ.toFixed(2)}${regime === "shock" ? "  ⚠ SHOCK" : ""}`
      : "on-chain flow unavailable (price-only mode)"
  );
  notes.push(`USDY (mRWA) $${prices[YIELD].usd.toFixed(4)} — RWA yield sleeve`);
  if (allora.ok && allora.directionBps !== null) notes.push(`Allora forecast ${allora.directionBps.toFixed(0)}bps`);

  const snapshot = {
    p: +meth.usd.toFixed(4),
    ema: +meth.emaUsd.toFixed(4),
    momentumBps: +momentumBps.toFixed(2),
    volBps: +volBps.toFixed(2),
    flowSignal: +flowSignal.toFixed(3),
    anomalyZ: +anomalyZ.toFixed(2),
    regime,
    allora: allora.directionBps,
    usdy: +prices[YIELD].usd.toFixed(4),
  };
  const signalsHash = ethers.id(JSON.stringify(snapshot));

  return {
    prices: { mUSD: 1, mETH: prices.mETH.usd, mRWA: prices.mRWA.usd },
    ema: { mETH: prices.mETH.emaUsd, mRWA: prices.mRWA.emaUsd },
    momentumBps,
    volatilityBps: volBps,
    flowSignal,
    anomalyZ,
    regime,
    allora,
    confidence,
    notes,
    signalsHash,
    raw: { prices, flow, snapshot },
  };
}
