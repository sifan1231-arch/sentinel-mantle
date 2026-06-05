export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function zscore(x: number, xs: number[]): number {
  const s = std(xs);
  if (s === 0) return 0;
  return (x - mean(xs)) / s;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const fmtUsd = (v: number) =>
  (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

export const fmtPct = (bps: number) => (bps >= 0 ? "+" : "") + (bps / 100).toFixed(2) + "%";

export const shortAddr = (a: string) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

// Minimal ANSI colors (no dependency).
export const c = {
  reset: "\x1b[0m",
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
};

/** Convert a USD size into token units (bigint) given a USD price and token decimals. */
export function usdToTokenAmount(usd: number, priceUsd: number, decimals: number): bigint {
  if (priceUsd <= 0 || usd <= 0) return 0n;
  const human = usd / priceUsd;
  // round to the token's precision, then scale to integer units.
  const fixed = human.toFixed(Math.min(decimals, 18));
  const [whole, frac = ""] = fixed.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

export function tokenAmountToHuman(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

/** E8 (1e8 USD) bigint helpers. */
export const E8 = 10n ** 8n;
export const usdToE8 = (usd: number) => BigInt(Math.round(usd * 1e8));
export const e8ToUsd = (v: bigint) => Number(v) / 1e8;
