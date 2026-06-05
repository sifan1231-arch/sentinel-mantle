# Locked Design — "Sentinel" (final blueprint to build)

> Decided after research + Builder↔Critic. Name is final-but-renamable (find/replace). This is the single source of truth for the build.

## 1. One-liner & hook
**Sentinel — the self-proving autonomous trading agent on Mantle.**
> *"Sentinel watches smart money & on-chain anomalies on Mantle, trades your risk mandate 24/7, and writes every decision provably on-chain. Sign once — it runs itself, and proves it."*

Turing-Test framing: an agent **passes the test by its verifiable on-chain track record**, not by talking. Its reputation is earned on-chain (ERC-8004), every decision auditable.

## 2. Why this wins (mapping to research)
- **Soul of the hackathon** = "autonomous agents creating *verifiable, on-chain* value." Sentinel is an agent **with hands** that executes real Mantle txs, not a read-only dashboard.
- **Highest-leverage differentiator**: most past winners did NOT prove live on-chain execution/PnL. Sentinel makes **verifiable on-chain proof the centerpiece** (real tx hashes, on-chain NAV/PnL).
- **Judge alignment**: smart-money/anomaly signals (**Nansen**), optional decentralized-inference forecast (**Allora**), revenue/self-sustaining framing (**Virtuals/Animoca**), multi-agent swarm (**Animoca/Virtuals**), measurable metrics (**Caladan/Hashed/Four Pillars**), ERC-8004 identity (**official feature #2**), open-source reproducible (**DoraHacks**).
- **Self-contained & buildable**: no RealClaw/Bybit/Byreal/Solana hard dependency; runs without an LLM key (deterministic engine, LLM optional). Judge can clone & run.

## 3. Target prizes (one project → many)
- **Primary track:** AI Alpha & Data ($8,500) — smart-money/anomaly intelligence that *acts*. (Defensible also in Agentic narrative; RWA-asset-aware as bonus.)
- **Floor:** Finalist & Deployment Award ($1,000) — meets every objective checkbox; **ship early to lock a slot.**
- **Best UI/UX ($3,000):** the live "watch the swarm think" dashboard.
- **Community Voting ($8,500):** shareable hook + X campaign kit.
- **Grand Champion ($9,000, stretch):** maxes Technical Depth (AI×on-chain swarm), Innovation (on-chain verifiable agent benchmark + ERC-8004), Mantle Contribution (drives on-chain data + RWA awareness), Product Completeness.

## 4. The agent = a 3-role swarm (pre-empts "just an LLM wrapper")
```
 SENSE            DECIDE            ACT                PROVE
┌────────┐      ┌────────┐      ┌──────────┐      ┌──────────────┐
│ SCOUT  │─────▶│ WARDEN │─────▶│ OPERATOR │─────▶│ DecisionReg  │
│ alpha  │ sig  │ risk   │ ok?  │ on-chain │ tx   │ + Reputation │
│ signals│      │ mandate│ veto │ execute  │      │ (ERC-8004)   │
└────────┘      └────────┘      └──────────┘      └──────────────┘
   ▲                                                     │
   └──────────── live dashboard renders every step ◀─────┘
```
- **Scout** (signals/alpha): reads **live Mantle on-chain data** (large transfers / whale & "smart-money" wallet activity / volume & anomaly z-scores) via RPC, plus **real market prices** (e.g. CoinGecko/Pyth Hermes) for ETH/mETH/USDY-class assets, plus **optional Allora** inference (price/volatility forecast). Emits a structured signal + confidence.
- **Warden** (risk): enforces the user's **mandate** (max position %, max drawdown, per-asset cap, cooldown, allowlist). Can **veto** Scout. Pure, deterministic, explainable.
- **Operator** (execution): turns an approved decision into **real Mantle transactions** — pushes the price to our on-chain oracle, then calls `SentinelVault.execute(...)` to swap/rebalance against our on-chain pool; finally writes the decision + outcome to `DecisionRegistry` (and optionally `ReputationRegistry`).
- **Brain** is a **deterministic decision engine** (works with **no API key**) with an **optional LLM enrichment** (Anthropic/Allora) for natural-language rationale. The on-chain proof is identical either way.

## 5. On-chain components (Solidity 0.8.24, Mantle Sepolia)
1. **`DecisionRegistry.sol`** — ERC-8004-aligned. Holds a local agent identity (ERC-721, mirrors the official canonical agentId) and the **immutable on-chain decision log**: `logDecision(agentId, actionType, signalsHash, rationaleURI, predictedDirection, confidenceBps, realizedPnL)` → `AgentDecision` event. This is the **verifiable AI-function-on-chain** (Deployment Award) + **on-chain benchmark** (feature #1). Emits ERC-8004-compatible `Registered/URIUpdated/MetadataSet` events for indexer compliance.
2. **`SentinelVault.sol`** — custodies deposits; `execute(action)` rebalances between assets via the pool under on-chain risk guards (max slippage, allowlist, per-tx cap mirrored on-chain so even a rogue agent can't exceed the mandate); computes **NAV & realized/unrealized PnL on-chain** (priced by the oracle) → verifiable performance. Owner = the deployer; agent = an authorized `operator` role (so "sign once" = user authorizes the agent operator once).
3. **`SentinelOracle.sol`** — push oracle the Operator updates with **real prices**; used for NAV + pool pricing. Owner/operator-gated, with staleness + deviation guards.
4. **`mock/MockERC20.sol`** — `mUSD` (USD stable), `mETH` (≈ Mantle staked ETH), `mRWA` (≈ Ondo USDY-class yield RWA). Clearly labelled testnet instruments **representing real Mantle assets, priced with real market data**.
5. **`mock/SentinelPool.sol`** — minimal **oracle-priced** swap pool (deterministic, no AMM slippage games) the Vault trades against, seeded with testnet liquidity → **real on-chain swaps, real verifiable state changes, real PnL**, zero external/real-funds dependency. (Mainnet mode can point `execute` at a real Mantle DEX router instead.)

> Mainnet mode (optional flag): swap mock pool for a real Mantle DEX router and mock tokens for real USDY/mETH addresses (see `03-RWA-ADDRESSES.md`). Default = testnet, fully self-contained.

## 6. Repo layout
```
turing-test-mantle/
  docs/            00-strategy 01-tech-ground-truth 02-locked-design 03-rwa-addresses
  contracts/       Hardhat (Solidity 0.8.24, cancun) — contracts, scripts(deploy/verify/register-erc8004/seed-demo), test, hardhat.config.ts
  agent/           TS swarm — src/{index, swarm/{scout,warden,operator}, signals/{mantleData,prices,allora}, brain/decide, chain/contracts, adapters/byreal(stub), config}
  web/             Next.js dashboard — live decision feed, swarm reasoning, on-chain proof links, PnL chart, ERC-8004 identity card, anomaly feed
  .env.example     PRIVATE_KEY, MANTLE_RPC, ETHERSCAN_API_KEY, (optional) ANTHROPIC_API_KEY, ALLORA, mode flags
  README.md        problem→insight→agent→proof; setup; architecture; deployed addresses + verified-contract links + sample tx hashes
  package.json     workspace root (npm workspaces)
```

## 7. Deployment Award checklist → how each is met
| Requirement | How Sentinel meets it |
|---|---|
| Contract on Mantle (testnet OK) | Deploy all contracts to Mantle Sepolia (5003) via `scripts/deploy.ts` |
| Verified on mantlescan | `scripts/verify.ts` via Etherscan V2 (`chainid=5003`) |
| ≥1 AI function callable on-chain | `DecisionRegistry.logDecision(...)` (agent writes inference) + `SentinelVault.execute(...)` (automated execution) |
| Public frontend (not localhost) | Next.js dashboard → Vercel one-click (config provided) |
| Address in submission | Auto-written to `deployments.json` + README + submission text |
| Demo video ≥2 min | Shot-by-shot script in `docs/` |
| Repo + README | This repo; README with setup/architecture/address |

## 8. Build order (main loop authors core; review via workflows)
1. Contracts + tests + Hardhat config (foundation).
2. Deploy / verify / register-erc8004 / seed-demo scripts.
3. Agent swarm (TS) — runs against deployed addresses; deterministic engine first, optional LLM/Allora second.
4. Web dashboard (Next.js) — reads chain + agent state, renders the swarm thinking + proofs.
5. Docs/submission kit — README, pitch, 2-min video script, DoraHacks BUIDL text, X campaign kit, run-book.
6. **Adversarial review workflows** — (a) Solidity security/correctness audit, (b) build/run correctness check, (c) "will this win" judge-panel against the rubric — then iterate.

## 9. Scope discipline (research: breadth loses)
MVP must be bulletproof on the ONE loop: sense → risk → execute → prove → render. **No** token, launchpad, social feed, or second use case. Byreal adapter = optional feature-flagged stub (off by default). Validation Registry = stubbed. LLM = optional.

## 10. Manual steps for the user (turnkey)
1. `npm install` at root (installs all workspaces).
2. Create `.env` from `.env.example`; paste a throwaway wallet private key + free Etherscan API key.
3. Fund the wallet at https://faucet.mantle.xyz (free testnet MNT).
4. `npm run deploy` → deploys + seeds + writes addresses. `npm run verify`. `npm run register:agent` (mint official ERC-8004 NFT). 
5. `npm run agent` → the swarm runs autonomously. `npm run web` then deploy `web/` to Vercel (public URL).
6. Record the 2-min demo (script provided), submit on DoraHacks, post the X thread.
