# Sentinel — Submission Kit & Run-book

Everything you need to deploy, prove, record, and submit. Copy-paste friendly.
Fill the `<…>` placeholders after you deploy (the deploy script prints them and writes `contracts/deployments/mantleSepolia.json`).

---

## 0. What only YOU can do (Claude built the rest)
1. Provide a **throwaway wallet private key** + a **free Etherscan API key** in `.env`.
2. **Fund** the wallet with free testnet MNT: https://faucet.mantle.xyz
3. Run the commands below (deploy / verify / register / agent / seed).
4. **Deploy the dashboard** to a public URL (Vercel — one click).
5. **Record the ≥2-min demo video** (script in §4).
6. **Submit on DoraHacks** (text in §2) and **post the X thread** (§5) for Community Voting.
7. *(Optional)* Approve the official ERC-8004 registration tx.

---

## 1. Run-book (≈ 8 minutes)

```bash
cd turing-test-mantle
npm run setup                     # installs contracts + agent + web

cp .env.example .env              # then edit: PRIVATE_KEY + ETHERSCAN_API_KEY
#   → fund the wallet at https://faucet.mantle.xyz

npm run test:contracts            # 16 passing — sanity
npm run deploy                    # deploys to Mantle Sepolia, seeds, writes addresses + web config
npm run verify                    # verifies every contract on sepolia.mantlescan.xyz
npm run register:agent            # (optional) mints the official ERC-8004 identity NFT

npm run seed:demo                 # fires a few real on-chain decisions → copy the tx hashes for the README
npm run agent                     # OR run the live agent loop (Ctrl-C to stop)

# Dashboard → public URL:
cd web && npx vercel --prod       # (or push to GitHub and import at vercel.com)
```

> **Lock the Deployment Award slot early:** the award is first-come for the first 20 projects that meet all objective criteria. Deploy + verify + run `seed:demo` (gets a real on-chain AI decision) + put the public dashboard up **on day one**, then keep polishing.

After deploy, fill these (from `contracts/deployments/mantleSepolia.json`):
- Vault: `<VAULT_ADDR>` → https://sepolia.mantlescan.xyz/address/`<VAULT_ADDR>`#code
- DecisionRegistry: `<REGISTRY_ADDR>`
- Agent ID: `<AGENT_ID>`
- Sample decision txs: `<TX_1>`, `<TX_2>`, `<TX_3>`
- Public dashboard: `<VERCEL_URL>`

---

## 2. DoraHacks BUIDL submission

**Project name:** Sentinel — the self-proving autonomous RWA yield & risk agent on Mantle

**One-line pitch:** An autonomous AI swarm that manages a real-world-asset portfolio on Mantle (USDY-class yield + mETH + stable buffer), driven by smart-money & anomaly signals, bounded by an on-chain risk mandate it can never exceed, and proving every decision + realized PnL on-chain.

**Tracks:** **AI × RWA (primary)** · Finalist & Deployment Award · AI Alpha & Data (secondary) · Best UI/UX · Grand Champion

**Description:**
> The hackathon's thesis is "autonomous agents creating *verifiable, on-chain* value." Sentinel takes the Turing Test literally: instead of *claiming* performance, it earns an immutable, auditable track record on Mantle. It autonomously manages a **real-world-asset portfolio** — rotating between **USDY-class RWA yield (mRWA)**, **mETH staking**, and a **stable buffer** — driven by a three-agent swarm: **Scout** (real Pyth prices + real Mantle-mainnet mETH flow + whale anomalies + a trend/chop/shock regime), **Warden** (turns signals into target sleeve weights and enforces an on-chain risk mandate; can veto), **Operator** (executes the best rebalance on Mantle and atomically logs the decision). Idle cash is deployed into RWA yield; on a shock it cuts mETH and rotates into yield + buffer. Every trade, inference, and dollar of realized PnL is written by the agent itself to an **ERC-8004-aligned** `DecisionRegistry`. The mandate (per-trade cap, per-asset cap, drawdown circuit-breaker) is enforced **in the smart contract**, so even a compromised agent key can't exceed it. Runs **without an LLM key** (deterministic engine; optional Claude rationale). Open-source, 16 passing contract tests, verified on mantlescan, with a live dashboard that renders the swarm thinking and links every decision to its tx.

**Deployed (Mantle Sepolia, chainId 5003):**
- Vault `<VAULT_ADDR>` · DecisionRegistry `<REGISTRY_ADDR>` · Oracle `<ORACLE_ADDR>` (all verified)
- Agent ERC-8004 id `<AGENT_ID>` · canonical registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Repo: `https://github.com/sifan1231-arch/sentinel-mantle` · Live demo: `<VERCEL_URL>` · Video: `<VIDEO_URL>`

### Track Q&A — "Tell us in your submission" (AI × RWA)
- **What real-world asset are you bringing on-chain?** Yield-bearing RWA on Mantle: **Ondo USDY** (tokenized US T-bill yield, the `mRWA` sleeve) alongside **mETH** (Mantle staked ETH). The agent's job is dynamic yield allocation + automated risk management across them, under on-chain risk bounds — exactly the track brief. (Testnet uses clearly-labelled instruments priced with the **real** USDY/mETH Pyth feeds; one-flag `mainnet` mode points at the real Mantle addresses — see [03-RWA-ADDRESSES.md](03-RWA-ADDRESSES.md).)
- **How does AI play a role?** A three-agent swarm autonomously sets target sleeve weights from real market + on-chain signals and a regime classifier, deploys idle cash into RWA yield, and de-risks into yield + buffer on shocks — within an on-chain mandate. Its inference (predicted direction + confidence) + rationale are written on-chain with each rebalance.
- **How is it realized on Mantle?** Every rebalance is a real Mantle transaction; NAV, weights, and realized PnL are computed **on-chain**; the `DecisionRegistry` (ERC-8004-aligned) is the agent's permanent, auditable benchmark — anyone can verify the RWA-management track record on mantlescan, no trust required.

### Also eligible — AI Alpha & Data (the signal layer)
- **Data sources:** real **Pyth** feeds (mETH/USD, USDY/USD, keyless) + **real on-chain mETH transfer flow on Mantle mainnet** for momentum, volatility, a smart-money flow proxy, and a whale-anomaly z-score; optional **Allora** inference.
- **Verifiable value:** every signal that drives a trade is committed on-chain (`signalsHash`) and the resulting decision + PnL is auditable on mantlescan.

---

## 3. Deployment Award checklist (objective — meet ALL)
- [x] Smart contract deployed on Mantle (Sepolia) — `npm run deploy`
- [x] Verified on Mantle Explorer — `npm run verify`
- [x] ≥1 AI-powered function callable on-chain — `DecisionRegistry.logDecision` / `SentinelVault.execute` (agent writes its inference/decision on-chain)
- [ ] Public frontend (not localhost) — deploy `web/` to Vercel
- [ ] Deployment address in the DoraHacks submission — paste `<VAULT_ADDR>`
- [ ] Demo video ≥ 2 min — record per §4
- [x] Open-source GitHub repo with README (setup, architecture, deployed address)

---

## 4. 2-minute demo video script (shot-by-shot)

> Screen-record the terminal + the dashboard + mantlescan. Aim for 110–120s.

1. **(0:00–0:15) Hook.** Dashboard hero on screen. Say: *"This is Sentinel — an autonomous trading agent on Mantle. Most AI agents claim performance. Sentinel proves it: every decision is written on-chain. Its Turing Test is its on-chain track record."*
2. **(0:15–0:40) The swarm + a live decision.** Run `npm run agent`. As a cycle prints, narrate: *"Scout reads real Pyth prices and real Mantle on-chain flow — it just flagged a whale anomaly. Warden checks the risk mandate. Operator executes on Mantle."* Point to the printed **tx hash**.
3. **(0:40–1:05) Verifiable proof.** Click that tx hash → mantlescan. Show the `AgentDecision` event + the swap. Say: *"This isn't a mockup — it's a real Mantle transaction, written by the agent."*
4. **(1:05–1:30) The dashboard.** Show the live decision feed, the NAV/PnL, and the **on-chain risk mandate**. Say: *"The mandate — max per trade, max per asset, a drawdown circuit-breaker — is enforced in the smart contract. Even if the agent's key is stolen, it can't exceed it."*
5. **(1:30–1:50) Identity + autonomy.** Show the ERC-8004 identity card. Say: *"It carries an ERC-8004 agent identity, and it runs itself — sign once, and it trades and proves, 24/7."*
6. **(1:50–2:00) Close.** *"Sentinel — the agent that proves itself, on Mantle."* Show repo + live URL.

---

## 5. X thread for Community Voting

> Post from your account, tag the hackathon. Pin the dashboard + a tx link.

**Tweet 1:** 🛡️ Meet **Sentinel** — an autonomous AI agent on @Mantle_Official that doesn't *claim* it trades well. It **proves it on-chain.** Every decision + realized PnL is written to Mantle by the agent itself. Its Turing Test = its on-chain track record. 🧵 #MantleTuringTest

**Tweet 2:** A swarm of 3: 🔭 **Scout** reads real Pyth prices + real Mantle on-chain flow + whale anomalies → 🛡️ **Warden** enforces an on-chain risk mandate it can never exceed → ⛓️ **Operator** executes on Mantle & logs the decision. Sign once, it runs itself.

**Tweet 3:** The risk mandate (per-trade cap, asset cap, drawdown circuit-breaker) is enforced **in the smart contract** — even a stolen agent key can't blow up the vault. Verifiable safety, not promises.

**Tweet 4:** Carries an **ERC-8004** agent identity. Open-source, verified on mantlescan, 16 passing tests, and a live dashboard that renders the agent thinking in real time. Watch it: `<VERCEL_URL>` · Proof: `<TX_LINK>` · Code: `https://github.com/sifan1231-arch/sentinel-mantle` 🗳️ vote if you like it!

---

## 6. Mainnet mode (optional, for the brave)
Set `NETWORK=mantle` and swap the mock assets/pool for the real Mantle RWA addresses + a DEX router (see [03-RWA-ADDRESSES.md](03-RWA-ADDRESSES.md): USDY `0x5bE2…c5A6`, mETH `0xcDA8…0bb0`, Merchant Moe / Agni routers, Pyth `0xA2aa…5729`). Default stays testnet — fully self-contained, zero real-fund risk.
