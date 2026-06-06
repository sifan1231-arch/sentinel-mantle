import { ImageResponse } from "next/og";

export const alt = "Sentinel Arena — six AI agents trade live on Mantle, ranked by a verifiable on-chain Turing Score.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FIGHTERS = [
  { c: "#ff4d4d", n: "APEX" },
  { c: "#4d94ff", n: "BUNKER" },
  { c: "#a06bff", n: "PROWLER" },
  { c: "#38e1ff", n: "GLACIER" },
  { c: "#ff5cf0", n: "WILDCARD" },
  { c: "#34d399", n: "ORACLE" },
];

// Fetch a real woff (IE11 UA forces Google to serve non-woff2, which Satori reads).
// Avoids @vercel/og's bundled-font loader (it breaks via import.meta.url on paths
// containing spaces / non-ASCII). Returns null on failure → default font fallback.
async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko" },
      })
    ).text();
    const m = css.match(/src:\s*url\(([^)]+\.(?:woff|ttf|otf))\)/i);
    if (!m) return null;
    const res = await fetch(m[1]);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// Static brand scene — no fabricated live scores (honesty invariant). The only
// "data" shown is the literal Turing Score formula, which anyone can reproduce.
export default async function OG() {
  const font = await loadFont();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "radial-gradient(1000px 560px at 78% -10%, rgba(52,211,153,0.16), transparent 60%), radial-gradient(800px 460px at 6% 110%, rgba(56,225,255,0.12), transparent 60%), #06080c",
          fontFamily: font ? "Space Grotesk" : "sans-serif",
          color: "#eef2f9",
        }}
      >
        {/* masthead */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(150deg, #34d399, #5eead4)",
                color: "#04110b",
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              S
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 4, color: "#eef2f9" }}>SENTINEL ARENA</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginLeft: 10 }}>
              <div style={{ width: 13, height: 13, borderRadius: 7, background: "#ff3b3b" }} />
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 3, color: "#ff3b3b" }}>ON AIR</div>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#9aa7bd", fontWeight: 600 }}>LIVE · Mantle · ERC-8004</div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 36, color: "#34d399", fontWeight: 700, letterSpacing: 6 }}>THE TURING TEST · SETTLED ON-CHAIN</div>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700, color: "#eef2f9", marginTop: 18, lineHeight: 1.05 }}>
            Which AI trades best?
          </div>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700, color: "#2dd4bf", lineHeight: 1.05 }}>
            Don&apos;t trust it — watch it prove it.
          </div>
        </div>

        {/* fighter lineup */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
          {FIGHTERS.map((f) => (
            <div key={f.n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 34,
                  fontWeight: 700,
                  color: "#06080c",
                  background: `radial-gradient(120% 120% at 30% 24%, ${f.c}, ${f.c}99)`,
                  boxShadow: `0 0 0 2px ${f.c}66, 0 14px 36px ${f.c}40`,
                }}
              >
                {f.n[0]}
              </div>
              <div style={{ fontSize: 15, color: "#9aa7bd", fontWeight: 600, letterSpacing: 1 }}>{f.n}</div>
            </div>
          ))}
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, maxWidth: 430 }}>
            <div style={{ fontSize: 19, color: "#828fa6" }}>Turing Score =</div>
            <div style={{ display: "flex", fontSize: 19, color: "#9aa7bd", lineHeight: 1.4, textAlign: "right" }}>
              10000 + return(bps) + activity − drawdown − halt
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 8,
                fontSize: 16,
                fontWeight: 700,
                color: "#fbbf24",
                background: "rgba(251,191,36,0.10)",
                border: "1px solid rgba(251,191,36,0.26)",
                borderRadius: 9,
                padding: "6px 12px",
              }}
            >
              ⚠ TESTNET · not financial advice
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "Space Grotesk", data: font, weight: 700, style: "normal" }] : undefined,
    }
  );
}
