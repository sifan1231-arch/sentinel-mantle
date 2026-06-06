// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IArenaVault {
    function nav() external view returns (uint256);
    function totalPnlUsd() external view returns (int256);
    function costBasisUsd() external view returns (uint256);
    function highWaterMarkUsd() external view returns (uint256);
    function halted() external view returns (bool);
    function agentId() external view returns (uint256);
    function owner() external view returns (address);
}

interface IArenaRegistry {
    function decisionCount(uint256 agentId) external view returns (uint64);
    function getAgent(uint256 agentId)
        external
        view
        returns (address owner, uint256 canonicalAgentId, address canonicalRegistry, uint64 count, int256 cumRealizedPnl, uint256 createdAt);
}

/**
 * @title AgentArena
 * @notice The on-chain colosseum for the Turing Test: a PERMISSIONLESS leaderboard where any
 *         Sentinel-style agent (a vault + an ERC-8004 agentId) competes, ranked live by a
 *         "Turing Score" computed purely from VERIFIABLE on-chain performance — NAV growth,
 *         realized track record, activity, and drawdown discipline. Anyone can spawn an agent
 *         and join. This is the hackathon's literal thesis: benchmarking AI agents at scale,
 *         on-chain, with every decision auditable.
 *
 *         Scores are read-only views over each vault + the shared DecisionRegistry — the arena
 *         never custodies funds and never trusts off-chain numbers.
 */
contract AgentArena {
    IArenaRegistry public immutable registry;

    struct Entry {
        address vault;
        uint256 agentId;
        address owner;
        string name;
        string persona;
        uint256 joinedAt;
    }

    struct Standing {
        uint256 idx;
        address vault;
        uint256 agentId;
        string name;
        string persona;
        address owner;
        uint256 navUsd; // 1e8
        int256 pnlUsd; // 1e8 (signed)
        int256 pnlBps; // return vs cost basis, basis points (signed)
        uint64 decisions;
        bool halted;
        int256 turingScore; // composite leaderboard score (higher = better)
    }

    Entry[] public entries;
    mapping(address => uint256) public indexOfVault; // vault => index+1 (0 = not joined)

    event AgentJoined(uint256 indexed idx, address indexed vault, uint256 indexed agentId, address owner, string name, string persona);

    error AlreadyJoined(address vault);
    error NotAVault(address vault);

    constructor(IArenaRegistry _registry) {
        registry = _registry;
    }

    /// @notice Permissionlessly enter an agent (a deployed vault + its agentId) into the arena.
    function join(address vault, string calldata name, string calldata persona) external returns (uint256 idx) {
        if (indexOfVault[vault] != 0) revert AlreadyJoined(vault);
        if (vault.code.length == 0) revert NotAVault(vault);
        uint256 agentId;
        address vowner;
        try IArenaVault(vault).agentId() returns (uint256 a) {
            agentId = a;
        } catch {
            revert NotAVault(vault);
        }
        try IArenaVault(vault).owner() returns (address o) {
            vowner = o;
        } catch {
            vowner = msg.sender;
        }
        idx = entries.length;
        entries.push(Entry({ vault: vault, agentId: agentId, owner: vowner, name: name, persona: persona, joinedAt: block.timestamp }));
        indexOfVault[vault] = idx + 1;
        emit AgentJoined(idx, vault, agentId, vowner, name, persona);
    }

    function count() external view returns (uint256) {
        return entries.length;
    }

    /// @notice The composite, fully on-chain "Turing Score".
    /// base 10000 + return(bps) + activity bonus (capped) − drawdown penalty − halt penalty.
    function turingScore(int256 pnlBps, uint64 decisions, uint256 nav, uint256 hwm, bool halted) public pure returns (int256) {
        int256 score = int256(10000) + pnlBps;
        uint256 activity = decisions > 60 ? 60 : decisions;
        score += int256(activity * 15); // reward sustained, autonomous activity (max +900)
        if (hwm > 0 && nav < hwm) {
            // drawdown from peak, in bps, lightly penalised
            uint256 ddBps = ((hwm - nav) * 10000) / hwm;
            score -= int256(ddBps / 2);
        }
        if (halted) score -= 1500;
        return score;
    }

    function standingAt(uint256 idx) public view returns (Standing memory s) {
        Entry memory e = entries[idx];
        IArenaVault v = IArenaVault(e.vault);
        uint256 nav = v.nav();
        int256 pnl = v.totalPnlUsd();
        uint256 cost = v.costBasisUsd();
        uint256 hwm = v.highWaterMarkUsd();
        bool halted = v.halted();
        uint64 decisions = registry.decisionCount(e.agentId);
        int256 pnlBps = cost > 0 ? (pnl * int256(10000)) / int256(cost) : int256(0);
        s = Standing({
            idx: idx,
            vault: e.vault,
            agentId: e.agentId,
            name: e.name,
            persona: e.persona,
            owner: e.owner,
            navUsd: nav,
            pnlUsd: pnl,
            pnlBps: pnlBps,
            decisions: decisions,
            halted: halted,
            turingScore: turingScore(pnlBps, decisions, nav, hwm, halted)
        });
    }

    /// @notice Full leaderboard snapshot (unsorted; the frontend sorts by turingScore desc).
    function leaderboard() external view returns (Standing[] memory list) {
        uint256 n = entries.length;
        list = new Standing[](n);
        for (uint256 i = 0; i < n; i++) {
            list[i] = standingAt(i);
        }
    }
}
