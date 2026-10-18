import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_DISPLAY, FONT_SANS } from "../theme";
import { CLIPS, has } from "../clips";

const KIND_COLOR: Record<string, string> = { REAL: C.celadon, SCREEN: C.gold, AI: "#7d6bd6", STOCK: C.slate, MOTION: C.gold };

/** A gentle spring from 0 to 1, starting at `delay` frames. */
export function useIn(delay = 0, damping = 200) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
}

/** A clip from public/clips/, or a labelled placeholder that says exactly what to film. */
export function Footage({ file, style, volume = 0, playbackRate = 1, trimBefore = 0, fit = "cover" }: {
  file: string; style?: CSSProperties; volume?: number; playbackRate?: number; trimBefore?: number; fit?: "cover" | "contain";
}) {
  const path = `clips/${file}`;
  if (has(path))
    return (
      <OffthreadVideo src={staticFile(path)} volume={volume} playbackRate={playbackRate} trimBefore={trimBefore}
        style={{ width: "100%", height: "100%", objectFit: fit, ...style }} />
    );
  return <Placeholder file={file} style={style} />;
}

/** A still image from public/ (screenshots), or a placeholder. */
export function Still({ file, style, fit = "cover" }: { file: string; style?: CSSProperties; fit?: "cover" | "contain" }) {
  const path = `clips/${file}`;
  if (has(path)) return <Img src={staticFile(path)} style={{ width: "100%", height: "100%", objectFit: fit, ...style }} />;
  return <Placeholder file={file} style={style} />;
}

export function Placeholder({ file, style }: { file: string; style?: CSSProperties }) {
  const meta = CLIPS[file] ?? { kind: "REAL", what: file };
  const color = KIND_COLOR[meta.kind];
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{
      background: `repeating-linear-gradient(135deg, #1b2540 0 22px, #19223b 22px 44px)`, color: C.porcelain,
      alignItems: "center", justifyContent: "center", fontFamily: FONT_SANS, padding: 40, textAlign: "center", ...style,
    }}>
      <div style={{ border: `2px dashed ${color}`, borderRadius: 18, padding: "28px 36px", maxWidth: "86%", background: "rgba(20,29,51,0.75)" }}>
        <div style={{ display: "inline-block", background: color, color: "#fff", fontWeight: 700, fontSize: 22, borderRadius: 999, padding: "4px 16px", marginBottom: 14 }}>
          {meta.kind}
        </div>
        <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.25 }}>{meta.what}</div>
        {meta.how && <div style={{ fontSize: 22, opacity: 0.7, marginTop: 10 }}>{meta.how}</div>}
        <div style={{ fontSize: 20, opacity: 0.55, marginTop: 16, fontFamily: "monospace", wordBreak: "break-all" }}>public/clips/{file}</div>
        <div style={{ fontSize: 18, opacity: 0.4, marginTop: 6 }}>{(frame / 30).toFixed(1)} s</div>
      </div>
    </AbsoluteFill>
  );
}

/** A clean, minimal phone with the recording inside. */
export function PhoneFrame({ children, height = 900, style }: { children: ReactNode; height?: number; style?: CSSProperties }) {
  const width = Math.round(height * 0.4615); // 9 : 19.5
  return (
    <div style={{
      width, height, borderRadius: height * 0.07, background: "#0b1020", padding: height * 0.014,
      boxShadow: "0 40px 90px rgba(10, 14, 28, 0.45), 0 0 0 2px rgba(255,255,255,0.06) inset", ...style,
    }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: height * 0.058, overflow: "hidden", background: C.porcelain }}>
        {children}
      </div>
    </div>
  );
}

/** A lower-third: which models or rules are at work. */
export function LowerThird({ text, delay = 0 }: { text: string; delay?: number }) {
  const t = useIn(delay);
  return (
    <div style={{
      position: "absolute", left: 80, bottom: 150, transform: `translateY(${(1 - t) * 30}px)`, opacity: t,
      background: "rgba(20, 29, 51, 0.88)", color: C.porcelain, borderLeft: `6px solid ${C.gold}`, borderRadius: "0 14px 14px 0",
      padding: "14px 24px", fontFamily: FONT_SANS, fontSize: 26, fontWeight: 600, letterSpacing: 0.2, maxWidth: 960,
    }}>
      {text}
    </div>
  );
}

/** A small pill in a corner: "Live · sped up 2×", "AI-generated". */
export function Badge({ text, corner = "tr", tone = "gold" }: { text: string; corner?: "tr" | "tl" | "br" | "bl"; tone?: "gold" | "ai" }) {
  const pos: CSSProperties = { tr: { top: 50, right: 60 }, tl: { top: 50, left: 60 }, br: { bottom: 60, right: 60 }, bl: { bottom: 60, left: 60 } }[corner];
  return (
    <div style={{
      position: "absolute", ...pos, fontFamily: FONT_SANS, fontSize: 24, fontWeight: 700, borderRadius: 999, padding: "8px 18px",
      background: tone === "ai" ? "rgba(20,29,51,0.8)" : "rgba(184,137,43,0.92)", color: "#fff",
      border: tone === "ai" ? "1px solid rgba(255,255,255,0.4)" : "none", display: "flex", alignItems: "center", gap: 10,
    }}>
      {tone === "gold" && <span style={{ width: 10, height: 10, borderRadius: 5, background: "#fff" }} />}
      {text}
    </div>
  );
}

/** "Source: …" in small type, bottom left. */
export function Source({ text }: { text: string }) {
  return (
    <div style={{ position: "absolute", left: 60, bottom: 40, fontFamily: FONT_SANS, fontSize: 20, color: "rgba(255,255,255,0.75)", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
      {text}
    </div>
  );
}

export const LOOP_ARCS = "M26.4 10.2A14 14 0 0 1 37.7 26.9M34.7 33.0A14 14 0 0 1 14.6 34.4M10.8 28.8A14 14 0 0 1 19.7 10.7";
export const LOOP_HEADS = "M42.1 27.8L36.6 32.3L33.3 26.0z M11.6 37.7L10.5 30.7L17.6 31.1z M18.3 6.4L24.9 9.0L21.1 15.0z";
export const SEAM = "M23.4 12.5 21.6 17.8l3.4 3.6-2.3 4.4 1.9 3.2";

/** The Kintsugi mark: a green three-arrow loop with a gold seam (as in the app). `draw` 0..1 draws it in. */
export function Logo({ size = 120, draw = 1 }: { size?: number; draw?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size}>
      <path d={LOOP_ARCS} fill="none" stroke={C.celadon} strokeWidth="4" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} />
      <path d={LOOP_HEADS} fill={C.celadon} opacity={interpolate(draw, [0.7, 1], [0, 1], { extrapolateLeft: "clamp" })} />
      <path d={SEAM} fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1"
        strokeDashoffset={1 - interpolate(draw, [0.4, 1], [0, 1], { extrapolateLeft: "clamp" })} />
    </svg>
  );
}

/** A heading that rises in. */
export function Title({ children, size = 72, delay = 0, color = "#fff", style }: { children: ReactNode; size?: number; delay?: number; color?: string; style?: CSSProperties }) {
  const t = useIn(delay);
  return (
    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: size, color, lineHeight: 1.15, opacity: t, transform: `translateY(${(1 - t) * 24}px)`, ...style }}>
      {children}
    </div>
  );
}

/** The calm dark stage behind phones and graphics. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(1400px 700px at 85% -10%, rgba(184,137,43,0.22), transparent 60%),
                   radial-gradient(1100px 600px at -10% 110%, rgba(110,158,138,0.22), transparent 60%), ${C.night}`,
    }}>
      {children}
    </AbsoluteFill>
  );
}
