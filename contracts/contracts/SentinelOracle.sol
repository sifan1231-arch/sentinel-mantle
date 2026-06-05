// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SentinelOracle
 * @notice A push price oracle the agent's Operator updates with REAL market prices
 *         (USD, 8 decimals — Chainlink convention). Used for on-chain NAV/PnL and
 *         for pricing swaps in the SentinelPool. Operator-gated with staleness +
 *         deviation guards so a single bad push cannot wildly mis-price the vault.
 *
 *         In a mainnet deployment this can be replaced by a real Pyth/Chainlink feed;
 *         on testnet it lets the agent feed live prices into self-contained rails.
 */
contract SentinelOracle is Ownable {
    uint8 public constant DECIMALS = 8;

    struct PriceData {
        uint256 price; // USD price, 8 decimals
        uint256 updatedAt; // block timestamp of last update
        bool initialized;
    }

    mapping(address => PriceData) private _prices;
    mapping(address => bool) public operators;

    /// @notice Max allowed relative move per single push, in basis points (default 25% = 2500 bps).
    uint256 public maxDeviationBps = 2500;
    /// @notice Prices older than this are considered stale (default 1 hour).
    uint256 public maxStale = 1 hours;

    event PriceUpdated(address indexed asset, uint256 price, uint256 updatedAt);
    event OperatorSet(address indexed operator, bool allowed);
    event GuardsUpdated(uint256 maxDeviationBps, uint256 maxStale);

    error NotAuthorized();
    error ZeroPrice();
    error DeviationTooHigh(uint256 oldPrice, uint256 newPrice);
    error LengthMismatch();

    constructor() Ownable(msg.sender) {
        operators[msg.sender] = true;
        emit OperatorSet(msg.sender, true);
    }

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setGuards(uint256 _maxDeviationBps, uint256 _maxStale) external onlyOwner {
        maxDeviationBps = _maxDeviationBps;
        maxStale = _maxStale;
        emit GuardsUpdated(_maxDeviationBps, _maxStale);
    }

    function setPrice(address asset, uint256 price) public onlyOperator {
        if (price == 0) revert ZeroPrice();
        PriceData storage p = _prices[asset];
        if (p.initialized && maxDeviationBps < 10_000) {
            uint256 oldP = p.price;
            uint256 diff = price > oldP ? price - oldP : oldP - price;
            if (diff * 10_000 > oldP * maxDeviationBps) {
                revert DeviationTooHigh(oldP, price);
            }
        }
        p.price = price;
        p.updatedAt = block.timestamp;
        p.initialized = true;
        emit PriceUpdated(asset, price, block.timestamp);
    }

    function setPrices(address[] calldata assets, uint256[] calldata prices) external onlyOperator {
        if (assets.length != prices.length) revert LengthMismatch();
        for (uint256 i = 0; i < assets.length; i++) {
            setPrice(assets[i], prices[i]);
        }
    }

    /// @notice Returns the latest price (8 decimals) and its timestamp. Reverts if never set.
    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt) {
        PriceData memory p = _prices[asset];
        require(p.initialized, "SentinelOracle: price not set");
        return (p.price, p.updatedAt);
    }

    /// @notice Like getPrice but reverts if the price is stale.
    function getFreshPrice(address asset) external view returns (uint256 price) {
        PriceData memory p = _prices[asset];
        require(p.initialized, "SentinelOracle: price not set");
        require(block.timestamp - p.updatedAt <= maxStale, "SentinelOracle: stale price");
        return p.price;
    }

    function isStale(address asset) external view returns (bool) {
        PriceData memory p = _prices[asset];
        if (!p.initialized) return true;
        return block.timestamp - p.updatedAt > maxStale;
    }
}
