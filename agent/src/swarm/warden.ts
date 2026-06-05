import { propose, MandateView } from "../brain/decide";
import { usdToTokenAmount } from "../util";
import { RISK } from "../config";
import type { Chain } from "../chain";
import type { Decision, MarketView, VaultState } from "../types";

function hold(view: MarketView, reason: string, vetoed: boolean, targetBps = 0, curBps = 0): Decision {
  return {
    action: "HOLD",
    fromSymbol: RISK,
    toSymbol: RISK,
    fromAsset: "0x0000000000000000000000000000000000000000",
    toAsset: "0x0000000000000000000000000000000000000000",
    amountIn: 0n,
    sizeUsd: 0,
    predictedDirectionBps: Math.round(0.6 * view.momentumBps),
    confidenceBps: Math.round(view.confidence * 10000),
    reason,
    targetWeightBps: targetBps,
    currentWeightBps: curBps,
    vetoed,
    vetoReason: vetoed ? reason : "",
  };
}

/** USD value (float) of `amountIn` of an asset, computed in bigint to avoid precision loss. */
function moveUsd(amountIn: bigint, priceUsd: number, decimals: number): number {
  const priceE8 = BigInt(Math.round(priceUsd * 1e8));
  const usdE8 = (amountIn * priceE8) / 10n ** BigInt(decimals);
  return Number(usdE8) / 1e8;
}

/**
 * The Warden enforces the risk mandate BEFORE anything touches the chain. It mirrors every
 * on-chain guard (so executions don't revert), can veto outright, and downsizes any trade that
 * would breach the per-asset weight cap or the wallet balance — for ANY destination asset.
 */
export function assess(view: MarketView, state: VaultState, mandate: MandateView, chain: Chain): Decision {
  if (state.halted) return hold(view, "VETO — vault halted (drawdown circuit breaker tripped).", true);
  if (!(state.navUsd > 0)) return hold(view, "VETO — vault NAV is zero.", true);

  const p = propose(view, state, mandate);
  if (p.action === "HOLD") return hold(view, p.reason, false, p.targetWeightBps, p.currentWeightBps);

  const fromDec = chain.decimals[p.fromSymbol];
  const priceFrom = view.prices[p.fromSymbol];
  if (!(priceFrom > 0)) return hold(view, `VETO — no price for ${p.fromSymbol}.`, true, p.targetWeightBps, p.currentWeightBps);

  let amountIn = usdToTokenAmount(p.sizeUsd, priceFrom, fromDec);
  const bal = state.balances[p.fromSymbol] ?? 0n;
  if (amountIn > bal) amountIn = bal;
  if (amountIn === 0n) return hold(view, `VETO — insufficient ${p.fromSymbol} balance to act.`, true, p.targetWeightBps, p.currentWeightBps);

  // Mirror the on-chain per-asset weight cap on the BOUGHT asset (any sleeve) so execute() can't revert.
  const nav = state.navUsd;
  const moved = moveUsd(amountIn, priceFrom, fromDec);
  const projectedToUsd = ((state.weightsBps[p.toSymbol] ?? 0) / 10000) * nav + moved;
  const projWeightBps = (projectedToUsd / nav) * 10000;
  if (projWeightBps > mandate.maxAssetWeightBps) {
    const headroomUsd = Math.max(0, (mandate.maxAssetWeightBps / 10000) * nav - ((state.weightsBps[p.toSymbol] ?? 0) / 10000) * nav);
    amountIn = usdToTokenAmount(headroomUsd * 0.98, priceFrom, fromDec);
    if (amountIn > bal) amountIn = bal;
    if (amountIn === 0n) return hold(view, `VETO — ${p.toSymbol} already at its weight cap.`, true, p.targetWeightBps, p.currentWeightBps);
  }

  return {
    action: p.action,
    fromSymbol: p.fromSymbol,
    toSymbol: p.toSymbol,
    fromAsset: chain.addr[p.fromSymbol],
    toAsset: chain.addr[p.toSymbol],
    amountIn,
    sizeUsd: p.sizeUsd,
    predictedDirectionBps: p.predictedDirectionBps,
    confidenceBps: p.confidenceBps,
    reason: p.reason,
    targetWeightBps: p.targetWeightBps,
    currentWeightBps: p.currentWeightBps,
    vetoed: false,
    vetoReason: "",
  };
}
