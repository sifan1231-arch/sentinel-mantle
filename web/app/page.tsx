import Colosseum from "./colosseum";
import { isConfigured, EMPTY_PAYLOAD } from "../lib/arena-core";
import { getArena } from "../lib/arena-server";

// ISR, not force-dynamic: ONE background regeneration per 5s window serves every
// visitor (force-dynamic would run a chain read per request — under judge traffic
// that recreates the public-RPC rate-limit failure server-side). The SSR seed is
// at most ~5s stale; the client's 8s poll takes over immediately after hydration.
export const revalidate = 5;
export const runtime = "nodejs";
export const maxDuration = 10;

export default async function Page() {
  const initial = isConfigured ? await getArena() : EMPTY_PAYLOAD;
  return <Colosseum initial={initial} />;
}
