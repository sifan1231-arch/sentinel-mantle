// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SentinelOracle} from "../SentinelOracle.sol";

/**
 * @title SentinelPool
 * @notice A minimal, deterministic, ORACLE-PRICED swap venue used as self-contained
 *         testnet execution rails. Swaps are priced off SentinelOracle (real market
 *         prices pushed by the agent) plus a small spread/fee, so the agent's trades
 *         produce REAL on-chain state changes and REALISTIC costs — without depending
 *         on an external DEX or real funds. In a mainnet deployment, the SentinelVault
 *         can route to a real Mantle DEX router instead.
 *
 *         This is NOT a constant-product AMM; price comes from the oracle, eliminating
 *         slippage games and sandwich/manipulation vectors that would muddy the demo.
 */
contract SentinelPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    SentinelOracle public immutable oracle;

    /// @notice Swap fee in basis points (default 0.10%).
    uint256 public feeBps = 10;
    uint256 public constant MAX_FEE_BPS = 200;

    event LiquidityAdded(address indexed asset, uint256 amount);
    event LiquidityRemoved(address indexed asset, uint256 amount, address to);
    event Swapped(
        address indexed sender,
        address indexed fromAsset,
        address indexed toAsset,
        uint256 amountIn,
        uint256 amountOut,
        address to
    );
    event FeeUpdated(uint256 feeBps);

    error InsufficientLiquidity(address asset, uint256 want, uint256 have);
    error IdenticalAssets();
    error ZeroAmount();

    constructor(SentinelOracle _oracle) Ownable(msg.sender) {
        oracle = _oracle;
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "fee too high");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function addLiquidity(address asset, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityAdded(asset, amount);
    }

    function removeLiquidity(address asset, uint256 amount, address to) external onlyOwner {
        IERC20(asset).safeTransfer(to, amount);
        emit LiquidityRemoved(asset, amount, to);
    }

    function reserve(address asset) public view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    /// @notice Quote how much `toAsset` you receive for `amountIn` of `fromAsset` (after fee).
    function quote(address fromAsset, address toAsset, uint256 amountIn) public view returns (uint256 amountOut) {
        if (fromAsset == toAsset) revert IdenticalAssets();
        if (amountIn == 0) revert ZeroAmount();

        uint256 priceFrom = oracle.getFreshPrice(fromAsset); // USD, 1e8
        uint256 priceTo = oracle.getFreshPrice(toAsset); // USD, 1e8
        uint256 unitFrom = 10 ** IERC20Metadata(fromAsset).decimals();
        uint256 unitTo = 10 ** IERC20Metadata(toAsset).decimals();

        // USD value (1e8) of the input.
        uint256 valueUsd = (amountIn * priceFrom) / unitFrom;
        // Output token amount before fee.
        uint256 outBeforeFee = (valueUsd * unitTo) / priceTo;
        amountOut = (outBeforeFee * (10_000 - feeBps)) / 10_000;
    }

    /// @notice Swap `amountIn` of `fromAsset` for `toAsset`, priced by the oracle.
    function swap(address fromAsset, address toAsset, uint256 amountIn, address to)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        amountOut = quote(fromAsset, toAsset, amountIn);
        uint256 have = reserve(toAsset);
        if (have < amountOut) revert InsufficientLiquidity(toAsset, amountOut, have);

        IERC20(fromAsset).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(toAsset).safeTransfer(to, amountOut);

        emit Swapped(msg.sender, fromAsset, toAsset, amountIn, amountOut, to);
    }
}
