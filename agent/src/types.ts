export type Mode = "live" | "demo";

export type ActionType = "ENTER" | "DERISK" | "REBALANCE" | "EXIT" | "HOLD";

export interface PythQuote {
  symbol: string;
  usd: number;
  emaUsd: number;
  confBps: number; // confidence interval / price, in bps (a volatility proxy)
  publishTime: number;
  source: string;
}

export interface OnchainFlow {
  ok: boolean;
  latestBlock: number;
  blockSpan: number;
  txCount: number;
  totalVolume: number; // mETH transferred in the window
  largeTransferCount: number;
  largeTransferVolume: number;
  whaleZ: number; // z-score of the largest transfer vs the window
  topTransfers: { from: string; to: string; amount: number }[];
  note: string;
}

export interface AlloraForecast {
  ok: boolean;
  directionBps: number | null; // predicted move, bps
  confidence: number | null; // 0..1
  note: string;
}

export type Regime = "trend" | "chop" | "shock";

export interface MarketView {
  prices: Record<string, number>; // symbol -> USD
  ema: Record<string, number>;
  momentumBps: number; // risk-asset momentum (price vs EMA)
  volatilityBps: number;
  flowSignal: number; // -1..+1 net smart-money flow proxy
  anomalyZ: number; // |z| of whale activity
  regime: Regime; // market regime classifier — gates risk + sizing
  allora: AlloraForecast;
  confidence: number; // 0..1 overall
  notes: string[]; // human-readable signal lines
  signalsHash: string; // keccak256 of the numeric snapshot
  raw: Record<string, unknown>;
}

export interface VaultState {
  navUsd: number;
  pnlUsd: number;
  costBasisUsd: number;
  highWaterUsd: number;
  halted: boolean;
  weightsBps: Record<string, number>; // symbol -> bps of NAV
  balances: Record<string, bigint>;
  decisionCount: number;
}

export interface Decision {
  action: ActionType;
  fromSymbol: string;
  toSymbol: string;
  fromAsset: string;
  toAsset: string;
  amountIn: bigint; // token units of fromAsset
  sizeUsd: number;
  predictedDirectionBps: number;
  confidenceBps: number;
  reason: string;
  targetWeightBps: number;
  currentWeightBps: number;
  vetoed: boolean;
  vetoReason: string;
}

export interface CycleResult {
  cycle: number;
  view: MarketView;
  decision: Decision;
  txHash: string | null;
  state: VaultState;
  ts: number;
}
