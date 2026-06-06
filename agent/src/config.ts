import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", ".."); // agent/src -> agent -> repo root

dotenv.config({ path: path.join(REPO_ROOT, ".env") });
dotenv.config();

const env = (k: string, d = "") => (process.env[k]?.trim() ?? d) || d;

export const NETWORK = env("NETWORK", "mantleSepolia");

const NET_META: Record<string, { rpc: string; explorer: string; chainId: number }> = {
  mantleSepolia: { rpc: "https://rpc.sepolia.mantle.xyz", explorer: "https://sepolia.mantlescan.xyz", chainId: 5003 },
  mantle: { rpc: "https://rpc.mantle.xyz", explorer: "https://mantlescan.xyz", chainId: 5000 },
  localhost: { rpc: "http://127.0.0.1:8545", explorer: "http://localhost:8545", chainId: 31337 },
};

export const META = NET_META[NETWORK] ?? NET_META.mantleSepolia;
const RPC_ENV_KEY = NETWORK === "mantle" ? "MANTLE_MAINNET_RPC" : NETWORK === "mantleSepolia" ? "MANTLE_SEPOLIA_RPC" : "RPC_URL";
export const RPC = env(RPC_ENV_KEY, META.rpc);
export const EXPLORER = META.explorer;
export const CHAIN_ID = META.chainId;

export const PRIVATE_KEY = env("PRIVATE_KEY");
export const AGENT_PRIVATE_KEY = env("AGENT_PRIVATE_KEY") || PRIVATE_KEY;

// ---- deployment artifacts ----
const deployPath = path.join(REPO_ROOT, "contracts", "deployments", `${NETWORK}.json`);
const abisPath = path.join(REPO_ROOT, "contracts", "deployments", "abis.json");

export function loadDeployment(): {
  ok: boolean;
  data?: any;
  abis?: any;
  error?: string;
} {
  if (!fs.existsSync(deployPath) || !fs.existsSync(abisPath)) {
    return { ok: false, error: `No deployment found. Run "npm run deploy" first (looked for ${deployPath}).` };
  }
  const data = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const abis = JSON.parse(fs.readFileSync(abisPath, "utf8"));
  return { ok: true, data, abis };
}

// ---- the three managed assets ----
export const STABLE = "mUSD";
export const RISK = "mETH";
export const YIELD = "mRWA";
export const SYMBOLS = [STABLE, RISK, YIELD] as const;

// ---- live signal sources (real Mantle mainnet + Pyth) ----
export const MANTLE_MAINNET_RPC = env("MANTLE_MAINNET_RPC", "https://rpc.mantle.xyz");
export const METH_MAINNET = "0xcDA86A272531e8640cD7F1a92c01839911B90bb0"; // mETH on Mantle mainnet (signal source)

export const PYTH_HERMES = "https://hermes.pyth.network/v2/updates/price/latest";
export const PYTH_FEEDS: Record<string, string> = {
  mETH: "0xfbc9c3a716650b6e24ab22ab85b1c0ef4141b18f4590cc0b986e2f9064cf73d6", // mETH/USD
  mRWA: "0xe393449f6aff8a4b6d3e1165a7c9ebec103685f3b41e60db4277b5b6d10e7326", // USDY/USD
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD (fallback for mETH)
};

// ---- optional Allora decentralized inference ----
export const ALLORA_API_KEY = env("ALLORA_API_KEY");
export const ALLORA_BASE = env("ALLORA_BASE", "https://api.allora.network/v2");
export const ALLORA_TOPIC_ETH = env("ALLORA_TOPIC_ETH");

// ---- optional LLM rationale ----
export const ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY");
export const ANTHROPIC_MODEL = env("ANTHROPIC_MODEL", "claude-opus-4-8");

// ---- behaviour flags ----
export const LOG_HOLDS = env("LOG_HOLDS", "true") !== "false";

// ---- strategy constants (deterministic RWA yield/risk allocator) ----
// The agent manages a 3-asset RWA portfolio and rotates toward a target allocation:
//   mETH  — ETH liquid-staking exposure (≈3.5% staking yield + ETH beta) → the "risk" sleeve
//   mRWA  — Ondo USDY-class real-world-asset yield (≈5% T-bill yield)    → the "yield" sleeve
//   mUSD  — stable dry powder (0 yield)                                  → the "buffer" sleeve
// Idle cash is a drag, so the engine deploys the non-risk remainder into RWA yield, keeping only
// a regime-sized USD buffer. Calibrated for a conservative, explainable mandate (not a leveraged bot).
export const STRATEGY = {
  baseRiskWeightBps: 4500, // neutral mETH weight (rest earns RWA yield, not idle)
  kMomentum: 6.0, // mETH weight per 1bp of momentum
  kFlow: 1800, // mETH weight per unit of flowSignal (-1..1)
  kVol: 4.0, // de-risk per 1bp of volatility above the floor
  volFloorBps: 40,
  kAllora: 4.0,
  anomalyDerisk: 0.45, // multiply the mETH target on a whale-shock anomaly
  anomalyZTrigger: 2.3,
  // USD buffer (dry powder) by regime — the rest of the non-risk sleeve goes to RWA yield.
  bufferBps: { trend: 800, chop: 1500, shock: 3500 },
  // regime classification thresholds
  trendMomentumBps: 130, // |momentum| above this (with contained vol) = trend
  shockVolBps: 110, // volatility above this = shock
  minTradeUsdFloor: 25,
  minTradeBps: 120, // also require the rebalance to be >=1.2% of NAV to act
};

export type Strategy = typeof STRATEGY;

/** A competing agent in the Arena: a distinct personality with its own strategy + risk mandate. */
export interface Persona {
  key: string;
  name: string;
  persona: string; // short label/personality
  blurb: string; // one-line character description
  catchphrase: string;
  emoji: string;
  mandate: { maxSingleTradeBps: number; maxAssetWeightBps: number; maxDrawdownBps: number; slippageBps: number; cooldown: number };
  strategy: Partial<Strategy>;
}

export const mergeStrategy = (p?: Partial<Strategy>): Strategy => ({ ...STRATEGY, ...(p ?? {}) });
