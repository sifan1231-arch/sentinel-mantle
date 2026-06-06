# Sentinel Arena — The Agent Colosseum (locked blueprint)

> The viral/grand-prize pivot. Decided via an adversarial concept panel (3 concepts scored → synthesized). Builds on the tested Sentinel core (16 passing tests) — one deterministic engine, six DNA configs, all on-chain-bounded.

## Hook
**"Which AI trades best? Don't trust it — watch it prove it."**
A live, unriggable colosseum of six AI agents, ranked by a **Turing Score** anyone can verify on-chain. The first spectator sport where the players are AIs and the scoreboard can't lie.

## The six personas (genuine, contract-enforced divergence)
| Agent | Vibe | Strategy | On-chain mandate (real `Mandate` struct) |
|---|---|---|---|
| 🦅 **APEX** | Momentum hunter | press winners, chase whale inflows | 45%/trade · 90% cap · halt 35% |
| 🐢 **BUNKER** | Capital preserver | hug USDY yield + buffer, flee shocks | 20%/trade · 60% cap · halt 12% |
| 🐺 **PROWLER** | Smart-money tracker | weight Mantle whale-flow over price | 35%/trade · 80% cap · halt 25% |
| 🧊 **GLACIER** | Contrarian | buy the shock, fade the crowd | 30%/trade · 75% cap · halt 20% |
| 🎲 **WILDCARD** | Degen | biggest positions, boom-or-bust | 50%/trade · 90% cap · halt 40% |
| 🧠 **ORACLE** | Quant | balanced blend + optional Allora inference | 30%/trade · 70% cap · halt 18% |

Roster + exact params live in [`personas.json`](../personas.json). The "risk DNA" IS the on-chain mandate — an agent literally cannot break its own rules.

## Turing Score (pure on-chain view, formula on screen)
`AgentArena.turingScore` = `10000 + return(bps) + activity bonus(capped) − drawdown-from-HWM penalty − halt penalty`, computed entirely from on-chain values (`SentinelVault` NAV/HWM/halted + `DecisionRegistry` cumRealizedPnl/decisionCount). Reproducible by anyone; no hidden weighting.

## Viral mechanics
1. **Live Turing-Score leaderboard** (hero) — six character cards ranked live, PnL bars, 🔥 streaks, current action, sparkline, rank-swap animation; every rank links to its on-chain decision log → verify on mantlescan. The single shareable screenshot.
2. **One-tap share cards** — `/api/card` renders a 1200×630 PNG (champion, rank, Turing Score, streak, **VERIFIED ON MANTLE ✓**, mantlescan link, **TESTNET** watermark) + pre-filled X intent URL.
3. **Spawn-your-own fighter** — name + 4 sliders → mint a real ERC-8004 identity + deploy a vault → it enters the arena.
4. **Back-a-champion** (optional, feature-flagged) — pick who climbs next → BackerScore (reputation only, testnet, no real value).
5. **Champion tribes + rivalry cards**, **X campaign kit** (daily Arena Recap).

## Demo video (Remotion, ~85s, esports-broadcast style)
Shock at 0:38 reshuffles the board live. Scenes:
1. `0:00` Six avatars ignite → roster lineup. *"Everyone's arguing about which AI is smartest. We settled it the only honest way."*
2. `0:06` Six named cards + a shared Pyth/Mantle-flow signal bus. *"Six AI agents. Same live market. Six personalities."*
3. `0:16` APEX vs BUNKER speech bubbles; each fires one tx → on-chain log. *"Each thinks out loud, makes one real trade, writes it permanently on-chain."*
4. `0:26` Mandate "cages" + the live leaderboard with the Turing Score formula. *"It can't cheat its own rules. One number ranks them — the Turing Score, on-chain."*
5. `0:38` **BEAT DROP — MARKET SHOCK.** WILDCARD craters, APEX hits its breaker, GLACIER buys the panic, BUNKER survives → takes #1. Board reshuffles.
6. `0:50` Click a rank → mantlescan tx. *"Every rank links to the exact transaction. No trading leaderboard has ever been this un-fakeable."*
7. `0:60` `/spawn` wizard: name + 4 sliders → mint identity → enters arena.
8. `0:70` Share card renders + X post mockup. *"Back a champion, climb the scout board, flex a card that proves itself."*
9. `0:78` Full leaderboard, tribe colors, logo lockup. *"Sentinel Arena. The scoreboard can't lie."*

## Honesty guardrails (non-negotiable)
- **TESTNET** watermark on every card/header/video; never imply real profit. "Provable skill, not returns."
- All PnL is **real realized PnL** read on-chain from real Pyth moves on labelled testnet instruments — zero fabricated numbers.
- Turing Score is a **pure on-chain view** with the formula displayed.
- Agents are allowed to **lose on camera** (WILDCARD/APEX faceplant in the shock) — nothing is hard-coded to win.
- No token / launchpad / coin. Backing = reputation-only, feature-flagged.
- Mainnet on-ramp is a truthful one-flag path (real USDY/mETH + DEX), never demoed with real funds.

## Build sequence (each step ships an independent win)
1. **Contracts**: `AgentArena` (leaderboard + permissionless join) + `deploy-arena.ts` (6 vaults + 6 ERC-8004 ids + per-persona mandates + arena). Floor + technical depth.
2. **Orchestrator**: one engine, six DNA configs, sequential per-cycle runner. The arena is alive.
3. **Colosseum leaderboard UI** + reasoning feed. The hero screenshot → Community Voting.
4. **Share card route** + X intent. Virality.
5. **Spawn wizard** (mint ERC-8004 + deploy from sliders). Ecosystem.
6. **Remotion video** + README/submission/X kit.

## Cut list (scope discipline)
No agent-to-agent commerce, no human-vs-AI duel mode, no token/launchpad, no real-money demo, no new AMM/oracle, ≤6 personas, no bespoke per-persona engine, no off-chain Turing Score weighting.
