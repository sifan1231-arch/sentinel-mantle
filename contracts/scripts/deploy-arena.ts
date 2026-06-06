import { ethers, network, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const E8 = 10n ** 8n;
const usdToE8 = (u: number) => BigInt(Math.round(u * 1e8));

const NET_META: Record<string, { rpc: string; explorer: string; chainId: number }> = {
  mantleSepolia: { rpc: "https://rpc.sepolia.mantle.xyz", explorer: "https://sepolia.mantlescan.xyz", chainId: 5003 },
  mantle: { rpc: "https://rpc.mantle.xyz", explorer: "https://mantlescan.xyz", chainId: 5000 },
  localhost: { rpc: "http://127.0.0.1:8545", explorer: "http://localhost:8545", chainId: 31337 },
};
const ERC8004: Record<string, { identity: string; reputation: string }> = {
  mantleSepolia: { identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e", reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713" },
  mantle: { identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" },
  localhost: { identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e", reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713" },
};

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log("  wrote", path.relative(process.cwd(), filePath));
}

async function fetchPythBootstrap(): Promise<{ meth: number; usdy: number }> {
  const def = { meth: 3000, usdy: 1.05 };
  const FEED_METH = "0xfbc9c3a716650b6e24ab22ab85b1c0ef4141b18f4590cc0b986e2f9064cf73d6";
  const FEED_USDY = "0xe393449f6aff8a4b6d3e1165a7c9ebec103685f3b41e60db4277b5b6d10e7326";
  try {
    const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${FEED_METH}&ids[]=${FEED_USDY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return def;
    const j: any = await res.json();
    const byId = new Map<string, any>();
    for (const p of j?.parsed ?? []) byId.set(("0x" + p.id).toLowerCase(), p);
    const px = (feed: string, d: number) => {
      const p = byId.get(feed.toLowerCase());
      return p ? Number(p.price.price) * Math.pow(10, Number(p.price.expo)) : d;
    };
    return { meth: px(FEED_METH, def.meth), usdy: px(FEED_USDY, def.usdy) };
  } catch {
    return def;
  }
}

async function main() {
  const net = network.name;
  const meta = NET_META[net];
  if (!meta) throw new Error(`Unsupported network "${net}". Use mantleSepolia | mantle | localhost.`);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — set PRIVATE_KEY in .env and fund it at https://faucet.mantle.xyz");
  const startBlock = await ethers.provider.getBlockNumber();
  const bal = await ethers.provider.getBalance(deployer.address);
  const agentAddr = (process.env.AGENT_ADDRESS || deployer.address).trim();

  const root = path.resolve(__dirname, "..", "..");
  const { seedUsd, personas } = JSON.parse(fs.readFileSync(path.join(root, "personas.json"), "utf8"));

  console.log("============================================================");
  console.log("Deploying SENTINEL ARENA to", net, `(chainId ${meta.chainId})`);
  console.log("Deployer:", deployer.address, "| balance", ethers.formatEther(bal), "MNT");
  console.log("Roster:", personas.map((p: any) => `${p.emoji}${p.name}`).join(" "));
  console.log("============================================================\n");
  if (bal === 0n) throw new Error("Deployer has 0 MNT. Get testnet MNT at https://faucet.mantle.xyz");

  // ---- shared infrastructure ----
  console.log("[infra] Oracle / mocks / pool / registry / arena...");
  const oracle = await (await ethers.getContractFactory("SentinelOracle")).deploy();
  await oracle.waitForDeployment();
  const Mock = await ethers.getContractFactory("MockERC20");
  const mUSD = await Mock.deploy("Sentinel Mock USD", "mUSD", 6, ethers.parseUnits("8000000", 6), deployer.address);
  const mETH = await Mock.deploy("Sentinel Mock ETH", "mETH", 18, ethers.parseUnits("8000", 18), deployer.address);
  const mRWA = await Mock.deploy("Sentinel Mock RWA (USDY-class)", "mRWA", 18, ethers.parseUnits("8000000", 18), deployer.address);
  await Promise.all([mUSD.waitForDeployment(), mETH.waitForDeployment(), mRWA.waitForDeployment()]);
  const pool = await (await ethers.getContractFactory("SentinelPool")).deploy(await oracle.getAddress());
  await pool.waitForDeployment();
  const registry = await (await ethers.getContractFactory("DecisionRegistry")).deploy();
  await registry.waitForDeployment();
  const arena = await (await ethers.getContractFactory("AgentArena")).deploy(await registry.getAddress());
  await arena.waitForDeployment();

  const oracleAddr = await oracle.getAddress();
  const mUSDAddr = await mUSD.getAddress();
  const mETHAddr = await mETH.getAddress();
  const mRWAAddr = await mRWA.getAddress();
  const poolAddr = await pool.getAddress();
  const registryAddr = await registry.getAddress();
  const arenaAddr = await arena.getAddress();
  const assets = [mUSDAddr, mETHAddr, mRWAAddr];

  // ---- bootstrap real prices ----
  const px = await fetchPythBootstrap();
  console.log(`[prices] bootstrap (Pyth): mETH $${px.meth.toFixed(2)}, USDY $${px.usdy.toFixed(4)}`);
  await (await oracle.setPrices(assets, [1n * E8, usdToE8(px.meth), usdToE8(px.usdy)])).wait();
  if (agentAddr.toLowerCase() !== deployer.address.toLowerCase()) await (await oracle.setOperator(agentAddr, true)).wait();

  // ---- seed the shared pool (deep enough for six vaults) ----
  console.log("[pool] seeding shared liquidity...");
  await (await mUSD.approve(poolAddr, ethers.MaxUint256)).wait();
  await (await mETH.approve(poolAddr, ethers.MaxUint256)).wait();
  await (await mRWA.approve(poolAddr, ethers.MaxUint256)).wait();
  await (await pool.addLiquidity(mUSDAddr, ethers.parseUnits("3000000", 6))).wait();
  await (await pool.addLiquidity(mETHAddr, ethers.parseUnits("2000", 18))).wait();
  await (await pool.addLiquidity(mRWAAddr, ethers.parseUnits("3000000", 18))).wait();

  // ---- deploy + configure + enter each persona ----
  const VaultF = await ethers.getContractFactory("SentinelVault");
  const seed6 = ethers.parseUnits(String(seedUsd), 6);
  const agents: any[] = [];

  for (const p of personas) {
    process.stdout.write(`[agent] ${p.emoji} ${p.name} ... `);
    const vault = await VaultF.deploy(oracleAddr, poolAddr, registryAddr);
    await vault.waitForDeployment();
    const vaultAddr = await vault.getAddress();

    await (await registry.register(`ipfs://sentinel-arena/${p.key}`)).wait();
    const agentId = await registry.totalAgents();
    await (await registry.setOperator(agentId, vaultAddr, true)).wait();
    if (agentAddr.toLowerCase() !== deployer.address.toLowerCase()) {
      await (await registry.setOperator(agentId, agentAddr, true)).wait();
    }

    await (await vault.setAgentId(agentId)).wait();
    await (await vault.addAssets(assets)).wait();
    await (await vault.setOperator(agentAddr, true)).wait();
    await (await vault.setMandate(p.mandate)).wait();

    // equal seed for a fair race
    await (await mUSD.approve(vaultAddr, seed6)).wait();
    await (await vault.deposit(mUSDAddr, seed6)).wait();

    await (await arena.join(vaultAddr, p.name, p.persona)).wait();

    agents.push({
      key: p.key,
      name: p.name,
      persona: p.persona,
      blurb: p.blurb,
      catchphrase: p.catchphrase,
      emoji: p.emoji,
      color: p.color,
      vault: vaultAddr,
      agentId: Number(agentId),
      mandate: p.mandate,
    });
    console.log(`id ${agentId} @ ${vaultAddr}`);
  }

  console.log(`\n[arena] ${await arena.count()} agents in the colosseum. Reading leaderboard...`);
  const board = await arena.leaderboard();
  for (const s of board) console.log(`   ${s.name}: NAV $${(Number(s.navUsd) / 1e8).toFixed(0)} · score ${s.turingScore}`);

  // ---- outputs ----
  console.log("\nWriting deployment artifacts...");
  const names = ["SentinelOracle", "MockERC20", "SentinelPool", "DecisionRegistry", "SentinelVault", "AgentArena"];
  const abis: Record<string, unknown> = {};
  for (const n of names) abis[n] = (await artifacts.readArtifact(n)).abi;

  const deployment = {
    mode: "arena",
    network: net,
    chainId: meta.chainId,
    rpc: meta.rpc,
    explorer: meta.explorer,
    deployer: deployer.address,
    agentOperator: agentAddr,
    startBlock,
    seedUsd,
    erc8004: ERC8004[net],
    addresses: { oracle: oracleAddr, mUSD: mUSDAddr, mETH: mETHAddr, mRWA: mRWAAddr, pool: poolAddr, registry: registryAddr, arena: arenaAddr },
    agents,
    constructorArgs: {
      SentinelOracle: [],
      "MockERC20:mUSD": ["Sentinel Mock USD", "mUSD", 6, ethers.parseUnits("8000000", 6).toString(), deployer.address],
      "MockERC20:mETH": ["Sentinel Mock ETH", "mETH", 18, ethers.parseUnits("8000", 18).toString(), deployer.address],
      "MockERC20:mRWA": ["Sentinel Mock RWA (USDY-class)", "mRWA", 18, ethers.parseUnits("8000000", 18).toString(), deployer.address],
      SentinelPool: [oracleAddr],
      DecisionRegistry: [],
      AgentArena: [registryAddr],
      SentinelVault: [oracleAddr, poolAddr, registryAddr],
    },
  };

  const cdir = path.resolve(__dirname, "..");
  writeJson(path.join(cdir, "deployments", `arena.${net}.json`), deployment);
  writeJson(path.join(cdir, "deployments", "abis.json"), abis);
  writeJson(path.resolve(cdir, "..", "web", "lib", "deployment.generated.json"), {
    ...deployment,
    abis: {
      AgentArena: abis.AgentArena,
      DecisionRegistry: abis.DecisionRegistry,
      SentinelVault: abis.SentinelVault,
      SentinelOracle: abis.SentinelOracle,
      MockERC20: abis.MockERC20,
    },
  });

  console.log("\n============================================================");
  console.log("ARENA LIVE.  Run the orchestrator:  npm run arena   (from repo root)");
  console.log("Arena:", `${meta.explorer}/address/${arenaAddr}`);
  console.log("============================================================");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
