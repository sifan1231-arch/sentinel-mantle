# The Turing Test Hackathon 2026 — Strategy & Intel Brief

> Source of truth gathered from the official DoraHacks page (Details / Tracks / Requirements & Criteria / Q&A) on 2026-06-06.
> This is our working brief. A second doc (`01-TECH-GROUND-TRUTH.md`) will capture verified Mantle/ERC-8004/RWA technical config after the research workflow returns.

## 0. 执行摘要 (中文 TL;DR)

- 奖池 **$100,000**(Phase 2 "AI Awakening"),截止 **2026-06-15 23:59**,还剩 ~9 天。你已注册为 Hacker,虚拟赛。
- **策略 = 一个项目同时吃多个奖**:
  - **保底**:`Finalist & Deployment Award` $1,000 —— **无评委打分**、纯客观门槛、先到先得 20 名、**达标即锁定**。越早 ship 越稳。
  - **主攻**:某个 **Track First Prize $8,500**(6 个轨道各一个一等奖)。
  - **叠加**:Best UI/UX $3,000、Community Voting $8,500、Grand Champion $9,000。
- **provisional 主攻方向**:**一个部署在 Mantle 上的自主 AI agent**,围绕 **AI x RWA**(收益/风险管理,USDY/mETH)+ **Alpha/Data 智能**,**把每个决策与推理写到链上(可验证)**,带 ERC-8004 风格 agent 身份 + 漂亮的实时 dashboard。最终轨道在研究后锁定(对比 AI x RWA vs AI Alpha & Data)。
- **必须避开的"门控依赖"**:RealClaw(需邀请码)、Bybit API(需交易所密钥)、Byreal CLI(Solana、成熟度未知)。主攻轨道不绑这些,才能保证"完美可直接提交的自包含代码"。
- **Claude 能做**:全部智能合约、agent 代码、前端、部署/验证脚本、README、pitch、2 分钟 demo 脚本。
- **需要你做**(turnkey 化):用你的钱包 + 免费测试网 faucet 部署、在 Explorer 验证合约、录 2 分钟 demo 视频、提交 DoraHacks、(可选)X 发帖拉社区投票、(可选)注册官方 ERC-8004 NFT。

---

## 1. Hard Facts (from the official page)

| Item | Value |
|---|---|
| Hackathon | The Turing Test Hackathon 2026 — Phase 2 "AI Awakening" |
| Host / co-hosts | Mantle × Bybit × Byreal × Blockchain for Good Alliance; support DoraHacks, HackQuest |
| Total prize | $100,000 USD (Phase 2). (Phase 1 "ClawHack" was a separate $20k, already finished.) |
| Submission deadline | **2026-06-15 23:59** (~9 days from 2026-06-06) |
| Format | Virtual |
| Status | User is **registered as Hacker**; public BUIDLs hidden until judging ("No BUIDLs" shown). |
| Tags | Blockchain, AI, Trading, Claw |
| Ecosystem | Mantle Network, Animoca Brands, Z.AI, Nansen, Tencent Cloud |

### Judging panel (Details page)
Allora Network, Blockchain for Good Alliance (BGA), **Nansen**, Z.ai, Four Pillars, **Animoca Brands**, DoraHacks, Elfa AI, **Virtuals Protocol**, **Hashed**, Caladan, + a University of Hong Kong academic.
→ Tastes: autonomous AI agents (Virtuals), on-chain analytics (Nansen), decentralized inference (Allora), VC/institutional (Hashed/Caladan/Animoca).

### Three official "defining features" (narrative the judges want to reward)
1. **On-chain benchmarking of AI** — every agent decision & outcome recorded permanently on Mantle.
2. **ERC-8004 agent identity** — every agent gets a unique identity NFT via ERC-8004 (issued by Mantle).
3. **Radical transparency** — agents observed executing/adapting/self-correcting in real time.

> Emily Bao (Bybit/Byreal/Mantle): *"OpenClaw gave AI agents hands. Mantle gave them a home... not just humans trading assets, but autonomous agents creating verifiable, on-chain value."*
> → **The soul of this hackathon = autonomous agents that ACT and create VERIFIABLE ON-CHAIN value.** Not a read-only dashboard. An agent with hands + an on-chain track record.

---

## 2. Prize Pool Breakdown (decisive)

| Prize | Amount | Slots | Judge-scored? | Our play |
|---|---|---|---|---|
| Grand Champion | $9,000 | 1 | Yes (hardest) | Stretch/ceiling |
| **Track First Prize** | **$51,000** | **6 × $8,500** | Yes (best in track) | **PRIMARY target** |
| Community Voting | $17,000 | 2 × $8,500 | X-platform votes | Bonus (needs user's X campaign) |
| Best UI/UX | $3,000 | 1 | Yes | Bonus (stunning frontend) |
| **Finalist & Deployment** | **$20,000** | **20 × $1,000** | **NO — objective checklist, first-come** | **FLOOR — lock ASAP** |

The 6 tracks (each first prize $8,500):
1. **AI Trading & Strategy** (BGA) — AI quant bots, macro smart contracts; Python/Solidity templates, Bybit API.
2. **AI Alpha & Data** — smart-money tracking + on-chain anomaly detection (TG/Discord bots, dashboards). *Nansen is a judge — their home turf.*
3. **AI x RWA** — dynamic yield + automated risk for USDY/mETH on Mantle RWA infra. *Mantle's core thesis.*
4. **Consumer & Viral DApps** — gamified trading UIs, shareable apps. *Community-voting friendly.*
5. **AI DevTools** — gas optimization, Mantle-specific audit assistants. *Least crowded, very Claude-buildable.*
6. **Agentic Wallets & Economy** (BYREAL) — agentic wallet economies via Byreal Skills CLI. *Gated tooling risk.*

---

## 3. Judging Criteria (Requirements & Criteria page)

### Grand Champion (weights)
- Technical Depth 30% — AI × on-chain integration, architecture completeness, code quality
- Innovation 25% — originality, new AI × Web3 paradigm
- Mantle Ecosystem Contribution 25% — substantive Mantle use + long-term ecosystem value
- Product Completeness 20% — runnable demo, UX, scalability
- Requirements: deployed on Mantle; open-source repo + runnable demo + pitch; nominated from ≥1 track.

### Track scoring pattern (detailed for 3 tracks; others follow same shape)
- **Alpha & Data**: General 60% (data quality / AI depth / completeness / sustainability) + Track-Specific 40% (Insight Value or Strategy Alpha = complexity + verifiability via backtest/live/on-chain records).
- **AI x RWA**: General 60% (AI×RWA depth / completeness / Mantle integration / compliance awareness) + 40% (Infra: tokenization feasibility; App: real-world validity = clear asset + target users + complete UX).
- **Agentic Economy**: General 70% (Byreal integration depth / agent autonomy / completeness / sustainability) + 30%.

### Best UI/UX
Visual 30% / Interaction & Flow 30% / AI Interaction Design 25% / Accessibility 15%. Needs runnable frontend + demo video or public link.

### Finalist & Deployment Award — THE FLOOR (memorize this checklist)
- ✅ Smart contract deployed on Mantle **Mainnet OR Testnet**
- ✅ Contract **verified on Mantle Explorer**
- ✅ **≥1 AI-powered function callable on-chain** (agent trigger, inference written on-chain, automated execution)
- ✅ Frontend demo **publicly accessible** (not localhost)
- ✅ Deployment address **in the DoraHacks submission**
- ✅ Demo video **≥ 2 min** walking the core use case
- ✅ Open-source **GitHub repo with README** (setup, architecture, deployed contract address)
- "No judge scoring — meet ALL criteria and the award is yours." First-come, 20 spots.

---

## 4. Q&A clarifications (organizer "Assistant/AIGC" answers — intent signals, not gospel)

1. **Deployment Award slot locks when a project objectively meets all criteria (rolling), not at final judging.** → SHIP EARLY to lock a slot. (Exact remaining slots unknown.)
2. **An AI agent recording its decisions/inference on-chain (logging each automated action) DOES satisfy "AI-powered function callable on-chain."** → Confirms our core architecture (on-chain DecisionLogged registry).
3. **AI Alpha & Data**: read-only AI tools on live Mantle data are eligible; **a web dashboard is acceptable (TG/Discord bot NOT required)**; **testnet deployment acceptable** for optional contract.
4. A project can win/qualify for a track AND the Deployment Award simultaneously (deploy decision contract on Mantle even if execution runs elsewhere). Multi-eligibility supported.
5. **Official ERC-8004 NFT is issued by Mantle** (separate registration); our own ERC-8004-inspired contract is "helpful for transparency" but the *official* agent identity for the Agentic track comes from Mantle. → Build our own ERC-8004-aligned identity/decision log AND have user register for the official NFT where applicable.
6. **Access gates (avoid as hard deps):** RealClaw needs an invitation code (no public path); Byreal CLI is Solana; Bybit API needs an exchange account/keys.

---

## 5. Strategy — One Project, Many Prizes

**Build a single, exceptional, self-contained autonomous AI agent on Mantle** that is simultaneously eligible for:
- Finalist & Deployment Award ($1,000 — near-guaranteed floor if we ship clean & early)
- One Track First Prize ($8,500 — primary)
- Best UI/UX ($3,000 — via a stunning live agent dashboard)
- Community Voting ($8,500 — shareable narrative + user X campaign)
- Grand Champion ($9,000 — stretch; maximized by Mantle-core RWA + on-chain verifiable agent + ERC-8004)

### Provisional product concept (to be finalized after research)
**An autonomous on-chain AI agent that manages a real-world-asset yield/risk portfolio on Mantle**, where:
- It ingests live Mantle on-chain + market/risk data (the Alpha/Data intelligence layer).
- It autonomously decides allocations / rebalances / hedges across Mantle RWA & yield assets (USDY, mETH, …) — or clearly-labelled mock RWA on testnet.
- **Every decision + the AI rationale + the inference is written on-chain** (verifiable benchmark → satisfies Deployment Award's hardest checkbox + matches official feature #1).
- It carries an **ERC-8004-aligned agent identity + reputation log** (matches official feature #2).
- A **polished live dashboard** shows the agent thinking, deciding, self-correcting, with one-click on-chain proof links (matches feature #3 + UI/UX award).

**Primary track nomination:** AI x RWA (Mantle-core, less crowded, institutional judges) — but defensible in AI Alpha & Data (Nansen) and the Agentic narrative. Final track decision pending research (winnability + asset availability).

### Why this wins
- Hits the hackathon's SOUL (autonomous agent creating verifiable on-chain value) head-on.
- Maxes Grand Champion's Mantle Contribution (25%) via RWA + on-chain data usage.
- Self-contained: no RealClaw/Bybit/Byreal hard dependency → "perfect submittable code" is achievable.
- One build → 5 prizes eligible.

---

## 6. Risks & how we neutralize them

| Risk | Mitigation |
|---|---|
| Wrong Mantle chainId/RPC/explorer breaks deploy | Research workflow verifies all config adversarially before we write code. |
| Testnet lacks real USDY/mETH/oracles | Deploy clearly-labelled mock RWA tokens + mock/push oracle (organizer: testnet OK). Read real mainnet addresses where possible. |
| "Just a dashboard" reads as shallow | Make it a real AGENT with hands: autonomous loop + on-chain execution + verifiable decision log, not read-only. |
| Deployment-award slots fill up | Ship the deployable core EARLY (front-load contract + minimal frontend + video) to lock the slot, then polish. |
| Community voting depends on reach | Provide a ready-to-post X campaign kit; treat as bonus, not core. |
| Official ERC-8004 NFT needs Mantle registration | Build our own ERC-8004-aligned identity log + instruct user to register for official NFT. |

---

## 7. Manual steps the user must do (we make them turnkey)
1. Fund a Mantle Sepolia wallet from the faucet (free) — or a small amount of mainnet MNT if going mainnet.
2. Run our one-command deploy + verify scripts (we provide exact commands + .env template).
3. Deploy the frontend to a public URL (Vercel one-click — we provide config).
4. Record a ≥2-min demo video (we provide a shot-by-shot script).
5. Submit on DoraHacks with repo + deployed address + demo link + pitch (we provide the pitch + submission text).
6. (Optional) Register the agent for the official Mantle ERC-8004 NFT.
7. (Optional) Post the X campaign kit for Community Voting.

---

## 8. Open research questions (handed to the recon workflow)
- Exact Mantle Sepolia + mainnet chain config, explorer verification method, faucet, Hardhat/Foundry config, gas gotchas.
- Real Mantle RWA asset addresses/decimals (USDY, mETH, …) + oracle availability on testnet.
- ERC-8004 actual interfaces + whether Mantle has an official registry address + how to register.
- Byreal/RealClaw/Openclaw access reality + judge-alignment.
- Past winning-project "cores" + winning patterns for this judge panel.
