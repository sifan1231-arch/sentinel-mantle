import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * One-command, fully on-chain demo: runs a few autonomous-style decisions through the
 * deployed SentinelVault so judges can reproduce verifiable on-chain proof WITHOUT running
 * the TypeScript agent. Each action is a real Mantle tx that swaps in the pool AND writes a
 * decision to the DecisionRegistry. Prints tx hashes + NAV/PnL after each step.
 *
 * The real agent (npm run agent) does the same thing driven by LIVE market signals.
 */
function bytes32(s: string): string {
  return ethers.encodeBytes32String(s);
}

async function main() {
  const net = network.name;
  const file = path.resolve(__dirname, "..", "deployments", `${net}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment at ${file}. Run "npm run deploy" first.`);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const A = d.addresses;
  const [signer] = await ethers.getSigners();

  const oracle = await ethers.getContractAt("SentinelOracle", A.oracle, signer);
  const vault = await ethers.getContractAt("SentinelVault", A.vault, signer);
  const registry = await ethers.getContractAt("DecisionRegistry", A.registry, signer);
  const mUSD = await ethers.getContractAt("MockERC20", A.mUSD, signer);
  const mETH = await ethers.getContractAt("MockERC20", A.mETH, signer);

  const e8 = 10n ** 8n;
  const fmtUsd = (v: bigint) => "$" + (Number(v) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const txs: string[] = [];

  async function setEthPrice(p: number) {
    const tx = await oracle.setPrice(A.mETH, BigInt(Math.round(p * 1e8)));
    await tx.wait();
  }
  async function bumpRwaYield(factor: number) {
    const cur = Number((await oracle.getPrice(A.mRWA))[0]) / 1e8;
    const tx = await oracle.setPrice(A.mRWA, BigInt(Math.round(cur * factor * 1e8)));
    await tx.wait();
  }
  async function status(label: string) {
    const nav = await vault.nav();
    const pnl = await vault.totalPnlUsd();
    const n = await registry.decisionCount(d.agentId);
    console.log(`  ${label}: NAV ${fmtUsd(nav)} | PnL ${fmtUsd(pnl)} | decisions ${n}`);
  }
  async function execute(p: {
    action: string;
    from: string;
    to: string;
    amountIn: bigint;
    predBps: number;
    confBps: number;
    reason: string;
  }) {
    const params = {
      actionType: bytes32(p.action),
      fromAsset: p.from,
      toAsset: p.to,
      amountIn: p.amountIn,
      predictedDirectionBps: p.predBps,
      confidenceBps: p.confBps,
      signalsHash: ethers.id(p.reason),
      reason: p.reason,
      rationaleURI: "",
    };
    const tx = await vault.execute(params);
    const rcpt = await tx.wait();
    txs.push(tx.hash);
    console.log(`  → ${p.action}: ${tx.hash}`);
    return rcpt;
  }

  console.log("============================================================");
  console.log("Sentinel on-chain demo on", net);
  console.log("Explorer:", d.explorer + "/address/" + A.vault);
  console.log("============================================================\n");

  await status("start");

  // 1) Calm trend: deploy idle USD buffer into USDY-class RWA yield (don't sit in 0-yield cash).
  console.log("\n[1] Regime: calm. Deploy idle USD buffer → mRWA (USDY-class RWA yield).");
  await execute({
    action: "REBALANCE",
    from: A.mUSD,
    to: A.mRWA,
    amountIn: ethers.parseUnits("3000", 6),
    predBps: 30,
    confBps: 6000,
    reason: "Calm regime: deploy idle USD into USDY-class RWA yield",
  });
  await status("after #1");

  // 2) Bullish mETH signal → enter the risk sleeve (ETH staking + upside).
  console.log("\n[2] Signal: bullish mETH (smart-money inflow). ENTER the mETH risk sleeve.");
  await execute({
    action: "ENTER",
    from: A.mUSD,
    to: A.mETH,
    amountIn: ethers.parseUnits("2500", 6),
    predBps: 220,
    confBps: 7400,
    reason: "Smart-money inflow + momentum; rotate 25% into mETH staking sleeve",
  });
  await status("after #2");

  // 3) Thesis plays out: mETH +7% and USDY accrues yield → NAV rises (verifiable on-chain).
  console.log("\n[3] Market: mETH +7%, USDY yield accrues. NAV rises (verifiable on-chain).");
  const cur = Number((await oracle.getPrice(A.mETH))[0]) / 1e8;
  await setEthPrice(cur * 1.07);
  await bumpRwaYield(1.006); // ~0.6% RWA yield accrued over the period
  await status("after gains");

  // 4) Whale-shock anomaly → de-risk mETH into the RWA yield sleeve, lock gains.
  console.log("\n[4] Regime: SHOCK (whale anomaly). DERISK mETH → mRWA yield, lock gains.");
  const ethBal = await mETH.balanceOf(A.vault);
  await execute({
    action: "DERISK",
    from: A.mETH,
    to: A.mRWA,
    amountIn: (ethBal * 45n) / 100n,
    predBps: -60,
    confBps: 7200,
    reason: "Whale-shock anomaly; rotate 45% of mETH into USDY-class RWA yield",
  });
  await status("after #4");

  const nav = await vault.nav();
  const pnl = await vault.totalPnlUsd();
  const count = await registry.decisionCount(d.agentId);

  console.log("\n============================================================");
  console.log("DEMO COMPLETE");
  console.log("  Decisions logged on-chain:", count.toString());
  console.log("  Final NAV:", fmtUsd(nav), "| Total PnL:", fmtUsd(pnl));
  console.log("  Verifiable tx hashes:");
  for (const h of txs) console.log("   ", d.explorer + "/tx/" + h);
  console.log("============================================================");

  // Append sample tx hashes to the deployment file for the README.
  d.sampleTxs = txs;
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
