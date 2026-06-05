// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @notice Clearly-labelled TESTNET instrument that REPRESENTS a real Mantle asset
 *         (e.g. mUSD≈USD stable, mETH≈Mantle Staked ETH, mRWA≈Ondo USDY-class yield RWA).
 *         Prices are driven by the SentinelOracle using REAL market data, so the agent
 *         makes decisions on real prices while executing on self-contained testnet rails.
 *         An open faucet lets anyone mint demo balances. Not for production.
 */
contract MockERC20 is ERC20, Ownable {
    uint8 private immutable _decimals;
    uint256 public faucetCap;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply,
        address initialHolder
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _decimals = decimals_;
        faucetCap = 1_000_000 * (10 ** decimals_); // generous per-call faucet cap
        if (initialSupply > 0) {
            _mint(initialHolder == address(0) ? msg.sender : initialHolder, initialSupply);
        }
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Owner mint (used by deploy/seed scripts).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Open testnet faucet so demo users/judges can grab balances.
    function faucet(uint256 amount) external {
        require(amount <= faucetCap, "MockERC20: over faucet cap");
        _mint(msg.sender, amount);
    }

    function setFaucetCap(uint256 cap) external onlyOwner {
        faucetCap = cap;
    }
}
