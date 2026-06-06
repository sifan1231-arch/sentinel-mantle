import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BG, FONT, MONO, ACCENT, ACCENT2 } from "./theme";

export const Bg: React.FC<{ glow?: string; children?: React.ReactNode }> = ({ glow = ACCENT, children }) => {
  const f = useCurrentFrame();
  const drift = Math.sin(f / 60) * 40;
  return (
    <AbsoluteFill style={{ background: BG, fontFamily: FONT, color: "#e8edf6", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at ${60 + drift / 8}% -10%, ${glow}22, transparent 60%), radial-gradient(700px 500px at 10% 110%, ${ACCENT2}18, transparent 55%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(120,140,170,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(120,140,170,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const Watermark: React.FC = () => (
  <>
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 48,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 22,
        color: "#8b97ab",
        fontWeight: 600,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: 99, background: ACCENT, boxShadow: `0 0 14px ${ACCENT}` }} />
      LIVE · Mantle Sepolia
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 38,
        left: 48,
        fontSize: 19,
        color: "#5e6b80",
        fontWeight: 700,
        letterSpacing: 1,
      }}
    >
      ⚠ TESTNET · provable skill, not financial advice
    </div>
  </>
);

export const Avatar: React.FC<{ emoji: string; color: string; size?: number; glow?: number }> = ({ emoji, color, size = 96, glow = 1 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.26,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.5,
      background: `linear-gradient(150deg, ${color}, ${color}88)`,
      boxShadow: `0 ${size * 0.12}px ${size * 0.45}px ${color}${glow ? "66" : "22"}`,
      border: "2px solid rgba(255,255,255,0.14)",
      flex: "none",
    }}
  >
    {emoji}
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = ACCENT }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 18px",
      borderRadius: 999,
      background: `${color}1f`,
      color,
      border: `1px solid ${color}44`,
      fontSize: 24,
      fontWeight: 700,
    }}
  >
    {children}
  </span>
);

export const mono = (s: React.CSSProperties = {}): React.CSSProperties => ({ fontFamily: MONO, fontVariantNumeric: "tabular-nums", ...s });

/** appear: 0→1 over [a,b] frames with a small upward slide */
export function appear(frame: number, a: number, b: number) {
  const o = interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [a, b], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity: o, transform: `translateY(${y}px)` };
}
export function fade(frame: number, a: number, b: number, c: number, d: number) {
  return interpolate(frame, [a, b, c, d], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}
