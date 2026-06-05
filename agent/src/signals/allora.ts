import { ALLORA_API_KEY, ALLORA_BASE, ALLORA_TOPIC_ETH } from "../config";
import { clamp } from "../util";
import type { AlloraForecast } from "../types";

/**
 * OPTIONAL: pull a decentralized-inference price/return forecast from Allora as the agent's
 * "external brain". Disabled unless ALLORA_API_KEY + ALLORA_TOPIC_ETH are set. Fully graceful —
 * it never throws, so the agent runs with or without it.
 */
export async function fetchAllora(): Promise<AlloraForecast> {
  const off: AlloraForecast = {
    ok: false,
    directionBps: null,
    confidence: null,
    note: "Allora disabled (set ALLORA_API_KEY + ALLORA_TOPIC_ETH to enable)",
  };
  if (!ALLORA_API_KEY || !ALLORA_TOPIC_ETH) return off;

  try {
    const url = `${ALLORA_BASE}/allora/consumer/ethereum-11155111?allora_topic_id=${ALLORA_TOPIC_ETH}`;
    const res = await fetch(url, {
      headers: { "x-api-key": ALLORA_API_KEY, accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ...off, note: `Allora HTTP ${res.status}` };
    const j: any = await res.json();
    const raw =
      j?.data?.inference_data?.network_inference_normalized ??
      j?.data?.network_inference_normalized ??
      j?.network_inference ??
      NaN;
    const val = Number(raw);
    // Treat an unparseable inference as "unavailable" (ok:false) so the caller ignores it cleanly.
    if (!isFinite(val)) return { ...off, ok: false, note: "Allora reachable but inference unparseable" };
    // Best-effort: interpret a normalized inference as a small return forecast (bps).
    const directionBps = clamp(val * 10000, -800, 800);
    return { ok: true, directionBps, confidence: 0.6, note: `Allora topic ${ALLORA_TOPIC_ETH}` };
  } catch {
    return { ...off, note: "Allora request failed" };
  }
}
