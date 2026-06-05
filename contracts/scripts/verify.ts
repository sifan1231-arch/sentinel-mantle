import { run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const net = network.name;
  const file = path.resolve(__dirname, "..", "deployments", `${net}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment found at ${file}. Run "npm run deploy" first.`);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const ca = d.constructorArgs;

  const tasks: { name: string; address: string; args: unknown[] }[] = [
    { name: "SentinelOracle", address: d.addresses.oracle, args: ca.SentinelOracle },
    { name: "mUSD (MockERC20)", address: d.addresses.mUSD, args: ca["MockERC20:mUSD"] },
    { name: "mETH (MockERC20)", address: d.addresses.mETH, args: ca["MockERC20:mETH"] },
    { name: "mRWA (MockERC20)", address: d.addresses.mRWA, args: ca["MockERC20:mRWA"] },
    { name: "SentinelPool", address: d.addresses.pool, args: ca.SentinelPool },
    { name: "DecisionRegistry", address: d.addresses.registry, args: ca.DecisionRegistry },
    { name: "SentinelVault", address: d.addresses.vault, args: ca.SentinelVault },
  ];

  let ok = 0;
  for (const t of tasks) {
    console.log(`\nVerifying ${t.name} @ ${t.address} ...`);
    try {
      await run("verify:verify", { address: t.address, constructorArguments: t.args });
      console.log("  ✅ verified");
      ok++;
    } catch (e: unknown) {
      const msg = String((e as Error)?.message || e);
      if (/already verified/i.test(msg)) {
        console.log("  ✅ already verified");
        ok++;
      } else {
        console.error("  ⚠️  verify failed:", msg.split("\n")[0]);
      }
    }
  }
  console.log(`\n${ok}/${tasks.length} contracts verified on ${d.explorer}`);
  console.log(`Vault: ${d.explorer}/address/${d.addresses.vault}#code`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
