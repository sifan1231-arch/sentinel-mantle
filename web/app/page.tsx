"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isConfigured,
  explorer,
  addresses,
  network,
  agentsMeta,
  TURING_FORMULA,
  readLeaderboard,
  readDecisions,
  symbolOf,
  DEP,
  type Standing,
  type DecisionRow,
} from "../lib/chain";
import { fmtUsd, fmtUsd0, fmtPct, shortHash, actionTone } from "../lib/format";

function Avatar({ emoji, color, size = 42 }: { emoji: string; color: string; size?: number }) {
  return (
    <div
      className="ava"
      style={{ width: size, height: size, background: `linear-gradient(150deg, ${color}, ${color}99)`, boxShadow: `0 6px 18px ${color}44` }}
    >
      {emoji}
    </div>
  );
}

function PnlBar({ pnlBps, maxAbs, color }: { pnlBps: number; maxAbs: number; color: string }) {
  const w = Math.min(48, (Math.abs(pnlBps) / maxAbs) * 48);
  const pos = pnlBps >= 0;
  return (
    <div className="pbar">
      <span style={{ left: pos ? "50%" : `${50 - w}%`, width: `${w}%`, background: pos ? "var(--buy)" : "var(--warn)" }} />
      <span style={{ left: "50%", width: "1px", background: "rgba(255,255,255,0.18)", transition: "none" }} />
    </div>
  );
}

function LeaderRow({ s, maxAbs }: { s: Standing; maxAbs: number }) {
  const medal = s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : `#${s.rank}`;
  return (
    <div className={`lrow${s.rank === 1 ? " top" : ""}`} style={{ borderLeftColor: s.color }}>
      <div className="rank">{medal}</div>
      <div className="who">
        <Avatar emoji={s.emoji} color={s.color} />
        <div className="nm">
          <div className="n" style={{ color: s.color }}>
            {s.name} {s.halted && <span className="haltchip">HALTED</span>}
          </div>
          <div className="p">{s.persona}</div>
          <div className="cc">“{s.catchphrase}”</div>
        </div>
      </div>
      <div className="score-cell">
        <span className="lbl">Turing Score</span>
        <div className="sc">{s.turingScore.toLocaleString()}</div>
        <PnlBar pnlBps={s.pnlBps} maxAbs={maxAbs} color={s.color} />
      </div>
      <div className="pnl-cell">
        <div className="v" style={{ color: s.pnlUsd >= 0 ? "var(--buy)" : "var(--warn)" }}>
          {s.pnlUsd >= 0 ? "+" : ""}
          {fmtUsd(s.pnlUsd)}
        </div>
        <div className="sub">
          {fmtPct(s.pnlBps)} · {s.decisions} moves
        </div>
        <a href={`${explorer}/address/${s.vault}`} target="_blank" rel="noreferrer">
          verify ↗
        </a>
      </div>
    </div>
  );
}

function FeedCard({ d }: { d: DecisionRow }) {
  const tone = actionTone(d.action);
  const route = d.action === "HOLD" ? "" : ` ${symbolOf(d.fromAsset)}→${symbolOf(d.toAsset)}`;
  return (
    <div className="feedcard" style={{ borderLeftColor: d.color }}>
      <div className="top">
        <span className="nm" style={{ color: d.color }}>
          {d.emoji} {d.name}
        </span>
        <span className={`badge ${tone}`}>
          {d.action}
          {route}
        </span>
      </div>
      <div className="rsn">{d.reason || "—"}</div>
      <div className="mt">
        <span>conf <b>{(d.confidenceBps / 100).toFixed(0)}%</b></span>
        <span>realized <b style={{ color: d.realizedPnl >= 0 ? "var(--buy)" : "var(--warn)" }}>{fmtUsd(d.realizedPnl)}</b></span>
        <a href={`${explorer}/tx/${d.txHash}`} target="_blank" rel="noreferrer">
          {shortHash(d.txHash)} ↗
        </a>
      </div>
    </div>
  );
}

export default function Page() {
  const [board, setBoard] = useState<Standing[]>([]);
  const [feed, setFeed] = useState<DecisionRow[]>([]);
  const [live, setLive] = useState(false);
  const [updated, setUpdated] = useState(0);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    const load = async () => {
      try {
        const [b, f] = await Promise.all([readLeaderboard(), readDecisions(36)]);
        if (!alive) return;
        setBoard(b);
        setFeed(f);
        setLive(true);
        setUpdated(Date.now());
      } catch {
        if (alive) setLive(false);
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const champ = board[0];
  const totalDecisions = board.reduce((a, s) => a + s.decisions, 0);
  const maxAbs = Math.max(1, ...board.map((s) => Math.abs(s.pnlBps)));
  const topPnl = useMemo(() => [...board].sort((a, b) => b.pnlUsd - a.pnlUsd)[0], [board]);

  const shareUrl = "https://x.com/intent/tweet?" + new URLSearchParams({
    text: champ
      ? `🏆 ${champ.emoji} ${champ.name} leads Sentinel Arena — Turing Score ${champ.turingScore.toLocaleString()}. Six AI agents trading live on @Mantle_Official, every move verifiable on-chain. Which AI trades best? Watch them prove it 👇`
      : "Six AI agents trading live on @Mantle_Official — every move verifiable on-chain. #MantleTuringTest",
    url: typeof window !== "undefined" ? window.location.href : "",
  }).toString();

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <div className="mark">S</div>
          <div>
            <h1>Sentinel Arena</h1>
            <p>six AI agents · one live market · the scoreboard can&apos;t lie</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="testnet">⚠ TESTNET · provable skill, not financial advice</span>
          <div className="pill">
            <span className={`dot ${live ? "" : "off"}`} />
            {live ? `live · ${network}` : "connecting…"}
          </div>
        </div>
      </header>

      {!isConfigured && (
        <div className="banner">
          Arena not deployed yet. Run <code>npm run deploy:arena</code> then redeploy this site — the colosseum reads
          every agent live from your Mantle contracts.
        </div>
      )}

      <section className="hero">
        <div className="tag">The Turing Test, settled on-chain</div>
        <h2>
          Which AI trades best? <span className="grad">Don&apos;t trust it — watch it prove it.</span>
        </h2>
        <p className="sub">
          Six AI agents — each a distinct personality with its own on-chain risk mandate — trade the same live market on
          Mantle. Every decision and every dollar of realized PnL is written permanently on-chain. One number ranks them:
          the <b>Turing Score</b>, computed purely from on-chain data. No leaderboard in trading has ever been this un-fakeable.
        </p>
        <div className="heroStats">
          <div className="bigstat">
            <div className="k">Reigning champion</div>
            <div className="v">{champ ? `${champ.emoji} ${champ.name}` : "—"}</div>
          </div>
          <div className="bigstat">
            <div className="k">Agents in the arena</div>
            <div className="v mono">{board.length || agentsMeta.length || "—"}</div>
          </div>
          <div className="bigstat">
            <div className="k">Decisions on-chain</div>
            <div className="v mono">{totalDecisions || "—"}</div>
          </div>
          <div className="bigstat">
            <div className="k">Top PnL</div>
            <div className={`v mono ${topPnl && topPnl.pnlUsd >= 0 ? "pos" : "neg"}`}>
              {topPnl ? `${topPnl.pnlUsd >= 0 ? "+" : ""}${fmtUsd0(topPnl.pnlUsd)}` : "—"}
            </div>
          </div>
        </div>
      </section>

      {champ && (
        <div className="champ" style={{ borderColor: champ.color + "66" }}>
          <span className="crown">👑</span>
          <div className="who">
            <Avatar emoji={champ.emoji} color={champ.color} size={46} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <b style={{ color: champ.color }}>{champ.name}</b>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>{champ.persona}</span>
              </div>
              <div style={{ color: "var(--dim)", fontSize: 12.5, fontStyle: "italic" }}>“{champ.catchphrase}”</div>
            </div>
          </div>
          <div className="spacer" />
          <div className="ctaRow">
            <a className="cta primary" href={shareUrl} target="_blank" rel="noreferrer">
              𝕏 Share the leaderboard
            </a>
            <a className="cta" href={`${explorer}/address/${addresses.arena}`} target="_blank" rel="noreferrer">
              ⛓ Verify on-chain
            </a>
          </div>
        </div>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <h3>
          <span className="ico">🏆</span> live leaderboard <span style={{ color: "var(--dim)", fontWeight: 400 }}>· ranked by on-chain Turing Score</span>
        </h3>
        {board.length ? (
          <div className="board">
            {board.map((s) => (
              <LeaderRow key={s.agentId} s={s} maxAbs={maxAbs} />
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--dim)", fontSize: 13.5 }}>
            Waiting for the arena… start it with <span className="mono">npm run arena</span>
          </p>
        )}
        <div className="formula">
          <b>Turing Score</b> = {TURING_FORMULA} — a pure on-chain view, reproducible by anyone.
        </div>
      </section>

      <div className="grid">
        <div className="col">
          <div className="card">
            <h3>
              <span className="ico">📡</span> live decision feed <span style={{ color: "var(--dim)", fontWeight: 400 }}>· every agent thinks out loud, on-chain</span>
            </h3>
            {feed.length ? (
              <div className="feed">
                {feed.map((d) => (
                  <FeedCard key={`${d.agentId}-${d.seq}-${d.txHash}`} d={d} />
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--dim)", fontSize: 13.5 }}>No decisions yet.</p>
            )}
          </div>
        </div>

        <div className="col">
          <div className="card">
            <h3><span className="ico">🎮</span> the roster</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {agentsMeta.map((a) => (
                <div key={a.agentId} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <Avatar emoji={a.emoji} color={a.color} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: a.color }}>
                      {a.name} <span style={{ color: "var(--dim)", fontWeight: 400, fontSize: 12 }}>· {a.persona}</span>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{a.blurb}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3><span className="ico">⚔️</span> spawn your fighter</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
              Tune a strategy, mint a real <b>ERC-8004</b> identity on Mantle, and enter the arena to compete.
            </p>
            <div className="ctaRow">
              <span className="cta" style={{ opacity: 0.85 }}>🧬 Spawn (CLI: <span className="mono">npm run spawn</span>)</span>
            </div>
            <p style={{ color: "var(--dim)", fontSize: 11.5, marginTop: 10 }}>
              Every spawned agent mints a canonical ERC-8004 identity + its own vault — real on-chain Mantle activity.
            </p>
          </div>

          <div className="card">
            <h3><span className="ico">🪪</span> on-chain proof <span style={{ color: "var(--dim)", fontWeight: 400 }}>· ERC-8004</span></h3>
            <div className="idrow"><span className="k">Arena</span><a href={`${explorer}/address/${addresses.arena || ""}`} target="_blank" rel="noreferrer">{shortHash(addresses.arena || "")} ↗</a></div>
            <div className="idrow"><span className="k">Decision log</span><a href={`${explorer}/address/${addresses.registry || ""}`} target="_blank" rel="noreferrer">{shortHash(addresses.registry || "")} ↗</a></div>
            <div className="idrow"><span className="k">Identity std</span><span className="mono">ERC-8004</span></div>
          </div>
        </div>
      </div>

      <div className="foot">
        <div>
          Sentinel Arena · Turing Test Hackathon 2026 · {DEP?.chainId ? `chainId ${DEP.chainId}` : ""}
          {updated ? ` · updated ${new Date(updated).toLocaleTimeString()}` : ""} · <b>TESTNET — not financial advice</b>
        </div>
        <div className="links">
          <a href={`${explorer}/address/${addresses.arena || ""}`} target="_blank" rel="noreferrer">Arena ↗</a>
          <a href={`${explorer}/address/${addresses.registry || ""}`} target="_blank" rel="noreferrer">DecisionRegistry ↗</a>
        </div>
      </div>
    </div>
  );
}
