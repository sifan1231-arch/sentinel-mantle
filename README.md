<div align="center">

# 🛡️ Sentinel

### The self-proving autonomous RWA yield &amp; risk agent on Mantle

**Sentinel autonomously manages a real-world-asset portfolio on Mantle — rotating between USDY-class RWA yield, mETH staking, and a stable buffer — driven by smart-money &amp; on-chain anomaly signals, bounded by a risk mandate it can never exceed, and writing every decision + realized PnL permanently on-chain. Sign once. It runs itself, and proves it.**

`AI × RWA` · `Mantle` · `ERC-8004 agent identity` · `verifiable on-chain benchmark`

*Built for the [Mantle Turing Test Hackathon 2026](https://dorahacks.io/hackathon/mantleturingtesthackathon2026) — Phase II "AI Awakening".*

</div>

---

## The Turing Test, taken literally

The hackathon's thesis (Emily Bao, Bybit/Byreal/Mantle): *"not just humans trading assets, but autonomous agents creating **verifiable, on-chain value**."*

Most "AI trading agents" are a slick UI wrapped around one LLM call. They *claim* performance. **Sentinel proves it.** Its Turing Test isn't a chat transcript — it's an immutable, auditable track record on Mantle: every signal it acts on, every trade it makes, every dollar of PnL, written on-chain by the agent itself.

## What it is

An autonomous **RWA portfolio manager** run by a **swarm of three specialist agents**. It continuously rebalances three Mantle sleeves toward a signal-driven target and proves every move on-chain:

| Sleeve | Asset | Role |
|---|---|---|
| 🟦 **Buffer** | `mUSD` (stable) | dry powder, sized by market regime |
| 🟩 **Risk** | `mETH` (≈ Mantle staked ETH) | ETH staking yield + upside when signals are bullish |
| 🟨 **Yield** | `mRWA` (≈ Ondo **USDY**) | real-world-asset T-bill yield — idle cash is deployed here, not left idle |

```
 SENSE                 DECIDE                  ACT                   PROVE
┌───────────┐    ┌────────────────┐    ┌────────────┐    ┌──────────────────┐
│  SCOUT    │ →  │    WARDEN      │ →  │  OPERATOR  │ →  │ DecisionRegistry  │
│ Pyth +    │    │ target weights │    │ rebalances │    │ + Reputation      │
│ Mantle    │    │ + risk mandate │    │ on Mantle  │    │ (ERC-8004 aligned)│
│ on-chain  │    │ (on-chain) veto│    │            │    │ every decision    │
└───────────┘    └────────────────┘    └────────────┘    └──────────────────┘
```

- **Scout** reads **real** prices from **Pyth** (mETH/USD, USDY/USD — no API key) and **real mETH transfer flow on Mantle mainnet** to compute momentum, volatility, a smart-money flow proxy, a whale-anomaly z-score, and a **market regime** (trend / chop / shock).
- **Warden** turns that into **target sleeve weights** and enforces an owner-set **risk mandate it can never exceed** — per-trade cap, per-asset weight cap, drawdown circuit-breaker. It can veto. *These guards live **in the smart contract**, so even a compromised agent key can't blow up the vault.*
- **Operator** executes the single best rebalancing trade on Mantle and **atomically writes the decision + realized PnL** to an **ERC-8004-aligned** `DecisionRegistry`.

On a shock it cuts mETH and rotates into the USDY yield sleeve + a bigger USD buffer; in a calm trend it deploys the buffer into mETH and RWA yield. The agent runs **fully without an LLM key** (deterministic engine). Add `ANTHROPIC_API_KEY` for a natural-language rationale — **the on-chain proof is identical either way.**

## Why this is real, not a mock

| Claim | How it's verifiable |
|---|---|
| Real market data | Scout pulls live **Pyth** mETH/USDY prices + reads **real mETH transfers on Mantle mainnet**. |
| Real on-chain execution | Every trade is a real Mantle tx against an on-chain pool; **NAV &amp; PnL are computed on-chain**. |
| Real risk control | The mandate (trade cap / asset cap / drawdown halt) is **enforced in `SentinelVault`**, unit-tested. |
| Real agent identity | Registers on the canonical **ERC-8004** Identity Registry on Mantle (`0x8004A818…BD9e`). |
| Reproducible | Open-source, one-command deploy, 16 passing contract tests, runs end-to-end on a local chain. |

> Testnet uses clearly-labelled instruments (`mETH`, `mRWA`≈USDY, `mUSD`) **priced with real market data**, on self-contained rails — so trades are genuinely on-chain and PnL is genuinely verifiable, with **zero** dependency on a funded exchange account or a whitelisted tool. A one-flag `mainnet` mode points at real Mantle RWA assets (USDY/mETH) + a real DEX.

---

## ⚡ Quickstart (≈ 5 minutes, free testnet)

```bash
# 0. install (three independent packages)
npm run setup

# 1. configure
cp .env.example .env
#   → paste a THROWAWAY wallet PRIVATE_KEY and a free Etherscan API key
#   → fund the wallet with free testnet MNT at https://faucet.mantle.xyz

# 2. test, deploy, verify on Mantle Sepolia
npm run test:contracts        # 16 passing
npm run deploy                # deploys + seeds; writes deployments/ + the web config
npm run verify                # verifies all contracts on mantlescan
npm run register:agent        # (optional) mints the official ERC-8004 identity NFT

# 3. run the agent — watch it think, decide, and prove on-chain
npm run agent                 # live loop  (npm run agent:demo for a quick 6-cycle run)

# 4. the dashboard (public frontend)
npm run web                   # http://localhost:3000  → deploy web/ to Vercel for a public URL
```

Everything the dashboard shows is read **live from your Mantle contracts** — no backend.

## 🏗️ On-chain components (Solidity 0.8.24, Mantle)

| Contract | Role |
|---|---|
| **`DecisionRegistry`** | ERC-8004-aligned agent identity (ERC-721) **+ the immutable on-chain decision log** — the "AI function callable on-chain" and the verifiable benchmark. |
| **`SentinelVault`** | Custodies funds; `execute()` rebalances **only within on-chain mandate guards** (trade cap, asset cap, drawdown breaker, slippage); computes NAV/PnL on-chain; logs every action atomically. |
| **`SentinelOracle`** | Push oracle the agent updates with real prices (deviation + staleness guards). |
| **`SentinelPool`** + mocks | Self-contained oracle-priced venue + testnet instruments representing real Mantle assets. |

## 🧠 The agent (`/agent`, TypeScript)

`Scout → Warden → Operator` over `ethers v6`. Signals: **Pyth Hermes** (real, keyless) + **Mantle mainnet on-chain reads** + optional **Allora** decentralized inference. Deterministic decision engine with optional **Claude** rationale.

## 🖥️ The dashboard (`/web`, Next.js)

A live "mission control" that renders the swarm thinking, the portfolio, the on-chain risk mandate, the ERC-8004 identity, and a **verifiable decision feed** — every row links to the tx on mantlescan.

---

## 🏆 How it maps to the prizes

- **AI × RWA track (primary)** — *dynamic yield strategies + automated risk management for USDY &amp; mETH* (literally the track brief): the agent rebalances a USDY/mETH/stable portfolio under on-chain risk bounds, capturing RWA yield while managing drawdown — autonomously and verifiably.
- **Finalist &amp; Deployment Award** — verified contracts on Mantle ✓, an AI function callable on-chain (`logDecision`/`execute`) ✓, public frontend ✓, demo video ✓, this README ✓.
- **AI Alpha &amp; Data (secondary)** — the signal layer: real Pyth + real on-chain smart-money/anomaly intelligence, with an on-chain verifiable track record.
- **Best UI/UX** — the live, legible agent dashboard.
- **Grand Champion** — AI×on-chain swarm (technical depth), on-chain verifiable agent benchmark + ERC-8004 (innovation), **drives Mantle RWA usage — USDY/mETH yield management** (ecosystem), runnable end-to-end (completeness).

## 📁 Repo layout

```
contracts/   Hardhat — Solidity, deploy/verify/register/demo scripts, 16 tests
agent/       TypeScript swarm — Scout / Warden / Operator, signals, brain
web/         Next.js dashboard — reads everything live from chain
docs/        strategy, verified tech ground truth, design, submission kit
```

## 🔒 Safety &amp; honesty notes

- Withdrawals are **owner-only**; the agent key can only `execute` within the on-chain mandate.
- The drawdown **circuit breaker latches** (`tripBreakerIfBreached`) and halts the agent until the owner reviews.
- Use a **throwaway key** for testnet. The mock assets are explicitly labelled; PnL reflects real price moves + real spread costs (no fabricated numbers).

## 📜 License

MIT. See [docs/01-TECH-GROUND-TRUTH.md](docs/01-TECH-GROUND-TRUTH.md) for the verified Mantle / ERC-8004 / Pyth addresses used.
