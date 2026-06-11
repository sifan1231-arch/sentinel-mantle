import Colosseum from "./colosseum";
import { isConfigured, EMPTY_PAYLOAD } from "../lib/arena-core";
import { getArena } from "../lib/arena-server";

// SSR every request: the first paint already carries live on-chain data
// (getArena() is module-cached at 5s, so this stays cheap under load).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const initial = isConfigured ? await getArena() : EMPTY_PAYLOAD;
  return <Colosseum initial={initial} />;
}
