import { NextResponse } from "next/server";
import { getArena } from "../../../lib/arena-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  const data = await getArena();
  return NextResponse.json(data, {
    headers: {
      // every visitor shares one cached chain read at the edge
      "Cache-Control": "public, s-maxage=4, stale-while-revalidate=30",
    },
  });
}
