import { ethers } from "ethers";
import { e8ToUsd, usdToE8 } from "../util";
import { SYMBOLS, LOG_HOLDS } from "../config";
import type { Chain } from "../chain";
import type { Decision, MarketView, VaultState } from "../types";

/** Send a tx with retry on transient nonce/network errors (NOT on genuine reverts). Returns the hash. */
async function sendTx(fn: () => Promise<any>): Promise<string> {
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const tx = await fn();
      const receipt = await tx.wait();
      if (receipt && receipt.status === 0) throw new Error("transaction reverted on-chain");
      return tx.hash;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.shortMessage || e?.info?.error?.message || e?.message || e);
      if (/nonce|replacement|already known|coalesce|too many requests|timeout|SERVER_ERROR|ECONN/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue; // transient — retry
      }
      throw e; // real revert (mandate guard etc.) — surface it
    }
  }
  throw lastErr;
}

/** Read the full vault state on-chain (NAV / PnL / weights / balances / halt). */
export async function readVaultState(chain: Chain): Promise<VaultState> {
  const v = chain.vault;
  const [nav, pnl, costBasis, hwm, halted, count] = await Promise.all([
    v.nav(),
    v.totalPnlUsd(),
    v.costBasisUsd(),
    v.highWaterMarkUsd(),
    v.halted(),
    chain.registry.decisionCount(chain.agentId),
  ]);
  const navN = e8ToUsd(nav);

  const weightsBps: Record<string, number> = {};
  const balances: Record<string, bigint> = {};
  for (const sym of SYMBOLS) {
    balances[sym] = await chain.tokens[sym].balanceOf(chain.addr.vault);
    const valE8 = await v.assetValueUsd(chain.addr[sym]);
    weightsBps[sym] = navN > 0 ? (e8ToUsd(valE8) / navN) * 10000 : 0;
  }

  return {
    navUsd: navN,
    pnlUsd: e8ToUsd(pnl),
    costBasisUsd: e8ToUsd(costBasis),
    highWaterUsd: e8ToUsd(hwm),
    halted,
    weightsBps,
    balances,
    decisionCount: Number(count),
  };
}

async function pushPriceSafely(oracle: any, asset: string, targetE8: bigint) {
  let current = 0n;
  try {
    current = (await oracle.getPrice(asset))[0] as bigint;
  } catch {
    current = 0n;
  }
  if (current === 0n) {
    await sendTx(() => oracle.setPrice(asset, targetE8));
    return;
  }
  let price = current;
  for (let i = 0; i < 12 && price !== targetE8; i++) {
    const diff = targetE8 > price ? targetE8 - price : price - targetE8;
    const maxStep = (price * 24n) / 100n; // stay within the oracle's 25% deviation guard
    const next = diff > maxStep ? (targetE8 > price ? price + maxStep : price - maxStep) : targetE8;
    if (next === price) break;
    await sendTx(() => oracle.setPrice(asset, next));
    price = next;
  }
}

/** Push fresh REAL prices to the on-chain oracle (one batched tx; falls back to stepping). */
export async function pushPrices(chain: Chain, view: MarketView): Promise<void> {
  const assets = SYMBOLS.map((s) => chain.addr[s]);
  const prices = SYMBOLS.map((s) => usdToE8(view.prices[s]));
  try {
    await sendTx(() => chain.oracle.setPrices(assets, prices));
  } catch {
    // A push exceeded the deviation guard (e.g. first reconciliation) → step each asset in.
    for (let i = 0; i < SYMBOLS.length; i++) await pushPriceSafely(chain.oracle, assets[i], prices[i]);
  }
}

/**
 * The Operator turns a vetted decision into verifiable on-chain action:
 *  1) trips the drawdown circuit breaker if breached (latching, its own tx),
 *  2) executes the rebalance atomically with its decision log (or logs a HOLD),
 *  3) returns the tx hash for proof.
 */
export async function act(chain: Chain, decision: Decision, view: MarketView): Promise<string | null> {
  try {
    await sendTx(() => chain.vault.tripBreakerIfBreached());
  } catch {
    /* non-fatal */
  }

  const shortReason = decision.reason.slice(0, 140);

  if (decision.action === "HOLD" || decision.vetoed || decision.amountIn === 0n) {
    if (LOG_HOLDS && !decision.vetoed) {
      try {
        return await sendTx(() =>
          chain.registry.logDecision(chain.agentId, {
            actionType: ethers.encodeBytes32String("HOLD"),
            fromAsset: ethers.ZeroAddress,
            toAsset: ethers.ZeroAddress,
            amount: 0,
            predictedDirectionBps: decision.predictedDirectionBps,
            confidenceBps: decision.confidenceBps,
            signalsHash: view.signalsHash,
            realizedPnl: 0,
            reason: shortReason,
            rationaleURI: "",
          })
        );
      } catch {
        return null;
      }
    }
    return null;
  }

  const params = {
    actionType: ethers.encodeBytes32String(decision.action),
    fromAsset: decision.fromAsset,
    toAsset: decision.toAsset,
    amountIn: decision.amountIn,
    predictedDirectionBps: decision.predictedDirectionBps,
    confidenceBps: decision.confidenceBps,
    signalsHash: view.signalsHash,
    reason: shortReason,
    rationaleURI: "",
  };

  try {
    return await sendTx(() => chain.vault.execute(params));
  } catch (e: any) {
    // A late guard (e.g. a price moved between Warden's check and execution) → decline safely.
    console.warn("   execute() declined by an on-chain guard:", String(e?.shortMessage || e?.message || e).slice(0, 120));
    return null;
  }
}
