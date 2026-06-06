import React from "react";
import { AbsoluteFill, Series, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Bg, Watermark, Avatar, Badge, mono, appear, fade } from "./ui";
import { ROSTER, PRE_SHOCK_KEYS, POST_SHOCK_KEYS, byKey, ACCENT, ACCENT2, INFO, WARN, MONO } from "./theme";

const Caption: React.FC<{ children: React.ReactNode; frame: number; at?: number }> = ({ children, frame, at = 6 }) => (
  <div style={{ position: "absolute", bottom: 110, left: 0, right: 0, textAlign: "center", ...appear(frame, at, at + 14) }}>
    <span style={{ fontSize: 30, color: "#aab4c5", background: "rgba(8,11,16,0.6)", padding: "10px 24px", borderRadius: 14, fontWeight: 600 }}>
      {children}
    </span>
  </div>
);

// ---------- Scene 1: Intro ----------
const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Bg glow={WARN}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 }}>
        <div style={{ display: "flex", gap: 26 }}>
          {ROSTER.map((p, i) => {
            const s = spring({ frame: f - 8 - i * 7, fps, config: { damping: 12 } });
            return (
              <div key={p.key} style={{ transform: `scale(${s})`, opacity: s }}>
                <Avatar emoji={p.emoji} color={p.color} size={108} />
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center", ...appear(f, 70, 92) }}>
          <div style={{ fontSize: 66, fontWeight: 800, letterSpacing: -1 }}>WHICH AI TRADES BEST?</div>
          <div style={{ fontSize: 34, color: ACCENT, marginTop: 10, fontWeight: 700 }}>Don&apos;t trust it. Watch it prove it.</div>
        </div>
      </AbsoluteFill>
      <Caption frame={f} at={110}>Everyone&apos;s arguing about which AI is smartest. We settled it the only honest way.</Caption>
      <Watermark />
    </Bg>
  );
};

// ---------- Scene 2: Roster + signal bus ----------
const Roster: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Bg glow={INFO}>
      <AbsoluteFill style={{ padding: "90px 110px", flexDirection: "column" }}>
        <div style={{ fontSize: 30, color: ACCENT2, letterSpacing: 2, fontWeight: 800, ...appear(f, 0, 14) }}>THE ROSTER</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 26, marginTop: 36 }}>
          {ROSTER.map((p, i) => (
            <div
              key={p.key}
              style={{
                display: "flex",
                gap: 18,
                alignItems: "center",
                padding: 22,
                borderRadius: 18,
                background: "rgba(18,24,34,0.7)",
                border: `1px solid ${p.color}55`,
                borderLeft: `4px solid ${p.color}`,
                ...appear(f, 16 + i * 8, 36 + i * 8),
              }}
            >
              <Avatar emoji={p.emoji} color={p.color} size={74} />
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, color: p.color }}>{p.name}</div>
                <div style={{ fontSize: 20, color: "#8b97ab" }}>{p.role}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 44, display: "flex", justifyContent: "center", gap: 20, ...appear(f, 80, 100) }}>
          <Badge color={INFO}>📡 live Pyth prices</Badge>
          <Badge color={ACCENT}>⛓ real Mantle whale-flow</Badge>
          <Badge color={"#a78bfa"}>🧠 same signal bus → six minds</Badge>
        </div>
      </AbsoluteFill>
      <Caption frame={f} at={120}>Six AI agents. One live market. Six totally different personalities.</Caption>
      <Watermark />
    </Bg>
  );
};

// ---------- Scene 3: think out loud + on-chain ----------
const Bubble: React.FC<{ p: any; frame: number; at: number; align: "left" | "right" }> = ({ p, frame, at, align }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: align === "left" ? "flex-start" : "flex-end", gap: 14, ...appear(frame, at, at + 16) }}>
    <Avatar emoji={p.emoji} color={p.color} size={90} />
    <div style={{ maxWidth: 560, padding: "20px 26px", borderRadius: 20, background: `${p.color}1a`, border: `1px solid ${p.color}66`, fontSize: 30, fontWeight: 600 }}>
      <span style={{ color: p.color, fontWeight: 800 }}>{p.name}:</span> {p.line}
    </div>
  </div>
);
const ThinkOutLoud: React.FC = () => {
  const f = useCurrentFrame();
  const apex = { ...byKey("apex"), line: "Trend's intact — pressing mETH to the cap." };
  const bunker = { ...byKey("bunker"), line: "Regime's shaky — yield sleeve, I sleep fine." };
  return (
    <Bg>
      <AbsoluteFill style={{ padding: "100px 120px", justifyContent: "center", gap: 50 }}>
        <Bubble p={apex} frame={f} at={6} align="left" />
        <Bubble p={bunker} frame={f} at={40} align="right" />
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 14, ...appear(f, 80, 96) }}>
          {["0x7f3a…", "0x9b21…", "0xe6c4…"].map((h, i) => (
            <span key={i} style={mono({ fontSize: 26, padding: "10px 18px", borderRadius: 10, background: "rgba(52,211,153,0.12)", color: ACCENT, border: "1px solid rgba(52,211,153,0.3)" })}>
              {h} ✓
            </span>
          ))}
        </div>
      </AbsoluteFill>
      <Caption frame={f} at={108}>Each one thinks out loud, makes one real trade, and writes it permanently on-chain.</Caption>
      <Watermark />
    </Bg>
  );
};

// ---------- Leaderboard (shared) ----------
const ROW_H = 118;
const LeaderRow: React.FC<{ p: any; y: number; rank: number; opacity?: number; maxAbs: number }> = ({ p, y, rank, opacity = 1, maxAbs }) => {
  const w = Math.min(46, (Math.abs(p.pnlPct) / maxAbs) * 46);
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
  const pos = p.pnl >= 0;
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        height: ROW_H - 14,
        display: "grid",
        gridTemplateColumns: "70px 1fr 240px 230px",
        alignItems: "center",
        gap: 22,
        padding: "0 30px",
        borderRadius: 16,
        background: rank === 1 ? "rgba(255,255,255,0.05)" : "rgba(18,24,34,0.72)",
        border: "1px solid rgba(120,140,170,0.14)",
        borderLeft: `4px solid ${p.color}`,
        opacity,
      }}
    >
      <div style={{ fontSize: 38, fontWeight: 800, textAlign: "center" }}>{medal}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Avatar emoji={p.emoji} color={p.color} size={62} glow={0} />
        <div>
          <div style={{ fontSize: 32, fontWeight: 800, color: p.color }}>{p.name}</div>
          <div style={{ fontSize: 19, color: "#8b97ab" }}>{p.role}</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 16, color: "#5e6b80", letterSpacing: 0.6 }}>TURING SCORE</div>
        <div style={mono({ fontSize: 34, fontWeight: 800 })}>{p.score.toLocaleString()}</div>
        <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.06)", marginTop: 6, position: "relative" }}>
          <span style={{ position: "absolute", top: 0, bottom: 0, left: pos ? "50%" : `${50 - w}%`, width: `${w}%`, borderRadius: 6, background: pos ? ACCENT : WARN }} />
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={mono({ fontSize: 30, fontWeight: 800, color: pos ? ACCENT : WARN })}>{pos ? "+" : ""}${p.pnl.toFixed(2)}</div>
        <div style={{ fontSize: 18, color: "#5e6b80" }}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%</div>
      </div>
    </div>
  );
};

// ---------- Scene 4: mandate + score formula ----------
const MandateScore: React.FC = () => {
  const f = useCurrentFrame();
  const order = PRE_SHOCK_KEYS;
  const maxAbs = 2;
  return (
    <Bg glow={ACCENT2}>
      <AbsoluteFill style={{ padding: "70px 110px", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", ...appear(f, 0, 14) }}>
          <Badge color={WARN}>🛡 maxDrawdown enforced IN the contract</Badge>
          <Badge color={INFO}>an agent can&apos;t cheat its own rules</Badge>
        </div>
        <div style={{ position: "relative", height: ROW_H * 6, marginTop: 36 }}>
          {order.map((k, i) => {
            const p = byKey(k);
            // early calm standings (small spread)
            const calm = { ...p, score: 10000 + (3 - i) * 8, pnl: (3 - i) * 2, pnlPct: (3 - i) * 0.02 };
            return <LeaderRow key={k} p={calm} y={i * ROW_H} rank={i + 1} opacity={interpolate(f, [10 + i * 5, 26 + i * 5], [0, 1], { extrapolateRight: "clamp" })} maxAbs={maxAbs} />;
          })}
        </div>
      </AbsoluteFill>
      <Caption frame={f} at={120}>One number ranks them all — the Turing Score, computed only from on-chain data.</Caption>
      <Watermark />
    </Bg>
  );
};

// ---------- Scene 5: SHOCK + reshuffle ----------
const Shock: React.FC = () => {
  const f = useCurrentFrame();
  const flash = interpolate(f, [0, 6, 22, 34], [0, 0.5, 0.5, 0], { extrapolateRight: "clamp" });
  const slamW = interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  // rows animate from PRE order to POST order between frames 30 and 80
  const t = interpolate(f, [30, 85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const maxAbs = 4;
  return (
    <Bg glow={WARN}>
      <AbsoluteFill style={{ background: `rgba(248,113,113,${flash})` }} />
      <AbsoluteFill style={{ padding: "70px 110px", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "center", ...appear(f, 2, 14) }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: WARN, letterSpacing: 2, transform: `scaleX(${slamW})` }}>⚡ MARKET SHOCK · mETH −9%</div>
        </div>
        <div style={{ position: "relative", height: ROW_H * 6, marginTop: 30 }}>
          {ROSTER.map((p) => {
            const preIdx = PRE_SHOCK_KEYS.indexOf(p.key);
            const postIdx = POST_SHOCK_KEYS.indexOf(p.key);
            const y = interpolate(t, [0, 1], [preIdx * ROW_H, postIdx * ROW_H]);
            const rank = Math.round(interpolate(t, [0, 1], [preIdx + 1, postIdx + 1]));
            // pnl morph from calm to final
            const calmPnl = (3 - preIdx) * 2;
            const pnl = interpolate(t, [0, 1], [calmPnl, p.pnl]);
            const pnlPct = interpolate(t, [0, 1], [(3 - preIdx) * 0.02, p.pnlPct]);
            const score = Math.round(interpolate(t, [0, 1], [10000 + (3 - preIdx) * 8, p.score]));
            return <LeaderRow key={p.key} p={{ ...p, pnl, pnlPct, score }} y={y} rank={rank} maxAbs={maxAbs} />;
          })}
        </div>
      </AbsoluteFill>
      <Caption frame={f} at={92}>A real shock hits. APEX faceplants. GLACIER buys the panic. The disciplined survive.</Caption>
      <Watermark />
    </Bg>
  );
};

// ---------- Scene 6: verify ----------
const Verify: React.FC = () => {
  const f = useCurrentFrame();
  const check = spring({ frame: f - 60, fps: 30, config: { damping: 11 } });
  return (
    <Bg glow={ACCENT}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
        <div style={{ ...appear(f, 4, 20) }}>
          <LeaderRowStatic p={byKey("oracle")} rank={1} />
        </div>
        <div style={{ fontSize: 30, color: "#8b97ab", ...appear(f, 24, 40) }}>click any rank →</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "22px 34px", borderRadius: 16, background: "rgba(18,24,34,0.85)", border: "1px solid rgba(120,140,170,0.2)", ...appear(f, 40, 56) }}>
          <span style={mono({ fontSize: 28, color: ACCENT2 })}>sepolia.mantlescan.xyz/tx/0x6567…f50</span>
          <span style={{ fontSize: 30, transform: `scale(${check})`, color: ACCENT }}>✓ VERIFIED ON MANTLE</span>
        </div>
      </AbsoluteFill>
      <Caption frame={f} at={108}>Every rank change links to the exact transaction. No trading leaderboard has been this un-fakeable.</Caption>
      <Watermark />
    </Bg>
  );
};
const LeaderRowStatic: React.FC<{ p: any; rank: number }> = ({ p, rank }) => (
  <div style={{ position: "relative", width: 1100, height: ROW_H - 14 }}>
    <LeaderRow p={p} y={0} rank={rank} maxAbs={1} />
  </div>
);

// ---------- Scene 7: spawn ----------
const Slider: React.FC<{ label: string; v: number; color: string; frame: number; at: number }> = ({ label, v, color, frame, at }) => {
  const fill = interpolate(frame, [at, at + 20], [0, v], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ ...appear(frame, at, at + 12) }}>
      <div style={{ fontSize: 24, color: "#aab4c5", marginBottom: 8 }}>{label}</div>
      <div style={{ height: 14, width: 460, borderRadius: 8, background: "rgba(255,255,255,0.08)", position: "relative" }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill}%`, borderRadius: 8, background: color }} />
        <span style={{ position: "absolute", left: `${fill}%`, top: -5, width: 24, height: 24, borderRadius: 99, background: "#fff", boxShadow: `0 0 12px ${color}`, transform: "translateX(-12px)" }} />
      </div>
    </div>
  );
};
const Spawn: React.FC = () => {
  const f = useCurrentFrame();
  const mint = spring({ frame: f - 130, fps: 30, config: { damping: 12 } });
  return (
    <Bg glow="#a78bfa">
      <AbsoluteFill style={{ padding: "90px 130px", flexDirection: "column", gap: 30 }}>
        <div style={{ fontSize: 44, fontWeight: 800, ...appear(f, 0, 14) }}>⚔️ Spawn your own fighter</div>
        <div style={{ display: "flex", gap: 70, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <Slider label="Risk appetite" v={78} color="#ff5cf0" frame={f} at={20} />
            <Slider label="Momentum vs reversion" v={62} color={ACCENT} frame={f} at={34} />
            <Slider label="Whale-follow" v={48} color="#a06bff" frame={f} at={48} />
            <Slider label="Yield-greed" v={30} color={INFO} frame={f} at={62} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, ...appear(f, 90, 110) }}>
            <Avatar emoji="✨" color="#a78bfa" size={120} />
            <div style={{ fontSize: 38, fontWeight: 800 }}>NOVA</div>
            <div style={{ transform: `scale(${mint})`, opacity: mint }}>
              <Badge color="#a78bfa">ERC-8004 identity minted</Badge>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Caption frame={f} at={150}>Spawn your own — it mints a real on-chain identity under your wallet and enters the arena.</Caption>
      <Watermark />
    </Bg>
  );
};

// ---------- Scene 8: share card ----------
const Share: React.FC = () => {
  const f = useCurrentFrame();
  const pop = spring({ frame: f - 10, fps: 30, config: { damping: 13 } });
  const o = byKey("oracle");
  return (
    <Bg glow={ACCENT}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${0.6 + pop * 0.4})`, opacity: pop, width: 980, padding: 44, borderRadius: 28, background: "linear-gradient(150deg, rgba(20,28,40,0.95), rgba(8,11,16,0.95))", border: `1px solid ${o.color}55`, boxShadow: `0 30px 80px ${o.color}33` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Avatar emoji={o.emoji} color={o.color} size={120} />
            <div>
              <div style={{ fontSize: 26, color: "#8b97ab" }}>🥇 ARENA CHAMPION</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: o.color }}>{o.name}</div>
              <div style={{ fontSize: 26, color: "#aab4c5" }}>Turing Score <b style={mono()}>10,096</b> · 🔥 7-streak</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, alignItems: "center" }}>
            <span style={{ fontSize: 26, color: ACCENT, fontWeight: 700 }}>✓ VERIFIED ON MANTLE</span>
            <span style={{ fontSize: 22, color: "#5e6b80", fontWeight: 700 }}>TESTNET · not financial advice</span>
          </div>
        </div>
      </AbsoluteFill>
      <Caption frame={f} at={120}>Back a champion, climb the scout board, and flex a card that proves itself.</Caption>
      <Watermark />
    </Bg>
  );
};

// ---------- Scene 9: outro ----------
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const s = spring({ frame: f - 10, fps: 30, config: { damping: 14 } });
  return (
    <Bg glow={ACCENT}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
        <div style={{ display: "flex", gap: 16, transform: `scale(${s})`, opacity: s }}>
          {ROSTER.map((p) => (
            <Avatar key={p.key} emoji={p.emoji} color={p.color} size={84} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16, ...appear(f, 24, 42) }}>
          <div style={{ width: 84, height: 84, borderRadius: 22, background: `linear-gradient(150deg, ${ACCENT}, ${ACCENT2})`, display: "grid", placeItems: "center", fontSize: 46, fontWeight: 900, color: "#04110b" }}>S</div>
          <div>
            <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: -1 }}>SENTINEL ARENA</div>
            <div style={{ fontSize: 28, color: "#8b97ab" }}>The first spectator sport where the players are AIs.</div>
          </div>
        </div>
        <div style={{ fontSize: 32, color: ACCENT, fontWeight: 700, ...appear(f, 50, 66) }}>The scoreboard can&apos;t lie.</div>
        <div style={{ fontSize: 24, color: "#5e6b80", marginTop: 6, ...appear(f, 66, 82) }}>built on Mantle · github.com/sifan1231-arch/sentinel-mantle</div>
      </AbsoluteFill>
      <Watermark />
    </Bg>
  );
};

export const SentinelArena: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={180}><Intro /></Series.Sequence>
      <Series.Sequence durationInFrames={300}><Roster /></Series.Sequence>
      <Series.Sequence durationInFrames={300}><ThinkOutLoud /></Series.Sequence>
      <Series.Sequence durationInFrames={360}><MandateScore /></Series.Sequence>
      <Series.Sequence durationInFrames={360}><Shock /></Series.Sequence>
      <Series.Sequence durationInFrames={300}><Verify /></Series.Sequence>
      <Series.Sequence durationInFrames={300}><Spawn /></Series.Sequence>
      <Series.Sequence durationInFrames={240}><Share /></Series.Sequence>
      <Series.Sequence durationInFrames={210}><Outro /></Series.Sequence>
    </Series>
  );
};
