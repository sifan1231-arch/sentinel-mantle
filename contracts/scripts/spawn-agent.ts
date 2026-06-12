// Spawn YOUR OWN fighter into an existing Sentinel Arena.
//
//   npm run spawn                       (root; defaults below, Mantle Sepolia)
//   SPAWN_NAME=NOVA SPAWN_STYLE=degen SPAWN_SEED=10000 npm run spawn
//
// What it does — fully permissionless, any funded testnet wallet works:
//   1. deploys a fresh SentinelVault wired to the arena's oracle/pool/registry
//   2. registers a new ERC-8004-aligned identity in the DecisionRegistry
//   3. locks your chosen risk mandate INSIDE the vault (you can't break it later)
//   4. seeds the vault from the open mUSD faucet (testnet instrument)
//   5. arena.join() — your fighter appears on the public leaderboard
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const STYLES: Record<string, { maxSingleTradeBps: number; maxAssetWeightBps: number; maxDrawdownBps: number; slippageBps: number; cooldown: number }> = {
  // bold: big positions, deep drawdown tolerance
  degen: { maxSingleTradeBps: 5000, maxAssetWeightBps: 9000, maxDrawdownBps: 4000, slippageBps: 200, cooldown: 0 },
  // the all-rounder
  balanced: { maxSingleTradeBps: 3000, maxAssetWeightBps: 7500, maxDrawdownBps: 2000, slippageBps: 150, cooldown: 30 },
  // capital preservation first
  guardian: { maxSingleTradeBps: 2000, maxAssetWeightBps: 6000, maxDrawdownBps: 1200, slippageBps: 100, cooldown: 60 },
};

async function main() {
  const net = network.name;
  const file = path.resolve(__dirname, "..", "deployments", `arena.${net}.json`);
  if (!fs.existsSync(file)) throw new Error(`No arena deployment at ${file}. Run "npm run deploy:arena" first.`);
  const dep = JSON.parse(fs.readFileSync(file, "utf8"));

  const name = (process.env.SPAWN_NAME || "NOVA").trim().slice(0, 24);
  const persona = (process.env.SPAWN_PERSONA || "The Challenger").trim().slice(0, 48);
  const styleKey = (process.env.SPAWN_STYLE || "balanced").trim().toLowerCase();
  const mandate = STYLES[styleKey];
  if (!mandate) throw new Error(`Unknown SPAWN_STYLE "${styleKey}". Use: ${Object.keys(STYLES).join(" | ")}`);
  const seedUsd = Math.max(1, Math.min(100_000, Number(process.env.SPAWN_SEED || dep.seedUsd || 10_000)));

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer — set PRIVATE_KEY in .env and fund it at https://faucet.mantle.xyz");
  const bal = await ethers.provider.getBalance(signer.address);

  console.log("============================================================");
  console.log(`Spawning "${name}" (${persona}) — style ${styleKey} — into the arena on ${net}`);
  console.log("Wallet:", signer.address, "| balance", ethers.formatEther(bal), "MNT");
  console.log("Arena :", dep.addresses.arena);
  console.log("============================================================\n");
  if (bal === 0n) throw new Error("Wallet has 0 MNT for gas. Get free testnet MNT at https://faucet.mantle.xyz");

  const registry = await ethers.getContractAt("DecisionRegistry", dep.addresses.registry, signer);
  const arena = await ethers.getContractAt("AgentArena", dep.addresses.arena, signer);
  const mUSD = await ethers.getContractAt("MockERC20", dep.addresses.mUSD, signer);

  // 1) a fresh vault, wired to the shared rails
  process.stdout.write("[1/5] deploying your SentinelVault ... ");
  const vault = await (await ethers.getContractFactory("SentinelVault", signer)).deploy(
    dep.addresses.oracle,
    dep.addresses.pool,
    dep.addresses.registry
  );
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(vaultAddr);

  // 2) a real on-chain identity
  process.stdout.write("[2/5] registering an ERC-8004-aligned identity ... ");
  await (await registry.register(`ipfs://sentinel-arena/spawn/${name.toLowerCase()}`)).wait();
  const agentId = await registry.totalAgents();
  await (await registry.setOperator(agentId, vaultAddr, true)).wait();
  console.log(`agentId ${agentId}`);

  // 3) the mandate is law — enforced inside the vault
  process.stdout.write("[3/5] locking your risk mandate into the vault ... ");
  await (await vault.setAgentId(agentId)).wait();
  await (await vault.addAssets([dep.addresses.mUSD, dep.addresses.mETH, dep.addresses.mRWA])).wait();
  await (await vault.setOperator(signer.address, true)).wait();
  await (await vault.setMandate(mandate)).wait();
  console.log(`${mandate.maxSingleTradeBps / 100}%/trade · ${mandate.maxAssetWeightBps / 100}% cap · halt ${mandate.maxDrawdownBps / 100}%`);

  // 4) seed from the open testnet faucet if the wallet is short
  process.stdout.write(`[4/5] seeding $${seedUsd.toLocaleString("en-US")} mUSD ... `);
  const seed6 = ethers.parseUnits(String(seedUsd), 6);
  if ((await mUSD.balanceOf(signer.address)) < seed6) {
    await (await mUSD.faucet(seed6)).wait(); // open faucet, testnet instrument
  }
  await (await mUSD.approve(vaultAddr, seed6)).wait();
  await (await vault.deposit(dep.addresses.mUSD, seed6)).wait();
  console.log("done");

  // 5) enter the colosseum
  process.stdout.write("[5/5] arena.join() ... ");
  await (await arena.join(vaultAddr, name, persona)).wait();
  console.log("IN.\n");

  // record locally (the house roster in deployment.generated.json is untouched)
  const spawnedFile = path.resolve(__dirname, "..", "deployments", `spawned.${net}.json`);
  const spawned = fs.existsSync(spawnedFile) ? JSON.parse(fs.readFileSync(spawnedFile, "utf8")) : [];
  spawned.push({ name, persona, style: styleKey, vault: vaultAddr, agentId: Number(agentId), owner: signer.address, seedUsd });
  fs.writeFileSync(spawnedFile, JSON.stringify(spawned, null, 2));

  const board = await arena.leaderboard();
  console.log(`The colosseum now holds ${board.length} fighters:`);
  for (const s of board) console.log(`   ${s.name}: NAV $${(Number(s.navUsd) / 1e8).toFixed(0)} · score ${s.turingScore}`);
  console.log("\n============================================================");
  console.log(`"${name}" is live. Watch it on the public leaderboard — it refreshes within ~8s.`);
  console.log("Vault:", `${dep.explorer}/address/${vaultAddr}`);
  console.log("To trade, point the orchestrator at your vault (agent/src/arena.ts) or call vault.execute().");
  console.log("============================================================");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
