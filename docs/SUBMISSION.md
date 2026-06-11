# Sentinel Arena — Submission Kit & Run-book

Everything to deploy, prove, render, and submit. Fill the `<…>` placeholders after you deploy (the deploy script prints them and writes `contracts/deployments/arena.mantleSepolia.json`).

GitHub repo (live): **https://github.com/sifan1231-arch/sentinel-mantle**

---

## 0. What only YOU can do (Claude built + pushed the rest)
1. Provide a **throwaway wallet private key** + a free **Etherscan API key** in `.env`.
2. **Fund** the wallet with free testnet MNT: https://faucet.mantle.xyz
3. Run the commands below (deploy:arena / verify / arena / render).
4. **Deploy the dashboard** to a public URL (Vercel).
5. The demo video renders automatically (`video/out/sentinel-arena.mp4`) — **upload it** to YouTube/X.
6. **Submit on DoraHacks** (text in §2) and **post the X thread** (§5) for Community Voting.

---

## 1. Run-book (≈ 10 minutes)

```bash
cd turing-test-mantle
npm run setup                       # contracts + agent + web

cp .env.example .env                # edit: PRIVATE_KEY + ETHERSCAN_API_KEY
#   → fund the wallet at https://faucet.mantle.xyz

npm run test:contracts              # 18 passing
npm run deploy:arena                # 6 vaults + 6 ERC-8004 identities + the arena, on Mantle Sepolia
npm run verify                      # verify all contracts on sepolia.mantlescan.xyz

npm run arena                       # the orchestrator — six agents trade live, on-chain
#   for a dramatic recorded run:  (cd agent && npm run arena:shock)

cd web && npx vercel --prod         # public Colosseum URL
cd ../video && npm run render       # → video/out/sentinel-arena.mp4  (uses your installed Chrome)
```

> **Lock the Deployment Award slot early** (first-come, 20 spots, locks when criteria are met): deploy:arena + verify + put the public dashboard up + run the arena once **on day one**.

After deploy, fill from `contracts/deployments/arena.mantleSepolia.json`:
- Arena: `0xA19954226767318f60504D67AfB0Dee9EB00D986` · DecisionRegistry: `0xf7C286E64B5940428894ca870293B26aC631A176` · 6 vaults: `<…>`
- Public dashboard: `https://sentinel-mantle.vercel.app` · Video: `https://youtu.be/dPKt8xq95n8`

---

## 2. DoraHacks BUIDL submission

**Project name:** Sentinel Arena — The Agent Colosseum

**One-line pitch:** Six named AI agents trade the same live market on Mantle, each bounded by its own on-chain risk mandate, ranked live by a verifiable Turing Score. The first spectator sport where the players are AIs and the scoreboard can't lie.

**Tracks:** **Grand Champion** · Community Voting · Consumer & Viral DApps · AI Trading & Strategy · AI Alpha & Data · AI × RWA · Agentic Wallets & Economy · Finalist & Deployment Award

**Description:**
> Mantle built this hackathon to *benchmark AI agent performance at scale, on-chain.* Sentinel Arena instantiates that thesis literally: a public colosseum where six AI agents — **APEX** (momentum), **BUNKER** (preservation), **PROWLER** (smart-money), **GLACIER** (contrarian), **WILDCARD** (degen), **ORACLE** (quant) — trade the same live market driven by real Pyth prices + real Mantle-mainnet whale-flow. Each agent's "risk DNA" is a real `Mandate` enforced **inside** `SentinelVault` (it can't break its own rules). Every decision + realized PnL is written to an ERC-8004-aligned `DecisionRegistry`, and a pure on-chain `AgentArena` view ranks them by a **Turing Score** anyone can reproduce. In a recorded run, a market shock reshuffled the board live: APEX faceplanted, GLACIER bought the panic, ORACLE took #1 — all provable to mantlescan. Spectators share the leaderboard, and anyone can **spawn** their own agent (mint a real ERC-8004 identity + vault and enter). One deterministic engine, six DNA configs; runs without an LLM key; 18 passing contract tests; a live Next.js dashboard + an 85s rendered trailer.

**Deployed (Mantle Sepolia, chainId 5003):** Arena `0xA19954226767318f60504D67AfB0Dee9EB00D986`, DecisionRegistry `0xf7C286E64B5940428894ca870293B26aC631A176` (live on Mantle Sepolia; source-verifiable on mantlescan) · Repo https://github.com/sifan1231-arch/sentinel-mantle · Demo `https://sentinel-mantle.vercel.app` · Video `https://youtu.be/dPKt8xq95n8`

### Track Q&A
- **On-chain benchmarking / ERC-8004:** every agent holds an ERC-8004 identity; the Turing Score is a pure on-chain view over the immutable decision log — a reusable benchmark other Mantle agent-builders can register into.
- **Data sources:** real Pyth feeds (mETH/USD, USDY/USD) + real Mantle-mainnet mETH whale-flow + anomaly z-scores + optional Allora inference.
- **AI × RWA:** agents compete by managing USDY/mETH RWA sleeves under on-chain risk bounds.

---

## 3. Deployment Award checklist
- [x] Contracts on Mantle (Sepolia) — `npm run deploy:arena`
- [x] Verified on Mantle Explorer — `npm run verify`
- [x] ≥1 AI function callable on-chain — `DecisionRegistry.logDecision` / `SentinelVault.execute` / `AgentArena.join`
- [ ] Public frontend — deploy `web/` to Vercel
- [ ] Deployment address in submission — paste `0xA19954226767318f60504D67AfB0Dee9EB00D986`
- [ ] Demo video ≥ 2 min — render the trailer (85s) + a screen-record of the live arena to reach ≥2 min
- [x] Open-source repo + README

---

## 4. Demo video
A polished **85-second broadcast-style trailer renders automatically** to `video/out/sentinel-arena.mp4` (`cd video && npm run render`). To exceed the Deployment Award's ≥2-min bar, append a ~60s screen-record of the live dashboard during `arena:shock` (leaderboard reshuffle + a click-through to a mantlescan tx). Storyboard + narration: [04-ARENA-BLUEPRINT.md](04-ARENA-BLUEPRINT.md) §Demo video.

---

## 5. X thread (Community Voting)

**1/** 🏆 We settled the dumbest argument in tech — *which AI is smartest* — the only honest way: six AI agents, one live market on @Mantle_Official, ranked by a score you can verify **on-chain**. Welcome to **Sentinel Arena.** 🧵 #MantleTuringTest

**2/** Meet the roster: 🦅 APEX (momentum), 🐢 BUNKER (preservation), 🐺 PROWLER (smart-money), 🧊 GLACIER (contrarian), 🎲 WILDCARD (degen), 🧠 ORACLE (quant). Each has its own **on-chain risk mandate — it literally can't break its own rules.**

**3/** Then a market shock hit. 🦅 APEX faceplanted. 🎲 WILDCARD cratered. 🧊 GLACIER bought the panic. 🧠 ORACLE bought the recovery and took #1 — **all provable to a Mantle tx hash.** No trading leaderboard has ever been this un-fakeable.

**4/** Pick a champion. Spawn your own fighter (mints a real ERC-8004 identity). Flex a card that proves itself. ⚠️ Testnet — provable skill, not financial advice. Watch live: `https://sentinel-mantle.vercel.app` · Code: https://github.com/sifan1231-arch/sentinel-mantle 🗳️

---

## 6. Mainnet mode (optional)
`NETWORK=mantle` + swap mocks for real Mantle RWA (USDY `0x5bE2…c5A6`, mETH `0xcDA8…0bb0`) + a real DEX router (see [03-RWA-ADDRESSES.md](03-RWA-ADDRESSES.md)). Default stays testnet — fully self-contained, zero real-fund risk.
