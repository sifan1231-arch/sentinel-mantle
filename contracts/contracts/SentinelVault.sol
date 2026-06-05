// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SentinelOracle} from "./SentinelOracle.sol";
import {SentinelPool} from "./mock/SentinelPool.sol";
import {DecisionRegistry} from "./DecisionRegistry.sol";

/**
 * @title SentinelVault
 * @notice Custodies the owner's assets and lets an AUTHORIZED AGENT OPERATOR rebalance
 *         them autonomously — but ONLY within on-chain risk MANDATE guards that even the
 *         agent cannot exceed:
 *           - per-trade size cap (% of NAV)
 *           - max post-trade weight per asset
 *           - max drawdown circuit-breaker (auto-halt)
 *           - slippage tolerance vs the oracle quote
 *           - inter-trade cooldown
 *         NAV and PnL are computed ON-CHAIN from the oracle, so performance is verifiable.
 *         Every execution atomically writes a decision to the DecisionRegistry.
 *
 *         "Sign once": the owner deposits + authorizes the agent operator once; thereafter
 *         the agent runs itself within the mandate. Withdrawals remain owner-only.
 */
contract SentinelVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    SentinelOracle public immutable oracle;
    DecisionRegistry public immutable registry;
    SentinelPool public pool;
    uint256 public agentId; // local agent id in the DecisionRegistry this vault logs under

    /// @notice Hard cap on the managed-asset set so nav()/weight loops stay bounded (anti-DoS).
    uint256 public constant MAX_ASSETS = 24;

    address[] public assets;
    mapping(address => bool) public isAsset;
    mapping(address => bool) public operators;

    struct Mandate {
        uint256 maxSingleTradeBps; // max value of a single trade as % of NAV (bps)
        uint256 maxAssetWeightBps; // max post-trade weight any one asset may reach (bps)
        uint256 maxDrawdownBps; // auto-halt if NAV falls this far below the high-water mark (bps)
        uint256 slippageBps; // max acceptable slippage vs the pool quote (bps)
        uint256 cooldown; // minimum seconds between trades
    }

    Mandate public mandate;

    uint256 public costBasisUsd; // cumulative deposit basis, USD 1e8
    uint256 public highWaterMarkUsd; // peak NAV, USD 1e8
    uint256 public lastTradeAt;
    bool public halted;

    struct ExecParams {
        bytes32 actionType;
        address fromAsset;
        address toAsset;
        uint256 amountIn;
        int256 predictedDirectionBps;
        uint256 confidenceBps;
        bytes32 signalsHash;
        string reason;
        string rationaleURI;
    }

    event Deposited(address indexed asset, uint256 amount, uint256 newCostBasisUsd, uint256 nav);
    event Withdrawn(address indexed asset, uint256 amount, address to, uint256 nav);
    event MandateUpdated(Mandate mandate);
    event OperatorSet(address indexed operator, bool allowed);
    event AssetAdded(address indexed asset);
    event PoolSet(address indexed pool);
    event AgentIdSet(uint256 agentId);
    event HaltSet(bool halted, string reason);
    event Executed(
        bytes32 indexed actionType,
        address indexed fromAsset,
        address indexed toAsset,
        uint256 amountIn,
        uint256 amountOut,
        uint256 navBefore,
        uint256 navAfter,
        int256 realizedPnl
    );

    error NotOperator(address caller);
    error AssetNotAllowed(address asset);
    error TradeCapExceeded(uint256 tradeValueUsd, uint256 limitUsd);
    error AssetCapExceeded(uint256 weightBps, uint256 limitBps);
    error DrawdownBreached(uint256 nav, uint256 floor);
    error SlippageExceeded(uint256 out, uint256 minOut);
    error Cooldown(uint256 nextAllowed);

    constructor(SentinelOracle _oracle, SentinelPool _pool, DecisionRegistry _registry) Ownable(msg.sender) {
        oracle = _oracle;
        pool = _pool;
        registry = _registry;
        // Conservative defaults; owner can tune via setMandate.
        mandate = Mandate({
            maxSingleTradeBps: 3000, // 30% of NAV per trade
            maxAssetWeightBps: 8000, // 80% max weight per asset
            maxDrawdownBps: 2000, // halt at 20% drawdown
            slippageBps: 100, // 1% slippage tolerance
            cooldown: 0 // no cooldown by default
        });
    }

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator(msg.sender);
        _;
    }

    // ---------------------------------------------------------------------
    // Configuration (owner)
    // ---------------------------------------------------------------------

    function setAgentId(uint256 _agentId) external onlyOwner {
        agentId = _agentId;
        emit AgentIdSet(_agentId);
    }

    function setPool(SentinelPool _pool) external onlyOwner {
        pool = _pool;
        emit PoolSet(address(_pool));
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function addAsset(address asset) public onlyOwner {
        if (!isAsset[asset]) {
            require(assets.length < MAX_ASSETS, "too many assets");
            isAsset[asset] = true;
            assets.push(asset);
            emit AssetAdded(asset);
        }
    }

    function addAssets(address[] calldata list) external onlyOwner {
        for (uint256 i = 0; i < list.length; i++) {
            addAsset(list[i]);
        }
    }

    function setMandate(Mandate calldata m) external onlyOwner {
        require(m.maxSingleTradeBps <= 10_000 && m.maxAssetWeightBps <= 10_000, "bps>100%");
        require(m.maxDrawdownBps <= 10_000 && m.slippageBps <= 10_000, "bps>100%");
        mandate = m;
        emit MandateUpdated(m);
    }

    function setHalted(bool _halted, string calldata reason) external onlyOwner {
        halted = _halted;
        emit HaltSet(_halted, reason);
    }

    function assetsLength() external view returns (uint256) {
        return assets.length;
    }

    // ---------------------------------------------------------------------
    // Accounting (on-chain, verifiable)
    // ---------------------------------------------------------------------

    function assetValueUsd(address asset) public view returns (uint256) {
        uint256 bal = IERC20(asset).balanceOf(address(this));
        if (bal == 0) return 0;
        (uint256 price, ) = oracle.getPrice(asset);
        uint256 unit = 10 ** IERC20Metadata(asset).decimals();
        return (bal * price) / unit;
    }

    /// @notice Net asset value of the whole vault, USD with 8 decimals.
    function nav() public view returns (uint256 usd1e8) {
        uint256 len = assets.length;
        for (uint256 i = 0; i < len; i++) {
            usd1e8 += assetValueUsd(assets[i]);
        }
    }

    /// @notice Total PnL vs deposited basis, USD 1e8 (can be negative).
    function totalPnlUsd() external view returns (int256) {
        return int256(nav()) - int256(costBasisUsd);
    }

    function _valueUsd(address asset, uint256 amount) internal view returns (uint256) {
        (uint256 price, ) = oracle.getPrice(asset);
        uint256 unit = 10 ** IERC20Metadata(asset).decimals();
        return (amount * price) / unit;
    }

    // ---------------------------------------------------------------------
    // Deposits / withdrawals (owner only)
    // ---------------------------------------------------------------------

    function deposit(address asset, uint256 amount) external onlyOwner {
        if (!isAsset[asset]) revert AssetNotAllowed(asset);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        costBasisUsd += _valueUsd(asset, amount);
        uint256 n = nav();
        if (n > highWaterMarkUsd) highWaterMarkUsd = n;
        emit Deposited(asset, amount, costBasisUsd, n);
    }

    function withdraw(address asset, uint256 amount, address to) external onlyOwner {
        uint256 valueOut = _valueUsd(asset, amount);
        costBasisUsd = valueOut >= costBasisUsd ? 0 : costBasisUsd - valueOut;
        IERC20(asset).safeTransfer(to, amount);
        emit Withdrawn(asset, amount, to, nav());
    }

    // ---------------------------------------------------------------------
    // Autonomous execution (agent operator), bounded by the on-chain mandate
    // ---------------------------------------------------------------------

    function execute(ExecParams calldata p) external onlyOperator nonReentrant returns (uint256 amountOut) {
        require(!halted, "vault halted");
        require(agentId != 0, "agentId not set"); // fully configured before any execution
        if (!isAsset[p.fromAsset]) revert AssetNotAllowed(p.fromAsset);
        if (!isAsset[p.toAsset]) revert AssetNotAllowed(p.toAsset);
        require(p.fromAsset != p.toAsset, "identical assets");
        require(p.amountIn > 0, "zero amount");
        if (block.timestamp < lastTradeAt + mandate.cooldown) revert Cooldown(lastTradeAt + mandate.cooldown);

        uint256 navBefore = nav();
        require(navBefore > 0, "empty vault");
        require(IERC20(p.fromAsset).balanceOf(address(this)) >= p.amountIn, "insufficient balance");

        _checkDrawdown(navBefore);

        // Per-trade size cap.
        uint256 tradeValueUsd = _valueUsd(p.fromAsset, p.amountIn);
        uint256 limitUsd = (navBefore * mandate.maxSingleTradeBps) / 10_000;
        if (tradeValueUsd > limitUsd) revert TradeCapExceeded(tradeValueUsd, limitUsd);

        // Slippage-guarded oracle swap.
        amountOut = _swap(p.fromAsset, p.toAsset, p.amountIn);

        // Post-trade per-asset weight cap.
        uint256 navAfter = nav();
        uint256 boughtWeightBps = (assetValueUsd(p.toAsset) * 10_000) / navAfter;
        if (boughtWeightBps > mandate.maxAssetWeightBps) revert AssetCapExceeded(boughtWeightBps, mandate.maxAssetWeightBps);

        if (navAfter > highWaterMarkUsd) highWaterMarkUsd = navAfter;
        lastTradeAt = block.timestamp;

        int256 realizedPnl = int256(_valueUsd(p.toAsset, amountOut)) - int256(tradeValueUsd);

        _logDecision(p, amountOut, realizedPnl);

        emit Executed(p.actionType, p.fromAsset, p.toAsset, p.amountIn, amountOut, navBefore, navAfter, realizedPnl);
    }

    /// @dev View guard: blocks (reverts) any trade attempted while NAV is below the
    ///      drawdown floor. Does NOT mutate state (a revert would roll it back anyway).
    function _checkDrawdown(uint256 navBefore) internal view {
        if (highWaterMarkUsd == 0) return;
        uint256 floor = (highWaterMarkUsd * (10_000 - mandate.maxDrawdownBps)) / 10_000;
        if (navBefore < floor) revert DrawdownBreached(navBefore, floor);
    }

    /// @notice Latching circuit breaker. Permissionless: anyone (typically the agent
    ///         keeper each cycle) can trip it once NAV falls below the drawdown floor.
    ///         Runs in its OWN tx so the `halted` flag persists (unlike a reverting
    ///         guard). Once halted, execution stops until the owner reviews + unhalts.
    function tripBreakerIfBreached() public returns (bool tripped) {
        if (halted) return true;
        if (highWaterMarkUsd == 0) return false;
        uint256 n = nav();
        uint256 floor = (highWaterMarkUsd * (10_000 - mandate.maxDrawdownBps)) / 10_000;
        if (n < floor) {
            halted = true;
            emit HaltSet(true, "drawdown breached");
            return true;
        }
        return false;
    }

    function _swap(address fromAsset, address toAsset, uint256 amountIn) internal returns (uint256 amountOut) {
        uint256 expected = pool.quote(fromAsset, toAsset, amountIn);
        uint256 minOut = (expected * (10_000 - mandate.slippageBps)) / 10_000;
        IERC20(fromAsset).forceApprove(address(pool), amountIn);
        amountOut = pool.swap(fromAsset, toAsset, amountIn, address(this));
        if (amountOut < minOut) revert SlippageExceeded(amountOut, minOut);
    }

    function _logDecision(ExecParams calldata p, uint256 amountOut, int256 realizedPnl) internal {
        registry.logDecision(
            agentId,
            DecisionRegistry.Decision({
                actionType: p.actionType,
                fromAsset: p.fromAsset,
                toAsset: p.toAsset,
                amount: p.amountIn,
                predictedDirectionBps: p.predictedDirectionBps,
                confidenceBps: p.confidenceBps,
                signalsHash: p.signalsHash,
                realizedPnl: realizedPnl,
                reason: p.reason,
                rationaleURI: p.rationaleURI
            })
        );
        // silence unused warning for amountOut (kept for ABI symmetry / future use)
        amountOut;
    }

    // ---------------------------------------------------------------------
    // Safety
    // ---------------------------------------------------------------------

    /// @notice Owner can recover any token (e.g. after halt).
    function emergencyWithdraw(address asset, address to) external onlyOwner {
        uint256 bal = IERC20(asset).balanceOf(address(this));
        IERC20(asset).safeTransfer(to, bal);
    }
}
