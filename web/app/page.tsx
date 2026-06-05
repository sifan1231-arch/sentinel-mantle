"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isConfigured,
  explorer,
  addresses,
  agentId,
  network,
  readVault,
  readAgent,
  readDecisions,
  symbolOf,
  DEP,
  type VaultSnapshot,
  type AgentMeta,
  type DecisionRow,
} from "../lib/chain";
import { fmtUsd, fmtUsd0, fmtPct, bpsToPct, shortHash, shortAddr, actionTone } from "../lib/format";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 26 - 1}`)
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  const stroke = up ? "#34d399" : "#fbbf24";
  return (
    <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,30 ${pts} 100,30`} fill="url(#g)" />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function AllocBar({ weights }: { weights: Record<string, number> }) {
  const cls: Record<string, string> = { mUSD: "musd", mETH: "meth", mRWA: "mrwa" };
  return (
    <>
      <div className="alloc">
        {["mUSD", "mETH", "mRWA"].map((s) => {
          const w = Math.max(0, weights[s] || 0);
          return (
            <span key={s} className={cls[s]} style={{ width: `${w}%` }}>
              {w >= 12 ? `${w.toFixed(0)}%` : ""}
            </span>
          );
        })}
      </div>
      <div className="legend">
        <span><i style={{ background: "#60a5fa" }} />mUSD {(weights.mUSD || 0).toFixed(0)}%</span>
        <span><i style={{ background: "#2dd4bf" }} />mETH {(weights.mETH || 0).toFixed(0)}%</span>
        <span><i style={{ background: "#fbbf24" }} />mRWA {(weights.mRWA || 0).toFixed(0)}%</span>
      </div>
    </>
  );
}

function Swarm() {
  return (
    <div className="swarm">
      <div className="node">
        <div className="emoji">🔭</div>
        <div className="role scout">Scout</div>
        <div className="task">Pyth prices · Mantle on-chain flow · anomalies</div>
      </div>
      <div className="arrow">→</div>
      <div className="node">
        <div className="emoji">🛡️</div>
        <div className="role warden">Warden</div>
        <div className="task">enforces the risk mandate · can veto</div>
      </div>
      <div className="arrow">→</div>
      <div className="node">
        <div className="emoji">⛓️</div>
        <div className="role operator">Operator</div>
        <div className="task">executes on Mantle · logs on-chain</div>
      </div>
    </div>
  );
}

function DecisionCard({ d }: { d: DecisionRow }) {
  const tone = actionTone(d.action);
  const from = symbolOf(d.fromAsset);
  const to = symbolOf(d.toAsset);
  const route = d.action === "HOLD" ? "" : `${from} → ${to}`;
  return (
    <div className="drow">
      <div className="head">
        <span className={`badge ${tone}`}>{d.action}{route ? ` · ${route}` : ""}</span>
        <span className="seq">#{d.seq}</span>
      </div>
      <div className="reason">{d.reason || "—"}</div>
      <div className="meta">
        <span>pred <b>{fmtPct(bpsToPct(d.predictedDirectionBps), 1)}</b></span>
        <span>conf <b>{bpsToPct(d.confidenceBps).toFixed(0)}%</b></span>
        <span>
          realized <b className={d.realizedPnl >= 0 ? "gain" : "loss"}>{fmtUsd(d.realizedPnl)}</b>
        </span>
        <a className="tx" href={`${explorer}/tx/${d.txHash}`} target="_blank" rel="noreferrer">
          {shortHash(d.txHash)} ↗
        </a>
      </div>
    </div>
  );
}

export default function Page() {
  const [vault, setVault] = useState<VaultSnapshot | null>(null);
  const [agent, setAgent] = useState<AgentMeta | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [updated, setUpdated] = useState<number>(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    const load = async () => {
      try {
        const [v, a, d] = await Promise.all([readVault(), readAgent(), readDecisions(60)]);
        if (!alive) return;
        setVault(v);
        setAgent(a);
        setDecisions(d);
        setUpdated(Date.now());
        setLive(true);
      } catch {
        if (alive) setLive(false);
      }
    };
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const latest = decisions[0];
  const roi = vault && vault.costBasisUsd > 0 ? (vault.pnlUsd / vault.costBasisUsd) * 100 : 0;
  const sparkData = useMemo(() => {
    const chrono = [...decisions].reverse();
    let cum = 0;
    const out = chrono.map((d) => (cum += d.realizedPnl));
    return out.length ? [0, ...out] : [];
  }, [decisions]);

  const anomaly = !!latest && /anomaly|whale|shock/i.test(latest.reason);

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <div className="mark">S</div>
          <div>
            <h1>Sentinel</h1>
            <p>self-proving autonomous RWA yield &amp; risk agent · Mantle</p>
          </div>
        </div>
        <div className="pill">
          <span className={`dot ${vault?.halted ? "warn" : live ? "" : "off"}`} />
          {vault?.halted ? "circuit breaker tripped" : live ? `live · ${network}` : "connecting…"}
        </div>
      </header>

      {!isConfigured && (
        <div className="banner">
          Not deployed yet. Run <code>npm run deploy</code> then redeploy this site — the dashboard reads everything
          live from your Mantle contracts.
        </div>
      )}

      <section className="hero">
        <div className="tag">The Turing Test, on-chain</div>
        <h2>
          An agent that <span className="grad">proves itself</span> — every decision written to Mantle.
        </h2>
        <p className="sub">
          Sentinel autonomously manages an RWA portfolio on Mantle — USDY-class yield, mETH staking, and a stable
          buffer — driven by smart-money &amp; anomaly signals, within an owner-set risk mandate it can never exceed,
          and records each decision + realized PnL on-chain. Sign once — it runs itself, and proves it.
        </p>
        <div className="heroStats">
          <div className="bigstat">
            <div className="k">Net asset value</div>
            <div className="v mono">{vault ? fmtUsd0(vault.navUsd) : "—"}</div>
          </div>
          <div className="bigstat">
            <div className="k">Total PnL</div>
            <div className={`v mono ${vault && vault.pnlUsd >= 0 ? "pos" : "neg"}`}>
              {vault ? `${fmtUsd(vault.pnlUsd)} (${fmtPct(roi)})` : "—"}
            </div>
          </div>
          <div className="bigstat">
            <div className="k">Decisions on-chain</div>
            <div className="v mono">{agent ? agent.decisionCount : decisions.length || "—"}</div>
          </div>
          <div className="bigstat">
            <div className="k">Latest conviction</div>
            <div className="v mono">{latest ? `${bpsToPct(latest.confidenceBps).toFixed(0)}%` : "—"}</div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3><span className="ico">🤖</span> the swarm</h3>
        <Swarm />
        <div className="flow" style={{ marginTop: 14 }} />
      </section>

      <div className="grid">
        <div className="col">
          <div className="card">
            <h3><span className="ico">📡</span> live decision feed <span style={{ color: "var(--dim)", fontWeight: 400 }}>· verifiable on Mantle</span></h3>
            {decisions.length ? (
              <div className="feed">
                {decisions.map((d) => (
                  <DecisionCard key={`${d.seq}-${d.txHash}`} d={d} />
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--dim)", fontSize: 13.5 }}>
                No decisions yet. Start the agent: <span className="mono">npm run agent</span>
              </p>
            )}
          </div>
        </div>

        <div className="col">
          <div className="card">
            <h3><span className="ico">📊</span> portfolio</h3>
            <AllocBar weights={vault?.weights || { mUSD: 0, mETH: 0, mRWA: 0 }} />
            <div style={{ marginTop: 14 }}>
              <div className="kv"><span className="key">Cost basis</span><span className="val">{vault ? fmtUsd(vault.costBasisUsd) : "—"}</span></div>
              <div className="kv"><span className="key">High-water mark</span><span className="val">{vault ? fmtUsd(vault.highWaterUsd) : "—"}</span></div>
              <div className="kv"><span className="key">Realized trail</span><span className="val">{agent ? fmtUsd(agent.cumRealizedPnl) : "—"}</span></div>
            </div>
            <Sparkline values={sparkData} />
          </div>

          <div className="card">
            <h3><span className="ico">🧭</span> current read</h3>
            <div className="kv">
              <span className="key">Signal</span>
              <span className="val">
                {latest ? <span className={`badge ${actionTone(latest.action)}`}>{latest.action}</span> : "—"}
                {anomaly ? <span className="badge warn" style={{ marginLeft: 6 }}>⚠ anomaly</span> : null}
              </span>
            </div>
            <div className="kv"><span className="key">Predicted move</span><span className="val">{latest ? fmtPct(bpsToPct(latest.predictedDirectionBps), 1) : "—"}</span></div>
            <div className="kv"><span className="key">Confidence</span><span className="val">{latest ? `${bpsToPct(latest.confidenceBps).toFixed(0)}%` : "—"}</span></div>
          </div>

          <div className="card">
            <h3><span className="ico">🛡️</span> risk mandate <span style={{ color: "var(--dim)", fontWeight: 400 }}>· enforced on-chain</span></h3>
            <div className="kv"><span className="key">Max / trade</span><span className="val">{vault ? `${bpsToPct(vault.mandate.maxSingleTradeBps).toFixed(0)}% of NAV` : "—"}</span></div>
            <div className="kv"><span className="key">Max / asset</span><span className="val">{vault ? `${bpsToPct(vault.mandate.maxAssetWeightBps).toFixed(0)}%` : "—"}</span></div>
            <div className="kv"><span className="key">Drawdown halt</span><span className="val">{vault ? `${bpsToPct(vault.mandate.maxDrawdownBps).toFixed(0)}%` : "—"}</span></div>
            <div className="kv"><span className="key">Status</span><span className="val">{vault?.halted ? <span className="badge warn">HALTED</span> : <span className="badge buy">active</span>}</span></div>
          </div>

          <div className="card">
            <h3><span className="ico">🪪</span> agent identity <span style={{ color: "var(--dim)", fontWeight: 400 }}>· ERC-8004</span></h3>
            <div className="idrow"><span className="k">Agent ID</span><span className="mono">#{agentId.toString()}</span></div>
            <div className="idrow"><span className="k">Owner</span><a href={`${explorer}/address/${agent?.owner || addresses.deployer || ""}`} target="_blank" rel="noreferrer">{agent ? shortAddr(agent.owner) : "—"}</a></div>
            <div className="idrow"><span className="k">Canonical NFT</span><span className="mono">{agent && agent.canonicalAgentId ? `#${agent.canonicalAgentId}` : "pending"}</span></div>
            <div className="idrow"><span className="k">Registry</span><a href={`${explorer}/address/${addresses.registry || ""}`} target="_blank" rel="noreferrer">{shortAddr(addresses.registry || "")} ↗</a></div>
          </div>
        </div>
      </div>

      <div className="foot">
        <div>
          Sentinel · built for the Turing Test Hackathon 2026 · {DEP?.chainId ? `chainId ${DEP.chainId}` : ""}
          {updated ? ` · updated ${new Date(updated).toLocaleTimeString()}` : ""}
        </div>
        <div className="links">
          <a href={`${explorer}/address/${addresses.vault || ""}`} target="_blank" rel="noreferrer">Vault ↗</a>
          <a href={`${explorer}/address/${addresses.registry || ""}`} target="_blank" rel="noreferrer">DecisionRegistry ↗</a>
          <a href={`${explorer}/address/${addresses.oracle || ""}`} target="_blank" rel="noreferrer">Oracle ↗</a>
        </div>
      </div>
    </div>
  );
}
