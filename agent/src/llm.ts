import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from "./config";
import type { Decision, MarketView } from "./types";

/**
 * OPTIONAL: ask Claude for a crisp natural-language rationale for the decision.
 * The agent works fully WITHOUT this — if no key is set, the deterministic reason is used.
 * The on-chain decision + proof are identical either way; this only enriches the wording.
 */
export async function enrichReason(view: MarketView, decision: Decision): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const ctx = {
      action: decision.action,
      momentumPct: +(view.momentumBps / 100).toFixed(2),
      volatilityPct: +(view.volatilityBps / 100).toFixed(2),
      flowSignal: +view.flowSignal.toFixed(2),
      anomalyZ: +view.anomalyZ.toFixed(2),
      confidencePct: Math.round(view.confidence * 100),
      targetWeightPct: Math.round(decision.targetWeightBps / 100),
      sizeUsd: Math.round(decision.sizeUsd),
    };
    const prompt =
      `You are Sentinel, an autonomous on-chain trading agent on Mantle. ` +
      `Given these signals ${JSON.stringify(ctx)}, write ONE crisp sentence (max 130 chars) ` +
      `explaining the decision as an on-chain rationale. No preamble, no quotes.`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 80, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const txt = j?.content?.[0]?.text?.trim();
    return txt ? txt.replace(/\s+/g, " ").slice(0, 140) : null;
  } catch {
    return null;
  }
}
