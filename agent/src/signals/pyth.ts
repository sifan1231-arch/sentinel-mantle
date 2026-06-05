import { PYTH_HERMES, PYTH_FEEDS } from "../config";
import type { PythQuote } from "../types";

const now = () => Math.floor(Date.now() / 1000);

async function coingeckoEth(): Promise<PythQuote> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await res.json();
    const p = Number(j?.ethereum?.usd);
    if (isFinite(p) && p > 0) return { symbol: "mETH", usd: p, emaUsd: p, confBps: 50, publishTime: now(), source: "coingecko:ETH" };
  } catch {
    /* fall through */
  }
  return { symbol: "mETH", usd: 3000, emaUsd: 3000, confBps: 0, publishTime: now(), source: "fallback" };
}

/**
 * Fetch REAL prices from Pyth Hermes (no API key). mETH and USDY have native Pyth feeds,
 * so the agent prices our testnet instruments with genuine market data + EMA + confidence.
 */
export async function fetchPrices(): Promise<Record<string, PythQuote>> {
  const out: Record<string, PythQuote> = {
    mUSD: { symbol: "mUSD", usd: 1, emaUsd: 1, confBps: 0, publishTime: now(), source: "stable" },
  };

  const feeds = [PYTH_FEEDS.mETH, PYTH_FEEDS.mRWA, PYTH_FEEDS.ETH];
  let parsed: any[] = [];
  try {
    const url = PYTH_HERMES + "?" + feeds.map((id) => `ids[]=${id}`).join("&");
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const j: any = await res.json();
      parsed = j?.parsed ?? [];
    }
  } catch {
    /* handled below by fallbacks */
  }

  const byId = new Map<string, any>();
  for (const p of parsed) byId.set(("0x" + p.id).toLowerCase(), p);
  const q = (feed: string) => byId.get(feed.toLowerCase());

  const toQuote = (sym: string, p: any, source: string): PythQuote | null => {
    const expo = Number(p?.price?.expo);
    // Pyth crypto feeds use small negative exponents (~ -8). Reject corrupt/out-of-range data.
    if (!isFinite(expo) || expo < -30 || expo > 0) return null;
    const scale = Math.pow(10, expo);
    const price = Number(p.price.price) * scale;
    const ema = Number(p.ema_price?.price ?? p.price.price) * scale;
    const conf = Number(p.price.conf) * scale;
    if (!isFinite(price) || price <= 0) return null;
    const emaSafe = isFinite(ema) && ema > 0 ? ema : price;
    const confBps = isFinite(conf) && conf >= 0 ? Math.min((conf / price) * 10000, 5000) : 0;
    return { symbol: sym, usd: price, emaUsd: emaSafe, confBps, publishTime: Number(p.price.publish_time) || now(), source };
  };

  const methP = q(PYTH_FEEDS.mETH) || q(PYTH_FEEDS.ETH);
  const methQ = methP ? toQuote("mETH", methP, q(PYTH_FEEDS.mETH) ? "pyth:mETH/USD" : "pyth:ETH/USD") : null;
  out.mETH = methQ ?? (await coingeckoEth());

  const usdyP = q(PYTH_FEEDS.mRWA);
  const usdyQ = usdyP ? toQuote("mRWA", usdyP, "pyth:USDY/USD") : null;
  out.mRWA = usdyQ ?? { symbol: "mRWA", usd: 1.05, emaUsd: 1.05, confBps: 0, publishTime: now(), source: "fallback" };

  return out;
}
