# Technical Ground Truth (verified) — Mantle / ERC-8004 / Gas

> All facts below were independently verified (adversarial cross-check) against primary sources: official Mantle docs, chainlist.org, ethereum-lists/chains, Etherscan V2 chainlist, mantlescan, the ERC-8004 EIP + reference repo. Confidence HIGH unless noted. **Use these verbatim in code.**

## 1. Mantle networks

### Mantle Sepolia TESTNET (our default deploy target)
| Field | Value |
|---|---|
| chainId | **5003** (hex `0x138b`) |
| RPC (HTTPS) | **https://rpc.sepolia.mantle.xyz** (no official testnet WebSocket) |
| Native currency | **MNT**, 18 decimals |
| Block explorer | **https://sepolia.mantlescan.xyz** (Etherscan-built) |
| Faucet | **https://faucet.mantle.xyz** |

> ⚠️ `https://explorer.sepolia.mantle.xyz` now **302-redirects** to `sepolia.mantlescan.xyz` (it is NOT a separate live Blockscout). Use `sepolia.mantlescan.xyz`.

### Mantle MAINNET (optional upgrade)
| Field | Value |
|---|---|
| chainId | **5000** (hex `0x1388`) |
| RPC | **https://rpc.mantle.xyz** , WSS **wss://wss.mantle.xyz** |
| Native currency | **MNT**, 18 decimals |
| Block explorer | **https://mantlescan.xyz** |

> ⚠️ `https://explorer.mantle.xyz` 302-redirects to `mantlescan.xyz`.

## 2. Contract verification (Etherscan API V2 — unified)
- **One free Etherscan API key** works across all chains. Get it at https://etherscan.io/myapikey
- Base endpoint: **`https://api.etherscan.io/v2/api?chainid=5003`** (testnet) or `chainid=5000` (mainnet). Both chainids are confirmed in the Etherscan V2 supported-chains list.
- **Hardhat (hardhat-verify v2 / Hardhat 3)**: single top-level `etherscan.apiKey` string = the Etherscan V2 key; for older `@nomicfoundation/hardhat-verify` v1 use `customChains` mapping `mantleSepolia` → apiURL `https://api.etherscan.io/v2/api?chainid=5003`, browserURL `https://sepolia.mantlescan.xyz`. We pin **hardhat-verify v2 + Etherscan V2** to avoid the legacy customChains complexity.
- **Foundry**: `forge verify-contract <ADDR> src/X.sol:X --verifier etherscan --verifier-url 'https://api.etherscan.io/v2/api?chainid=5003' --etherscan-api-key $ETHERSCAN_API_KEY --watch`
- Legacy `api.mantlescan.xyz/api` / `api-sepolia.mantlescan.xyz/api` are **possibly deprecated** — use V2 as primary.

## 3. Gas — Mantle-specific gotchas (these break naive deploys)
- EIP-1559 active. **BaseFee fixed at 0.02 gwei (20,000,000 wei)** via L1 SystemConfig.
- **Set `maxPriorityFeePerGas = 0`** (official recommendation; Mantle uses FIFO sequencing).
- **Do NOT hard-cap a low `gasLimit`.** Mantle v2 (Tectonic) folds the L1 data fee into `eth_estimateGas`, which returns *total* cost + ~20% buffer → the gas number looks huge vs Ethereum but the MNT cost is tiny at 0.02 gwei. Let the provider auto-estimate.
- `tokenRatio` (= ETH price / MNT price, in `GasPriceOracle.sol`) scales ETH-denominated L1 costs into MNT.
- **There is no `eth_estimateTotalFee` / `eth_estimateExecutionGas` RPC method** (a common hallucination). Use standard **`eth_estimateGas`**. Receipts expose `l1Fee`, `l1GasPrice`, `l1GasUsed` for manual inspection.
- In Hardhat/Foundry: **don't set manual `gasPrice`/`gasLimit`**; if forced, set `maxPriorityFeePerGas: 0`.

## 4. Solidity / EVM
- **Solidity 0.8.24**, **evmVersion `cancun`** (Mantle supports Cancun/EIP-4844 blobs and beyond — Osaka). `cancun` is safe; no need for london/paris fallback. Optimizer on, runs 200.
- Mantle is **EVM-compatible** (not strictly "equivalent" — modified gas accounting). Hardhat / Foundry / ethers / viem work unchanged.

## 5. ERC-8004 "Trustless Agents" (DRAFT, created 2025-08-13)

### Canonical contract addresses — **verified live on mantlescan** (CREATE2 vanity `0x8004…`, identical on 35+ chains)
| Registry | Mantle MAINNET (5000) | Mantle TESTNET (5003) |
|---|---|---|
| **Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| **Reputation Registry** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Validation Registry | *not yet deployed (spec in flux — stub/gate it)* | *not yet deployed* |

> The mainnet Identity Registry was confirmed live on mantlescan (label "8004: Identity Registry", ERC-1967 upgradeable proxy). **Checksum-verify each address before sending tx.**

### Identity Registry interface (verbatim from EIP-8004) — agentId == ERC-721 tokenId
```solidity
struct MetadataEntry { string metadataKey; bytes metadataValue; }
function register(string agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId);
function register(string agentURI) external returns (uint256 agentId);
function register() external returns (uint256 agentId);
function setAgentURI(uint256 agentId, string calldata newURI) external;
function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external;
function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory);
function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external; // EIP-712
function getAgentWallet(uint256 agentId) external view returns (address);
// events: Registered(uint256 indexed agentId, string agentURI, address indexed owner);
//         URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
//         MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
```

### Reputation Registry (verbatim) — record agent performance as on-chain reputation
```solidity
function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals,
  string calldata tag1, string calldata tag2, string calldata endpoint,
  string calldata feedbackURI, bytes32 feedbackHash) external;
function getSummary(uint256 agentId, address[] calldata clients, string tag1, string tag2)
  external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
// event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash);
```

### Integration strategy (decided)
**Do-not-fork-identity (Pattern A).** Our agent registers on the **official canonical Mantle testnet Identity Registry** (`0x8004A818…BD9e`) to mint the **official ERC-8004 agent NFT** (matches the hackathon's official feature #2 + the Q&A answer that Mantle issues the NFT). Our own `DecisionRegistry` then:
1. Emits ERC-8004-compatible identity events (so indexers read us as compliant) for a *local mirror* agentId, AND
2. Logs every agent decision keyed by the **official canonical agentId**, AND
3. Optionally calls the official `ReputationRegistry.giveFeedback(agentId, …)` to write the agent's realized PnL/score as portable on-chain reputation.

This gives us BOTH the official identity NFT and a rich, self-owned, verifiable on-chain decision/benchmark log — hitting official features #1 (on-chain benchmarking) and #2 (ERC-8004 identity) at once.

> ⚠️ Validation Registry is the in-flux part of the spec and has no canonical deployment — **stub/gate it**, don't depend on it.

## 6. Submission mechanics (from devhub + DoraHacks)
- Formal: **DoraHacks "Submit BUIDL"** with open-source repo + deployed Mantle contract address + runnable demo (public URL) + pitch.
- Plus a public **X thread** tagged (e.g. `#MantleAIHackathon` / project) — also the channel for **Community Voting**.
- Deployment Award checklist (objective, first-come): contract on Mantle (testnet OK) + **verified on mantlescan** + ≥1 AI function callable on-chain (our `logDecision`/`execute`) + **public frontend (not localhost)** + address in submission + **demo video ≥2 min** + GitHub repo with README (setup, architecture, deployed address).
