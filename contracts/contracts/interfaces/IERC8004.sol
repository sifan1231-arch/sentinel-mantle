// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Minimal ERC-8004 ("Trustless Agents") interfaces
 * @notice Subset of the EIP-8004 Identity & Reputation registries that Sentinel
 *         interacts with. The canonical registries are deployed deterministically
 *         (CREATE2 vanity 0x8004…) at the SAME address on 35+ chains incl. Mantle:
 *
 *           Mantle TESTNET (5003):
 *             Identity   0x8004A818BFB912233c491871b3d84c89A494BD9e
 *             Reputation 0x8004B663056A597Dffe9eCcC1965A193B7388713
 *           Mantle MAINNET (5000):
 *             Identity   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 *             Reputation 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
 *
 *         Signatures are taken verbatim from the EIP-8004 draft (2025-08-13).
 *         The Validation Registry is intentionally omitted (spec still in flux).
 */

struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}

interface IIdentityRegistry {
    function register(string calldata agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId);
    function register(string calldata agentURI) external returns (uint256 agentId);
    function register() external returns (uint256 agentId);

    function setAgentURI(uint256 agentId, string calldata newURI) external;
    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external;
    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory);

    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;
    function getAgentWallet(uint256 agentId) external view returns (address);

    function ownerOf(uint256 agentId) external view returns (address);
    function tokenURI(uint256 agentId) external view returns (string memory);

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
}

interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}
