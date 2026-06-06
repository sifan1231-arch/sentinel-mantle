import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const E8 = 10n ** 8n;
const b32 = (s: string) => ethers.encodeBytes32String(s);

async function deployFixture() {
  const [owner, agent, stranger] = await ethers.getSigners();

  const oracle = await (await ethers.getContractFactory("SentinelOracle")).deploy();
  const Mock = await ethers.getContractFactory("MockERC20");
  const mUSD = await Mock.deploy("Mock USD", "mUSD", 6, ethers.parseUnits("2000000", 6), owner.address);
  const mETH = await Mock.deploy("Mock ETH", "mETH", 18, ethers.parseUnits("2000", 18), owner.address);
  const mRWA = await Mock.deploy("Mock RWA", "mRWA", 18, ethers.parseUnits("2000000", 18), owner.address);
  const pool = await (await ethers.getContractFactory("SentinelPool")).deploy(await oracle.getAddress());
  const registry = await (await ethers.getContractFactory("DecisionRegistry")).deploy();
  const vault = await (
    await ethers.getContractFactory("SentinelVault")
  ).deploy(await oracle.getAddress(), await pool.getAddress(), await registry.getAddress());

  const mUSDAddr = await mUSD.getAddress();
  const mETHAddr = await mETH.getAddress();
  const mRWAAddr = await mRWA.getAddress();
  const vaultAddr = await vault.getAddress();
  const poolAddr = await pool.getAddress();

  // Prices: $1 / $3000 / $1.04
  await oracle.setPrices([mUSDAddr, mETHAddr, mRWAAddr], [1n * E8, 3000n * E8, (104n * E8) / 100n]);

  // Agent identity + authorize vault to log decisions.
  await registry.register("ipfs://card");
  const agentId = await registry.totalAgents(); // 1
  await registry.setOperator(agentId, vaultAddr, true);

  // Vault config.
  await vault.setAgentId(agentId);
  await vault.addAssets([mUSDAddr, mETHAddr, mRWAAddr]);
  await vault.setOperator(agent.address, true);
  await oracle.setOperator(agent.address, true);

  // Seed pool liquidity.
  await mUSD.approve(poolAddr, ethers.MaxUint256);
  await mETH.approve(poolAddr, ethers.MaxUint256);
  await mRWA.approve(poolAddr, ethers.MaxUint256);
  await pool.addLiquidity(mUSDAddr, ethers.parseUnits("500000", 6));
  await pool.addLiquidity(mETHAddr, ethers.parseUnits("500", 18));
  await pool.addLiquidity(mRWAAddr, ethers.parseUnits("500000", 18));

  // Deposit principal: 10,000 mUSD.
  await mUSD.approve(vaultAddr, ethers.parseUnits("10000", 6));
  await vault.deposit(mUSDAddr, ethers.parseUnits("10000", 6));

  return { owner, agent, stranger, oracle, mUSD, mETH, mRWA, pool, registry, vault, agentId, mUSDAddr, mETHAddr, mRWAAddr };
}

function enter(from: string, to: string, amountIn: bigint, reason = "test") {
  return {
    actionType: b32("ENTER"),
    fromAsset: from,
    toAsset: to,
    amountIn,
    predictedDirectionBps: 200,
    confidenceBps: 7000,
    signalsHash: ethers.id(reason),
    reason,
    rationaleURI: "",
  };
}

describe("Sentinel", () => {
  describe("Accounting (mixed decimals)", () => {
    it("computes NAV from the oracle across 6- and 18-decimal assets", async () => {
      const { vault } = await loadFixture(deployFixture);
      // 10,000 mUSD @ $1 → NAV = $10,000 (1e8 scale).
      expect(await vault.nav()).to.equal(10000n * E8);
      expect(await vault.totalPnlUsd()).to.equal(0n);
    });

    it("prices a 6→18 decimal swap correctly (with fee)", async () => {
      const { pool, mUSDAddr, mETHAddr } = await loadFixture(deployFixture);
      // 3000 mUSD @ $1 → ~1 mETH @ $3000, minus 0.10% fee.
      const out = await pool.quote(mUSDAddr, mETHAddr, ethers.parseUnits("3000", 6));
      expect(out).to.equal((ethers.parseUnits("1", 18) * 9990n) / 10000n);
    });
  });

  describe("Autonomous execution + on-chain decision log", () => {
    it("executes a rebalance, logs the decision, and keeps NAV ~flat (minus fee)", async () => {
      const { vault, agent, registry, agentId, mUSDAddr, mETHAddr } = await loadFixture(deployFixture);
      await expect(vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("2500", 6))))
        .to.emit(vault, "Executed")
        .and.to.emit(registry, "AgentDecision");
      expect(await registry.decisionCount(agentId)).to.equal(1n);
      // NAV after = principal minus the 0.10% spread on $2,500 ≈ $9,997.5
      const nav = await vault.nav();
      expect(nav).to.be.lt(10000n * E8);
      expect(nav).to.be.gt(9995n * E8);
    });

    it("turns a real price move into verifiable on-chain PnL", async () => {
      const { vault, agent, oracle, mETHAddr, mUSDAddr } = await loadFixture(deployFixture);
      await vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("3000", 6)));
      const navBefore = await vault.nav();
      // mETH +20% (within the oracle deviation guard).
      await oracle.setPrice(mETHAddr, 3600n * E8);
      const navAfter = await vault.nav();
      expect(navAfter).to.be.gt(navBefore);
      expect(await vault.totalPnlUsd()).to.be.gt(0n);
    });

    it("records cumulative realized PnL in the registry", async () => {
      const { vault, agent, registry, agentId, mUSDAddr, mETHAddr } = await loadFixture(deployFixture);
      await vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("1000", 6)));
      const a = await registry.getAgent(agentId);
      // realized PnL of an oracle swap = -fee, so cumulative is slightly negative.
      expect(a.cumRealizedPnl).to.be.lt(0n);
    });
  });

  describe("On-chain risk mandate (the agent cannot exceed it)", () => {
    it("reverts a trade that exceeds the per-trade size cap", async () => {
      const { vault, agent, mUSDAddr, mETHAddr } = await loadFixture(deployFixture);
      // Default cap 30% of $10,000 = $3,000. Try $3,001.
      await expect(
        vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("3001", 6)))
      ).to.be.revertedWithCustomError(vault, "TradeCapExceeded");
    });

    it("reverts a trade that would exceed the per-asset weight cap", async () => {
      const { vault, owner, agent, mUSDAddr, mETHAddr } = await loadFixture(deployFixture);
      await vault.connect(owner).setMandate({
        maxSingleTradeBps: 10000,
        maxAssetWeightBps: 5000, // 50%
        maxDrawdownBps: 2000,
        slippageBps: 100,
        cooldown: 0,
      });
      // Trying to put 60% into mETH should breach the 50% asset cap.
      await expect(
        vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("6000", 6)))
      ).to.be.revertedWithCustomError(vault, "AssetCapExceeded");
    });

    it("auto-halts on a drawdown breach", async () => {
      const { vault, owner, agent, oracle, mUSDAddr, mETHAddr, mRWAAddr } = await loadFixture(deployFixture);
      await vault.connect(owner).setMandate({
        maxSingleTradeBps: 3000,
        maxAssetWeightBps: 8000,
        maxDrawdownBps: 300, // 3%
        slippageBps: 100,
        cooldown: 0,
      });
      await vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("3000", 6)));
      // mETH -25% (allowed by deviation guard) → NAV down ~7.5% > 3% drawdown.
      await oracle.setPrice(mETHAddr, 2250n * E8);
      // Underwater trades are blocked (non-latching revert guard).
      await expect(
        vault.connect(agent).execute(enter(mUSDAddr, mRWAAddr, ethers.parseUnits("100", 6)))
      ).to.be.revertedWithCustomError(vault, "DrawdownBreached");
      // The latching circuit breaker (a separate tx) persists the halt.
      await vault.tripBreakerIfBreached();
      expect(await vault.halted()).to.equal(true);
      await expect(
        vault.connect(agent).execute(enter(mUSDAddr, mRWAAddr, ethers.parseUnits("100", 6)))
      ).to.be.revertedWith("vault halted");
    });

    it("rejects execution from a non-operator", async () => {
      const { vault, stranger, mUSDAddr, mETHAddr } = await loadFixture(deployFixture);
      await expect(
        vault.connect(stranger).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("100", 6)))
      ).to.be.revertedWithCustomError(vault, "NotOperator");
    });

    it("enforces the inter-trade cooldown", async () => {
      const { vault, owner, agent, oracle, mUSDAddr, mETHAddr, mRWAAddr } = await loadFixture(deployFixture);
      await vault.connect(owner).setMandate({
        maxSingleTradeBps: 3000,
        maxAssetWeightBps: 8000,
        maxDrawdownBps: 2000,
        slippageBps: 100,
        cooldown: 3600,
      });
      await vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("1000", 6)));
      await expect(
        vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("1000", 6)))
      ).to.be.revertedWithCustomError(vault, "Cooldown");
      await time.increase(3601);
      // Advancing past the cooldown also stales the oracle (1h maxStale); refresh prices,
      // exactly as the live agent does at the start of every cycle.
      await oracle.setPrices([mUSDAddr, mETHAddr, mRWAAddr], [1n * E8, 3000n * E8, (104n * E8) / 100n]);
      await expect(vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("1000", 6)))).to.not.be
        .reverted;
    });
  });

  describe("DecisionRegistry (ERC-8004-aligned identity)", () => {
    it("mints the agent as an ERC-721 and only the controller can log", async () => {
      const { registry, owner, stranger, agentId } = await loadFixture(deployFixture);
      expect(await registry.ownerOf(agentId)).to.equal(owner.address);
      const dec = {
        actionType: b32("HOLD"),
        fromAsset: ethers.ZeroAddress,
        toAsset: ethers.ZeroAddress,
        amount: 0,
        predictedDirectionBps: 0,
        confidenceBps: 0,
        signalsHash: ethers.ZeroHash,
        realizedPnl: 0,
        reason: "manual",
        rationaleURI: "",
      };
      await expect(registry.connect(stranger).logDecision(agentId, dec)).to.be.revertedWithCustomError(
        registry,
        "NotAgentController"
      );
      // Owner can log directly.
      await expect(registry.connect(owner).logDecision(agentId, dec)).to.emit(registry, "AgentDecision");
    });

    it("links a canonical ERC-8004 agentId", async () => {
      const { registry, agentId } = await loadFixture(deployFixture);
      await registry.linkCanonical(agentId, "0x8004A818BFB912233c491871b3d84c89A494BD9e", 42);
      const a = await registry.getAgent(agentId);
      expect(a.canonicalAgentId).to.equal(42n);
    });
  });

  describe("SentinelOracle guards", () => {
    it("rejects a price jump beyond the deviation guard", async () => {
      const { oracle, mETHAddr } = await loadFixture(deployFixture);
      // +26.6% from $3000 exceeds the 25% guard.
      await expect(oracle.setPrice(mETHAddr, 3800n * E8)).to.be.revertedWithCustomError(oracle, "DeviationTooHigh");
      // +20% is fine.
      await expect(oracle.setPrice(mETHAddr, 3600n * E8)).to.not.be.reverted;
    });

    it("reports stale prices", async () => {
      const { oracle, mETHAddr } = await loadFixture(deployFixture);
      await time.increase(3601);
      expect(await oracle.isStale(mETHAddr)).to.equal(true);
      await expect(oracle.getFreshPrice(mETHAddr)).to.be.revertedWith("SentinelOracle: stale price");
    });

    it("blocks unauthorized price pushes", async () => {
      const { oracle, stranger, mETHAddr } = await loadFixture(deployFixture);
      await expect(oracle.connect(stranger).setPrice(mETHAddr, 3100n * E8)).to.be.revertedWithCustomError(
        oracle,
        "NotAuthorized"
      );
    });
  });

  describe("Deposits / withdrawals (owner only)", () => {
    it("only the owner can withdraw and it reduces cost basis", async () => {
      const { vault, owner, stranger, mUSD, mUSDAddr } = await loadFixture(deployFixture);
      await expect(
        vault.connect(stranger).withdraw(mUSDAddr, ethers.parseUnits("100", 6), stranger.address)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
      const before = await vault.costBasisUsd();
      await vault.connect(owner).withdraw(mUSDAddr, ethers.parseUnits("1000", 6), owner.address);
      expect(await vault.costBasisUsd()).to.be.lt(before);
    });
  });

  describe("AgentArena (on-chain leaderboard)", () => {
    it("enters an agent and ranks it purely from on-chain performance", async () => {
      const { registry, vault, agent, mUSDAddr, mETHAddr } = await loadFixture(deployFixture);
      const arena = await (await ethers.getContractFactory("AgentArena")).deploy(await registry.getAddress());
      await arena.join(await vault.getAddress(), "Sentinel", "balanced");

      expect(await arena.count()).to.equal(1n);
      let board = await arena.leaderboard();
      expect(board[0].name).to.equal("Sentinel");
      expect(board[0].navUsd).to.equal(10000n * E8);
      expect(board[0].turingScore).to.equal(10000n); // base: no pnl, no activity, no drawdown

      // an autonomous decision raises the Turing Score (activity reward).
      await vault.connect(agent).execute(enter(mUSDAddr, mETHAddr, ethers.parseUnits("2500", 6)));
      board = await arena.leaderboard();
      expect(board[0].decisions).to.equal(1n);
      expect(board[0].turingScore).to.be.gt(10000n);
    });

    it("rejects a double-join and a non-vault address", async () => {
      const { registry, vault, stranger } = await loadFixture(deployFixture);
      const arena = await (await ethers.getContractFactory("AgentArena")).deploy(await registry.getAddress());
      await arena.join(await vault.getAddress(), "Sentinel", "balanced");
      await expect(arena.join(await vault.getAddress(), "Dup", "x")).to.be.revertedWithCustomError(arena, "AlreadyJoined");
      await expect(arena.join(stranger.address, "NotAVault", "x")).to.be.revertedWithCustomError(arena, "NotAVault");
    });
  });
});
