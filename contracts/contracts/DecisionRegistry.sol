// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title DecisionRegistry
 * @notice ERC-8004-ALIGNED on-chain agent identity + immutable decision log.
 *
 *  - Identity: each agent is an ERC-721 (agentId == tokenId), with an off-chain
 *    Agent Card referenced by tokenURI. We emit the EXACT ERC-8004 IdentityRegistry
 *    events (Registered / URIUpdated / MetadataSet) so generic ERC-8004 indexers read
 *    this contract as a compliant Identity Registry.
 *  - Link to canonical: an agent can be linked to the OFFICIAL canonical ERC-8004
 *    agentId minted on Mantle's 0x8004… Identity Registry, so this log is joinable to
 *    the agent's official identity & reputation.
 *  - Benchmark log: `logDecision` writes every autonomous decision (the AI inference +
 *    the on-chain action it took + realized PnL) permanently on-chain. THIS is the
 *    "AI-powered function callable on-chain" + the on-chain benchmark of agent behaviour
 *    that the Turing Test Hackathon is built around.
 */
contract DecisionRegistry is ERC721URIStorage {
    struct AgentMeta {
        uint256 canonicalAgentId; // official ERC-8004 agentId on the canonical registry (0 if unlinked)
        address canonicalRegistry; // address of the canonical Identity Registry
        uint64 decisionCount;
        int256 cumRealizedPnl; // cumulative realized PnL logged (quote USD, 1e8)
        uint256 createdAt;
    }

    struct Decision {
        bytes32 actionType; // keccak256 of "REBALANCE" / "DERISK" / "ENTER" / "EXIT" / "HOLD"
        address fromAsset;
        address toAsset;
        uint256 amount; // amount of fromAsset moved (token units)
        int256 predictedDirectionBps; // agent's predicted move, basis points (+/-)
        uint256 confidenceBps; // 0..10000
        bytes32 signalsHash; // hash of the off-chain signal snapshot that drove this
        int256 realizedPnl; // realized PnL attributed to this decision (quote USD, 1e8)
        string reason; // short human-readable summary (<= ~140 chars)
        string rationaleURI; // optional pointer to full rationale / signal detail
    }

    uint256 private _nextId = 1;

    mapping(uint256 => AgentMeta) public agents;
    mapping(uint256 => mapping(bytes32 => bytes)) private _metadata;
    mapping(uint256 => mapping(address => bool)) public agentOperators; // agentId => hot key => allowed

    // ---- ERC-8004 IdentityRegistry-compatible events ----
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);

    // ---- Sentinel-specific events ----
    event CanonicalLinked(uint256 indexed agentId, address indexed canonicalRegistry, uint256 canonicalAgentId);
    event OperatorSet(uint256 indexed agentId, address indexed operator, bool allowed);
    event AgentDecision(
        uint256 indexed agentId,
        bytes32 indexed actionType,
        uint256 seq,
        address fromAsset,
        address toAsset,
        uint256 amount,
        int256 predictedDirectionBps,
        uint256 confidenceBps,
        bytes32 signalsHash,
        int256 realizedPnl,
        string reason,
        string rationaleURI
    );

    error NotAgentController(uint256 agentId, address caller);

    constructor() ERC721("Sentinel Agent", "SENTINEL") {}

    modifier onlyAgentController(uint256 agentId) {
        if (ownerOf(agentId) != msg.sender && !agentOperators[agentId][msg.sender]) {
            revert NotAgentController(agentId, msg.sender);
        }
        _;
    }

    // ---------------------------------------------------------------------
    // ERC-8004 Identity Registry surface
    // ---------------------------------------------------------------------

    /// @notice Register a new local agent identity (mints an ERC-721). agentId == tokenId.
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        agents[agentId].createdAt = block.timestamp;
        emit Registered(agentId, agentURI, msg.sender);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(ownerOf(agentId) == msg.sender, "not agent owner");
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        require(ownerOf(agentId) == msg.sender, "not agent owner");
        _metadata[agentId][keccak256(bytes(metadataKey))] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory) {
        return _metadata[agentId][keccak256(bytes(metadataKey))];
    }

    // ---------------------------------------------------------------------
    // Linking + operator authorization
    // ---------------------------------------------------------------------

    /// @notice Link this local agent to its OFFICIAL canonical ERC-8004 identity on Mantle.
    function linkCanonical(uint256 agentId, address canonicalRegistry, uint256 canonicalAgentId) external {
        require(ownerOf(agentId) == msg.sender, "not agent owner");
        agents[agentId].canonicalRegistry = canonicalRegistry;
        agents[agentId].canonicalAgentId = canonicalAgentId;
        emit CanonicalLinked(agentId, canonicalRegistry, canonicalAgentId);
    }

    /// @notice Authorize an off-chain agent hot key (or the SentinelVault) to log decisions.
    function setOperator(uint256 agentId, address operator, bool allowed) external {
        require(ownerOf(agentId) == msg.sender, "not agent owner");
        agentOperators[agentId][operator] = allowed;
        emit OperatorSet(agentId, operator, allowed);
    }

    // ---------------------------------------------------------------------
    // The benchmark log
    // ---------------------------------------------------------------------

    /// @notice Permanently record one autonomous agent decision on-chain.
    /// @dev Callable by the agent NFT owner or an authorized operator (e.g. the SentinelVault).
    function logDecision(uint256 agentId, Decision calldata d)
        external
        onlyAgentController(agentId)
        returns (uint256 seq)
    {
        AgentMeta storage m = agents[agentId];
        seq = ++m.decisionCount;
        m.cumRealizedPnl += d.realizedPnl;
        emit AgentDecision(
            agentId,
            d.actionType,
            seq,
            d.fromAsset,
            d.toAsset,
            d.amount,
            d.predictedDirectionBps,
            d.confidenceBps,
            d.signalsHash,
            d.realizedPnl,
            d.reason,
            d.rationaleURI
        );
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function decisionCount(uint256 agentId) external view returns (uint64) {
        return agents[agentId].decisionCount;
    }

    function getAgent(uint256 agentId)
        external
        view
        returns (
            address owner,
            uint256 canonicalAgentId,
            address canonicalRegistry,
            uint64 count,
            int256 cumRealizedPnl,
            uint256 createdAt
        )
    {
        AgentMeta memory m = agents[agentId];
        return (ownerOf(agentId), m.canonicalAgentId, m.canonicalRegistry, m.decisionCount, m.cumRealizedPnl, m.createdAt);
    }

    function totalAgents() external view returns (uint256) {
        return _nextId - 1;
    }
}
