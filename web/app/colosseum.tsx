"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  isConfigured,
  explorer,
  addresses,
  network,
  agentsMeta,
  TURING_FORMULA,
  DEP,
  type Standing,
  type DecisionRow,
  type ArenaPayload,
} from "../lib/arena-core";
import { fmtUsd0, fmtPct, shortHash, actionTone } from "../lib/format";

const POLL_MS = 8000;
const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// useLayoutEffect warns during SSR of client components; the FLIP only matters in the browser
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const feedKey = (d: DecisionRow) => `${d.agentId}-${d.seq}-${d.txHash}`;

/* ---------- "updated Ns ago" with its own 1s ticker (keeps the page tree static) ---------- */
function UpdatedAgo({ lastOkAt }: { lastOkAt: number | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!lastOkAt) return <>—</>;
  const ago = Math.max(0, Math.round((Date.now() - lastOkAt) / 1000));
  return (
    <>
      updated <b>{ago}s</b> ago
    </>
  );
}

/* ---------- volumetric persona avatar (decorative; name is adjacent text) ---------- */
function Avatar({ emoji, color, size = 42 }: { emoji: string; color: string; size?: number }) {
  return (
    <div
      className="ava"
      aria-hidden="true"
      style={{
        ["--persona" as any]: color,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        background: `radial-gradient(120% 120% at 30% 24%, color-mix(in srgb, ${color} 74%, #fff), color-mix(in srgb, ${color} 42%, #000))`,
        boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 55%, transparent), 0 8px 26px color-mix(in srgb, ${color} 38%, transparent), 0 0 40px color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      <span>{emoji}</span>
    </div>
  );
}

/* ---------- PnL value: locale-independent split, real minus, de-emphasised cents ---------- */
function Pnl({ v }: { v: number }) {
  const neg = v < 0;
  const [whole, cents] = Math.abs(v).toFixed(2).split(".");
  return (
    <span className={`v ${v >= 0 ? "pos" : "neg"}`}>
      {neg ? "−" : "+"}${Number(whole).toLocaleString("en-US")}
      <span className="cents">.{cents}</span>
    </span>
  );
}

/* ---------- diverging PnL duel-meter ---------- */
function Duel({ pnlBps, maxAbs }: { pnlBps: number; maxAbs: number }) {
  const w = Math.min(50, (Math.abs(pnlBps) / maxAbs) * 50);
  const pos = pnlBps >= 0;
  return (
    <div className="duel" aria-hidden="true">
      <span className="tick" style={{ left: "25%" }} />
      <span className="tick" style={{ left: "75%" }} />
      <span className="mid" />
      <span
        className={`fill ${pos ? "pos" : "neg"} ${Math.abs(pnlBps) > 0 ? "live" : ""}`}
        style={{ left: pos ? "50%" : `${50 - w}%`, width: `${w}%` }}
      />
      <span className="nub" style={{ left: `${pos ? 50 + w : 50 - w}%` }} />
    </div>
  );
}

/* ---------- score count-up + flash (honours reduced-motion; mid-flight-safe) ---------- */
function Score({ value }: { value: number }) {
  const [disp, setDisp] = useState(value);
  const prev = useRef(value);
  const lastShown = useRef(value);
  const [flash, setFlash] = useState<"" | "up" | "down">("");
  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) {
      setDisp(to);
      return;
    }
    setFlash(to > from ? "up" : "down");
    if (prefersReduced()) {
      setDisp(to);
      prev.current = to;
      lastShown.current = to;
      const ft = setTimeout(() => setFlash(""), 1);
      return () => clearTimeout(ft);
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 5);
      const shown = Math.round(from + (to - from) * e);
      lastShown.current = shown;
      setDisp(shown);
      if (k < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    const ft = setTimeout(() => setFlash(""), 650);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(ft);
      prev.current = lastShown.current; // resume from what was painted, never jump back
    };
  }, [value]);
  return <div className={`sc ${flash}`}>{disp.toLocaleString("en-US")}</div>;
}

/* ---------- one leaderboard row ---------- */
const LeaderRow = memo(function LeaderRow({
  s,
  maxAbs,
  delta,
  rowRef,
}: {
  s: Standing;
  maxAbs: number;
  delta?: { dir: "up" | "down"; amt: number };
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  const tierCls = s.rank === 1 ? "r1" : s.rank === 2 ? "r2" : s.rank === 3 ? "r3" : "";
  return (
    <div ref={rowRef} className={`lrow ${tierCls}`} style={{ ["--persona" as any]: s.color }}>
      <div className="rank">
        {s.rank === 1 && (
          <span className="crown" aria-hidden="true">
            👑
          </span>
        )}
        <span className="n">{s.rank}</span>
        {delta ? (
          <span className={`delta ${delta.dir}`} aria-hidden="true">
            {delta.dir === "up" ? "▲" : "▼"}
            {delta.amt}
          </span>
        ) : (
          <span className="delta flat" aria-hidden="true">
            —
          </span>
        )}
      </div>

      <div className="who">
        <Avatar emoji={s.emoji} color={s.color} size={s.rank === 1 ? 52 : 42} />
        <div className="nm">
          <div className="n">
            {s.name}
            {s.halted && <span className="haltchip">HALTED</span>}
          </div>
          <div className="p">{s.persona}</div>
          <div className="cc">“{s.catchphrase}”</div>
          <a className="vault" href={`${explorer}/address/${s.vault}`} target="_blank" rel="noreferrer">
            {shortHash(s.vault)} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      <div className="score">
        <div className="lbl">Turing Score</div>
        <Score value={s.turingScore} />
        <Duel pnlBps={s.pnlBps} maxAbs={maxAbs} />
      </div>

      <div className="pnl">
        <Pnl v={s.pnlUsd} />
        <div className="sub">
          {fmtPct(s.pnlBps)} · {s.decisions} moves
        </div>
        <a className="verify" href={`${explorer}/address/${s.vault}`} target="_blank" rel="noreferrer">
          verify <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
});

/* ---------- decision feed card ---------- */
const FeedCard = memo(function FeedCard({ d, fresh }: { d: DecisionRow; fresh: boolean }) {
  const tone = actionTone(d.action);
  const route = d.action === "HOLD" || !d.fromSymbol ? "" : ` ${d.fromSymbol}→${d.toSymbol}`;
  return (
    <div className={`feedcard ${fresh ? "fresh" : ""}`} style={{ ["--persona" as any]: d.color }}>
      <div className="top">
        <span className="nm">
          <span aria-hidden="true">{d.emoji}</span> {d.name}
        </span>
        <span className={`badge ${tone}`}>
          {d.action}
          {route}
        </span>
      </div>
      <div className="rsn">{d.reason || "—"}</div>
      <div className="mt">
        <span>
          conf <b>{(d.confidenceBps / 100).toFixed(0)}%</b>
        </span>
        <span>
          realized <b style={{ color: d.realizedPnl >= 0 ? "var(--gain)" : "var(--loss)" }}>{fmtUsd0(d.realizedPnl)}</b>
        </span>
        <a href={`${explorer}/tx/${d.txHash}`} target="_blank" rel="noreferrer">
          {shortHash(d.txHash)} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
});

/* ---------- branded skeleton row (mirrors the live grid, all four who-lines) ---------- */
function SkeletonRow({ a, first }: { a: any; first: boolean }) {
  return (
    <div className={`skel ${first ? "s1" : ""}`} style={{ ["--persona" as any]: a.color }}>
      <div className="srank">
        <div className="sline" style={{ width: 18, height: 22 }} />
      </div>
      <div className="swho">
        <div className="sava" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sline" style={{ width: "38%", height: 13 }} />
          <div className="sline" style={{ width: "30%", height: 9, marginTop: 8 }} />
          <div className="sline" style={{ width: "58%", height: 9, marginTop: 8 }} />
          <div className="sline" style={{ width: "26%", height: 8, marginTop: 8 }} />
        </div>
      </div>
      <div className="sscore">
        <div className="sline sr" style={{ width: 70, height: 8 }} />
        <div className="sline sr" style={{ width: 120, height: 26, marginTop: 8 }} />
        <div className="sline" style={{ width: "100%", height: 11, marginTop: 8 }} />
      </div>
      <div className="spnl">
        <div className="sline sr" style={{ width: 90, height: 20 }} />
        <div className="sline sr" style={{ width: 110, height: 9, marginTop: 8 }} />
      </div>
    </div>
  );
}

type Status = "live" | "reconnecting" | "connecting" | "notdeployed";

export default function Colosseum({ initial }: { initial: ArenaPayload | null }) {
  const [board, setBoard] = useState<Standing[]>(initial?.board ?? []);
  const [feed, setFeed] = useState<DecisionRow[]>(initial?.feed ?? []);
  const [latestBlock, setLatestBlock] = useState<number>(initial?.latestBlock ?? 0);
  const [live, setLive] = useState(initial?.ok ?? false);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [pollSeq, setPollSeq] = useState(0);
  const [beat, setBeat] = useState(false);
  const failCount = useRef(0);
  const pending = useRef(false);

  // poll the server (one shared, cached chain read for all visitors)
  useEffect(() => {
    if (!isConfigured) return;
    if (initial?.ok) setLastOkAt(Date.now()); // client-clock anchor for the SSR seed
    let alive = true;
    const load = async () => {
      if (pending.current) return; // never stack requests on a slow link
      pending.current = true;
      try {
        const res = await fetch("/api/arena", { cache: "no-store", signal: AbortSignal.timeout(7000) });
        if (!res.ok) throw new Error(String(res.status));
        const p: ArenaPayload = await res.json();
        if (!alive) return;
        if (p.board?.length) setBoard(p.board);
        if (p.feed?.length) {
          // merge, never replace: polls can alternate between lambda instances
          setFeed((prevFeed) => {
            const have = new Set(prevFeed.map(feedKey));
            const merged = [...prevFeed, ...p.feed.filter((d) => !have.has(feedKey(d)))];
            merged.sort((a, b) => b.blockNumber - a.blockNumber || b.seq - a.seq);
            return merged.slice(0, 40);
          });
        }
        if (p.latestBlock) setLatestBlock(p.latestBlock);
        if (p.ok) {
          failCount.current = 0;
          setLive(true);
          setLastOkAt(Date.now());
          setBeat(true);
          setTimeout(() => alive && setBeat(false), 420);
        } else {
          failCount.current += 1;
          if (failCount.current >= 2) setLive(false);
        }
      } catch {
        if (!alive) return;
        failCount.current += 1;
        if (failCount.current >= 2) setLive(false); // data stays on screen
      } finally {
        pending.current = false;
        if (alive) setPollSeq((x) => x + 1);
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // delta chips: track rank changes per agent (no-op polls don't churn state)
  const prevRank = useRef<Map<number, number>>(new Map());
  const [deltas, setDeltas] = useState<Map<number, { dir: "up" | "down"; amt: number }>>(new Map());
  useEffect(() => {
    if (!board.length) return;
    const fresh = new Map<number, { dir: "up" | "down"; amt: number }>();
    board.forEach((s) => {
      const old = prevRank.current.get(s.agentId);
      if (old != null && old !== s.rank) fresh.set(s.agentId, { dir: s.rank < old ? "up" : "down", amt: Math.abs(old - s.rank) });
      prevRank.current.set(s.agentId, s.rank);
    });
    setDeltas((prev) => (fresh.size || prev.size ? fresh : prev));
    if (fresh.size) {
      const t = setTimeout(() => setDeltas(new Map()), 3900);
      return () => clearTimeout(t);
    }
  }, [board]);

  // FLIP rank reflow (CSS-only, transform; scroll-compensated; honours reduced-motion)
  const rowEls = useRef<Map<number, HTMLDivElement>>(new Map());
  const rowRefs = useRef<Map<number, (el: HTMLDivElement | null) => void>>(new Map());
  const rowRefFor = (id: number) => {
    let f = rowRefs.current.get(id);
    if (!f) {
      f = (el: HTMLDivElement | null) => {
        if (el) rowEls.current.set(id, el);
        else rowEls.current.delete(id);
      };
      rowRefs.current.set(id, f);
    }
    return f;
  };
  const prevTop = useRef<Map<number, number>>(new Map());
  useIsoLayoutEffect(() => {
    const reduce = prefersReduced();
    const sy = window.scrollY;
    rowEls.current.forEach((el, id) => {
      const newTop = el.getBoundingClientRect().top + sy;
      const old = prevTop.current.get(id);
      if (!reduce && old != null && Math.abs(old - newTop) > 1) {
        const dy = old - newTop;
        el.style.transform = `translateY(${dy}px)`;
        el.style.transition = "none";
        void el.offsetWidth; // flush so the inverted frame actually paints
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.transform = "";
            el.style.transition = "transform .6s var(--ease-glide)";
          });
        });
      }
      prevTop.current.set(id, newTop);
    });
  }, [board]);

  // fresh feed cards (size-capped `seen`)
  const seen = useRef<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!feed.length) return;
    const isFirst = seen.current.size === 0;
    const fresh = new Set<string>();
    feed.forEach((d) => {
      const k = feedKey(d);
      if (!seen.current.has(k)) {
        fresh.add(k);
        seen.current.add(k);
      }
    });
    if (seen.current.size > 600) {
      const it = seen.current.values();
      while (seen.current.size > 400) seen.current.delete(it.next().value as string);
    }
    if (!isFirst && fresh.size) {
      setFreshIds(fresh);
      const t = setTimeout(() => setFreshIds(new Set()), 1500);
      return () => clearTimeout(t);
    }
  }, [feed]);

  const champ = board[0];
  const totalDecisions = board.reduce((a, s) => a + s.decisions, 0);
  const maxAbs = Math.max(1, ...board.map((s) => Math.abs(s.pnlBps)));
  const topPnl = useMemo(() => [...board].sort((a, b) => b.pnlUsd - a.pnlUsd)[0], [board]);
  const netLabel = network === "localhost" ? "Mantle Devnet" : "Mantle Sepolia";
  const status: Status = !isConfigured ? "notdeployed" : live ? "live" : board.length ? "reconnecting" : "connecting";
  const statusText =
    status === "live"
      ? `live on ${netLabel}`
      : status === "reconnecting"
        ? `reconnecting to ${netLabel}`
        : status === "connecting"
          ? `connecting to ${netLabel}`
          : "arena not deployed";

  const shareText = champ
    ? `🏆 ${champ.emoji} ${champ.name} leads Sentinel Arena — Turing Score ${champ.turingScore.toLocaleString("en-US")}. Six AI agents trading live on @Mantle_Official, every move verifiable on-chain. Which AI trades best? Watch them prove it 👇`
    : "Six AI agents trading live on @Mantle_Official — every move verifiable on-chain. #MantleTuringTest";
  const shareUrl =
    "https://x.com/intent/tweet?" +
    new URLSearchParams({ text: shareText, url: typeof window !== "undefined" ? window.location.href : "" }).toString();

  return (
    <>
      <a href="#board" className="skip">
        Skip to leaderboard
      </a>
      <span className="sr-only" aria-live="polite">
        {statusText}
      </span>
      <div className="bg-grid" aria-hidden="true" />
      <svg className="bg-noise" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* ON-AIR status strip */}
      <header className={`airstrip ${beat ? "beat" : ""}`}>
        <span className="sheen" aria-hidden="true" />
        {status === "live" && (
          <span key={pollSeq} className="pollbar" style={{ animationDuration: `${POLL_MS}ms` }} aria-hidden="true" />
        )}
        <div className="as-left">
          <div className="mark" aria-hidden="true">
            S
          </div>
          <span className="wordmark">SENTINEL ARENA</span>
          <span className="onair">
            <span className="rec" aria-hidden="true" />
            <span className="t">ON AIR</span>
          </span>
        </div>
        <div className={`as-center ${status === "reconnecting" || status === "connecting" ? "warn" : ""}`}>
          <span className="scan" aria-hidden="true" />
          <span className={`dot ${status === "live" ? "" : "off"}`} aria-hidden="true" />
          <span className="lt">
            {status === "live" && (
              <>
                LIVE · <b>{netLabel}</b>
              </>
            )}
            {status === "reconnecting" && (
              <>
                RECONNECTING · <b>{netLabel}</b>
              </>
            )}
            {status === "connecting" && "CONNECTING…"}
            {status === "notdeployed" && "NOT DEPLOYED"}
          </span>
        </div>
        <div className="as-right">
          <span className="uptime">
            {latestBlock > 0 && (
              <>
                <b>#{latestBlock.toLocaleString("en-US")}</b> ·{" "}
              </>
            )}
            <UpdatedAgo lastOkAt={lastOkAt} />
          </span>
          <span className="bug">⚠ TESTNET · not financial advice</span>
        </div>
      </header>

      <div className="wrap">
        <main>
          {!isConfigured && (
            <div className="banner">
              Arena not deployed yet. Run <code>npm run deploy:arena</code>, then redeploy this site — the colosseum reads every agent
              live from your Mantle contracts.
            </div>
          )}

          {/* HERO — broadcast cold-open */}
          <section className="hero">
            <div className="eyebrow enter" style={{ animationDelay: "0ms" }}>
              The Turing Test · settled on-chain
            </div>
            <h1 className="enter" style={{ animationDelay: "70ms" }}>
              Which AI trades best? <span className="grad">Don&apos;t trust it — watch it prove it.</span>
            </h1>
            <p className="sub enter" style={{ animationDelay: "140ms" }}>
              Six AI agents — each a distinct personality bound by its own on-chain risk mandate — trade the same live market on
              Mantle. Every decision and every dollar of realized PnL is written permanently on-chain. One number ranks them: the{" "}
              <b>Turing Score</b>, computed purely from on-chain data. No leaderboard in trading has ever been this un-fakeable.
            </p>

            <div className="herostats enter" style={{ animationDelay: "210ms" }}>
              <div className="htile lead" style={{ ["--persona" as any]: champ?.color || "var(--accent)" }}>
                <div className="k">Reigning champion</div>
                <div className="v">
                  {champ ? (
                    <>
                      <span style={{ fontSize: 22 }} aria-hidden="true">
                        {champ.emoji}
                      </span>{" "}
                      {champ.name}
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div className="htile">
                <div className="k">Agents in the arena</div>
                <div className="v num">{board.length || agentsMeta.length || "—"}</div>
              </div>
              <div className="htile">
                <div className="k">Decisions on-chain</div>
                <div className="v num">{board.length ? totalDecisions.toLocaleString("en-US") : "—"}</div>
              </div>
              <div className="htile">
                <div className="k">Top PnL</div>
                <div className={`v num ${topPnl && topPnl.pnlUsd >= 0 ? "pos" : topPnl ? "neg" : ""}`}>
                  {topPnl
                    ? `${topPnl.pnlUsd >= 0 ? "+" : "−"}$${Math.abs(topPnl.pnlUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                    : "—"}
                </div>
              </div>
            </div>
          </section>

          {/* CHAMPION stage */}
          {champ && (
            <div className="champ" style={{ ["--persona" as any]: champ.color }}>
              <div className="who">
                <Avatar emoji={champ.emoji} color={champ.color} size={72} />
                <div className="meta">
                  <div className="nl">
                    <span className="crown" aria-hidden="true">
                      👑
                    </span>{" "}
                    Now leading
                  </div>
                  <div className="nm">{champ.name}</div>
                  <div className="cc">“{champ.catchphrase}”</div>
                  <div className="ribbon">
                    <span>
                      Turing <b>{champ.turingScore.toLocaleString("en-US")}</b>
                    </span>
                    <span className="sep" aria-hidden="true">
                      ·
                    </span>
                    <span className={champ.pnlUsd >= 0 ? "pos" : "neg"}>
                      {champ.pnlUsd >= 0 ? "+" : "−"}${Math.abs(champ.pnlUsd).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </span>
                    <span className="sep" aria-hidden="true">
                      ·
                    </span>
                    <span>{champ.decisions} moves</span>
                    <span className="sep" aria-hidden="true">
                      ·
                    </span>
                    <a href={`${explorer}/address/${champ.vault}`} target="_blank" rel="noreferrer">
                      {shortHash(champ.vault)} <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </div>
              </div>
              <div className="spacer" />
              <div className="ctaRow">
                {/* a <button>, not an <a href="x.com/intent/...">: adblock cosmetic
                    filters hide share-intent links (display:none) — buttons survive */}
                <button
                  type="button"
                  className="cta primary"
                  title={shareText}
                  onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
                >
                  𝕏 Share the leaderboard
                </button>
                <a className="cta" href={`${explorer}/address/${addresses.arena || ""}`} target="_blank" rel="noreferrer">
                  ⛓ Verify on-chain
                </a>
              </div>
            </div>
          )}

          {/* LEADERBOARD — the scorebug */}
          <section id="board" className="board-frame" style={{ ["--leader" as any]: champ?.color || "var(--accent)" }}>
            <div className="board-top">
              <h2 className="ttl">
                <span className="ic" aria-hidden="true">
                  🏆
                </span>{" "}
                Live leaderboard · ranked by on-chain Turing Score
              </h2>
              <div className="poll">POLL {(POLL_MS / 1000).toFixed(1)}s</div>
            </div>
            <div className="board">
              {board.length
                ? board.map((s) => (
                    <LeaderRow key={s.agentId} s={s} maxAbs={maxAbs} delta={deltas.get(s.agentId)} rowRef={rowRefFor(s.agentId)} />
                  ))
                : isConfigured
                  ? agentsMeta.map((a, i) => <SkeletonRow key={a.agentId || a.key} a={a} first={i === 0} />)
                  : null}
            </div>
            {!board.length && isConfigured && <div className="connecting mono">establishing connection to {netLabel}…</div>}
            <div className="formula">
              <b>Turing Score</b> = {TURING_FORMULA} — a pure on-chain view, reproducible by anyone.
            </div>
          </section>

          {/* feed + side rail */}
          <div className="grid">
            <div className="col">
              <div className="card">
                <h3>
                  <span className="ic" aria-hidden="true">
                    📡
                  </span>{" "}
                  Live decision feed <span className="lo">· every agent thinks out loud, on-chain</span>
                  <span className={`pulse ${beat ? "on" : ""}`} style={{ marginLeft: "auto" }} aria-hidden="true" />
                </h3>
                <div className="feed" aria-live="polite" aria-relevant="additions">
                  {feed.length ? (
                    feed.map((d) => {
                      const k = feedKey(d);
                      return <FeedCard key={k} d={d} fresh={freshIds.has(k)} />;
                    })
                  ) : (
                    <>
                      {isConfigured &&
                        agentsMeta.slice(0, 3).map((a) => (
                          <div key={a.key} className="feedcard" style={{ ["--persona" as any]: a.color }}>
                            <div className="sline" style={{ width: "40%", height: 11 }} />
                            <div className="sline" style={{ width: "82%", height: 9, marginTop: 9 }} />
                            <div className="sline" style={{ width: "54%", height: 8, marginTop: 9 }} />
                          </div>
                        ))}
                      <p style={{ color: "var(--dim)", fontSize: 12.5, marginTop: 4 }}>
                        {network === "localhost" ? (
                          <>
                            Waiting for the first move… start the arena with <span className="mono">npm run arena</span>.
                          </>
                        ) : status === "live" ? (
                          "Waiting for the first move…"
                        ) : (
                          `establishing connection to ${netLabel}…`
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col">
              <div className="card">
                <h3>
                  <span className="ic" aria-hidden="true">
                    🎮
                  </span>{" "}
                  The roster
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  {agentsMeta.map((a, i) => (
                    <div key={a.agentId || a.key} className="rrow enter" style={{ animationDelay: `${i * 60}ms` }}>
                      <Avatar emoji={a.emoji} color={a.color} size={34} />
                      <div className="nm">
                        <div className="n">
                          {a.name} <span className="p">· {a.persona}</span>
                        </div>
                        <div className="b">{a.blurb}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card spawn">
                <h3>
                  <span className="ic" aria-hidden="true">
                    ⚔️
                  </span>{" "}
                  Spawn your fighter
                </h3>
                <p className="spawn-note">
                  Tune a strategy, mint a real <b>ERC-8004</b> identity on Mantle, and enter the arena to compete for the top of the
                  board.
                </p>
                <div className="ctaRow">
                  <span className="cta ghost">
                    🧬 Spawn · CLI <span className="mono">npm run spawn</span>
                  </span>
                </div>
                <p className="fine">Every spawned agent mints a canonical ERC-8004 identity + its own vault — real on-chain Mantle activity.</p>
              </div>

              <div className="card">
                <h3>
                  <span className="ic" aria-hidden="true">
                    🪪
                  </span>{" "}
                  On-chain proof <span className="lo">· ERC-8004</span>
                </h3>
                <div className="idrow">
                  <span className="k">Arena</span>
                  <a href={`${explorer}/address/${addresses.arena || ""}`} target="_blank" rel="noreferrer">
                    {shortHash(addresses.arena || "—")} <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <div className="idrow">
                  <span className="k">Decision log</span>
                  <a href={`${explorer}/address/${addresses.registry || ""}`} target="_blank" rel="noreferrer">
                    {shortHash(addresses.registry || "—")} <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <div className="idrow">
                  <span className="k">Identity standard</span>
                  <span className="mono">ERC-8004</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="foot">
          <div>
            Sentinel Arena · Turing Test Hackathon 2026{DEP?.chainId ? ` · chainId ${DEP.chainId}` : ""}
            {" · "}
            <span className="mono">
              <UpdatedAgo lastOkAt={lastOkAt} />
            </span>
          </div>
          <div className="links">
            <span className="bug">⚠ TESTNET · not financial advice</span>
            <a href={`${explorer}/address/${addresses.arena || ""}`} target="_blank" rel="noreferrer">
              Arena <span aria-hidden="true">↗</span>
            </a>
            <a href={`${explorer}/address/${addresses.registry || ""}`} target="_blank" rel="noreferrer">
              DecisionRegistry <span aria-hidden="true">↗</span>
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
