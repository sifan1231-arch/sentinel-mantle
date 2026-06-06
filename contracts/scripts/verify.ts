import { run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const net = network.name;
  // Arena deployment first; fall back to the legacy single-agent file.
  const arenaFile = path.resolve(__dirname, "..", "deployments", `arena.${net}.json`);
  const legacyFile = path.resolve(__dirname, "..", "deployments", `${net}.json`);
  const file = fs.existsSync(arenaFile) ? arenaFile : legacyFile;
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment found at ${arenaFile}. Run "npm run deploy:arena" first.`);
  }
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const ca = d.constructorArgs;
  const a = d.addresses;

  const tasks: { name: string; address: string; args: unknown[] }[] = [
    { name: "SentinelOracle", address: a.oracle, args: ca.SentinelOracle },
    { name: "mUSD (MockERC20)", address: a.mUSD, args: ca["MockERC20:mUSD"] },
    { name: "mETH (MockERC20)", address: a.mETH, args: ca["MockERC20:mETH"] },
    { name: "mRWA (MockERC20)", address: a.mRWA, args: ca["MockERC20:mRWA"] },
    { name: "SentinelPool", address: a.pool, args: ca.SentinelPool },
    { name: "DecisionRegistry", address: a.registry, args: ca.DecisionRegistry },
  ];
  if (a.arena && ca.AgentArena) {
    tasks.push({ name: "AgentArena", address: a.arena, args: ca.AgentArena });
  }
  // The six persona vaults share the same SentinelVault source + constructor args.
  if (Array.isArray(d.agents) && ca.SentinelVault) {
    for (const ag of d.agents) {
      tasks.push({ name: `SentinelVault (${ag.name})`, address: ag.vault, args: ca.SentinelVault });
    }
  } else if (a.vault && ca.SentinelVault) {
    tasks.push({ name: "SentinelVault", address: a.vault, args: ca.SentinelVault });
  }

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
  if (a.arena) console.log(`Arena: ${d.explorer}/address/${a.arena}#code`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
