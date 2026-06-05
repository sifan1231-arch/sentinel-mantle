import { ethers, network, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const E8 = 10n ** 8n;

// Per-network public metadata (verified).
const NET_META: Record<string, { rpc: string; explorer: string; chainId: number }> = {
  mantleSepolia: { rpc: "https://rpc.sepolia.mantle.xyz", explorer: "https://sepolia.mantlescan.xyz", chainId: 5003 },
  mantle: { rpc: "https://rpc.mantle.xyz", explorer: "https://mantlescan.xyz", chainId: 5000 },
  // Local hardhat node for end-to-end testing (npx hardhat node).
  localhost: { rpc: "http://127.0.0.1:8545", explorer: "http://localhost:8545", chainId: 31337 },
};

// Verified canonical ERC-8004 registries (CREATE2 vanity, same on Mantle).
const ERC8004: Record<string, { identity: string; reputation: string }> = {
  mantleSepolia: {
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
  mantle: {
    identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  },
  // Placeholder for local testing (canonical registry not deployed on a fresh local node).
  localhost: {
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
};

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log("  wrote", path.relative(process.cwd(), filePath));
}

const usdToE8 = (u: number) => BigInt(Math.round(u * 1e8));

// Seed the oracle with REAL prices at deploy time (Pyth Hermes), so the agent's first
// on-chain push is a small delta — no multi-step reconciliation, no nonce bursts.
async function fetchPythBootstrap(): Promise<{ meth: number; usdy: number }> {
  const def = { meth: 3000, usdy: 1.04 };
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
  if (!meta) throw new Error(`Unsupported network "${net}". Use mantleSepolia or mantle.`);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — set PRIVATE_KEY in .env and fund it at https://faucet.mantle.xyz");
  const bal = await ethers.provider.getBalance(deployer.address);
  const startBlock = await ethers.provider.getBlockNumber();

  console.log("============================================================");
  console.log("Deploying Sentinel to", net, `(chainId ${meta.chainId})`);
  console.log("Deployer:", deployer.address);
  console.log("Balance :", ethers.formatEther(bal), "MNT");
  console.log("============================================================\n");
  if (bal === 0n) {
    throw new Error("Deployer has 0 MNT. Get testnet MNT at https://faucet.mantle.xyz");
  }

  const agentAddr = (process.env.AGENT_ADDRESS || deployer.address).trim();

  // 1) Oracle
  console.log("[1/6] SentinelOracle...");
  const oracle = await (await ethers.getContractFactory("SentinelOracle")).deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("      ", oracleAddr);

  // 2) Mock assets (testnet instruments representing real Mantle assets, priced with real data)
  console.log("[2/6] Mock assets (mUSD/mETH/mRWA)...");
  const Mock = await ethers.getContractFactory("MockERC20");
  const mUSD = await Mock.deploy("Sentinel Mock USD", "mUSD", 6, ethers.parseUnits("2000000", 6), deployer.address);
  const mETH = await Mock.deploy("Sentinel Mock ETH", "mETH", 18, ethers.parseUnits("2000", 18), deployer.address);
  const mRWA = await Mock.deploy("Sentinel Mock RWA (USDY-class)", "mRWA", 18, ethers.parseUnits("2000000", 18), deployer.address);
  await Promise.all([mUSD.waitForDeployment(), mETH.waitForDeployment(), mRWA.waitForDeployment()]);
  const mUSDAddr = await mUSD.getAddress();
  const mETHAddr = await mETH.getAddress();
  const mRWAAddr = await mRWA.getAddress();
  console.log("       mUSD", mUSDAddr, "\n       mETH", mETHAddr, "\n       mRWA", mRWAAddr);

  // 3) Pool
  console.log("[3/6] SentinelPool...");
  const pool = await (await ethers.getContractFactory("SentinelPool")).deploy(oracleAddr);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("      ", poolAddr);

  // 4) Registry
  console.log("[4/6] DecisionRegistry...");
  const registry = await (await ethers.getContractFactory("DecisionRegistry")).deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("      ", registryAddr);

  // 5) Vault
  console.log("[5/6] SentinelVault...");
  const vault = await (await ethers.getContractFactory("SentinelVault")).deploy(oracleAddr, poolAddr, registryAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("      ", vaultAddr);

  // 6) Wire everything up
  console.log("[6/6] Configuring (prices, agent identity, mandate, liquidity, deposit)...");

  // Bootstrap prices with REAL market data (Pyth). The agent then pushes live prices each cycle.
  const px = await fetchPythBootstrap();
  console.log(`       bootstrap prices (Pyth): mETH $${px.meth.toFixed(2)}, USDY $${px.usdy.toFixed(4)}`);
  await (await oracle.setPrices([mUSDAddr, mETHAddr, mRWAAddr], [1n * E8, usdToE8(px.meth), usdToE8(px.usdy)])).wait();

  // Register the agent identity (local). agentId == ERC-721 tokenId.
  const agentCardURI = (process.env.AGENT_CARD_URI || "ipfs://sentinel-agent-card").trim();
  await (await registry.register(agentCardURI)).wait();
  const agentId = await registry.totalAgents(); // first = 1n
  console.log("       agentId:", agentId.toString());

  // Authorize the vault + agent hot key to log decisions under this agentId.
  await (await registry.setOperator(agentId, vaultAddr, true)).wait();
  if (agentAddr.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await registry.setOperator(agentId, agentAddr, true)).wait();
  }

  // Vault config.
  await (await vault.setAgentId(agentId)).wait();
  await (await vault.addAssets([mUSDAddr, mETHAddr, mRWAAddr])).wait();
  await (await vault.setOperator(agentAddr, true)).wait();
  // Let the agent hot key push prices to the oracle.
  if (agentAddr.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await oracle.setOperator(agentAddr, true)).wait();
  }

  // Seed pool liquidity so swaps have depth.
  await (await mUSD.approve(poolAddr, ethers.MaxUint256)).wait();
  await (await mETH.approve(poolAddr, ethers.MaxUint256)).wait();
  await (await mRWA.approve(poolAddr, ethers.MaxUint256)).wait();
  await (await pool.addLiquidity(mUSDAddr, ethers.parseUnits("1000000", 6))).wait();
  await (await pool.addLiquidity(mETHAddr, ethers.parseUnits("300", 18))).wait();
  await (await pool.addLiquidity(mRWAAddr, ethers.parseUnits("1000000", 18))).wait();

  // Seed the vault with initial principal (10,000 mUSD).
  await (await mUSD.approve(vaultAddr, ethers.parseUnits("10000", 6))).wait();
  await (await vault.deposit(mUSDAddr, ethers.parseUnits("10000", 6))).wait();

  const nav = await vault.nav();
  console.log("       Vault NAV:", (Number(nav) / 1e8).toLocaleString(), "USD");

  // ---- write outputs ----
  console.log("\nWriting deployment artifacts...");
  const constructorArgs: Record<string, unknown[]> = {
    SentinelOracle: [],
    "MockERC20:mUSD": ["Sentinel Mock USD", "mUSD", 6, ethers.parseUnits("2000000", 6).toString(), deployer.address],
    "MockERC20:mETH": ["Sentinel Mock ETH", "mETH", 18, ethers.parseUnits("2000", 18).toString(), deployer.address],
    "MockERC20:mRWA": ["Sentinel Mock RWA (USDY-class)", "mRWA", 18, ethers.parseUnits("2000000", 18).toString(), deployer.address],
    SentinelPool: [oracleAddr],
    DecisionRegistry: [],
    SentinelVault: [oracleAddr, poolAddr, registryAddr],
  };

  const deployment = {
    network: net,
    chainId: meta.chainId,
    rpc: meta.rpc,
    explorer: meta.explorer,
    deployer: deployer.address,
    agentOperator: agentAddr,
    startBlock,
    agentId: Number(agentId),
    erc8004: ERC8004[net],
    addresses: {
      oracle: oracleAddr,
      mUSD: mUSDAddr,
      mETH: mETHAddr,
      mRWA: mRWAAddr,
      pool: poolAddr,
      registry: registryAddr,
      vault: vaultAddr,
    },
    constructorArgs,
  };

  const root = path.resolve(__dirname, "..");
  writeJson(path.join(root, "deployments", `${net}.json`), deployment);

  // ABIs (for the agent).
  const names = ["SentinelOracle", "MockERC20", "SentinelPool", "DecisionRegistry", "SentinelVault"];
  const abis: Record<string, unknown> = {};
  for (const n of names) abis[n] = (await artifacts.readArtifact(n)).abi;
  writeJson(path.join(root, "deployments", "abis.json"), abis);

  // Self-contained config for the web dashboard (committed; the web reads only this).
  writeJson(path.resolve(root, "..", "web", "lib", "deployment.generated.json"), {
    ...deployment,
    abis: {
      DecisionRegistry: abis.DecisionRegistry,
      SentinelVault: abis.SentinelVault,
      SentinelOracle: abis.SentinelOracle,
      MockERC20: abis.MockERC20,
    },
  });

  console.log("\n============================================================");
  console.log("DONE. Verify next:  npm run verify");
  console.log("Mint official ERC-8004 NFT:  npm run register:agent");
  console.log("Run the agent:  npm run agent   (from repo root)");
  console.log("Explorer:", `${meta.explorer}/address/${vaultAddr}`);
  console.log("============================================================");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
