import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { C, FONT_DISPLAY, FONT_SANS } from "../theme";
import { Logo } from "../components/ui";
import { REC_H, REC_W } from "./edl";

// The YouTube thumbnail (1280 × 720): render with `npm run thumbnail`.
const PANEL = { x: 2150, y: 405, w: 874, h: 1035 }; // Scout's "found 7 things" list in the first recording, above the face cam
const PANEL_AT_S = 190;

export default function Thumbnail() {
  const cardH = 500, cardW = (cardH * PANEL.w) / PANEL.h, k = cardW / PANEL.w;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      {/* the chair on the landfill, darkened to the left for the words */}
      <OffthreadVideo src={staticFile("clips/01g_chair_landfill.mp4")} trimBefore={90} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08) translateX(80px)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(14,20,36,0.97) 0%, rgba(14,20,36,0.9) 42%, rgba(14,20,36,0.35) 70%, rgba(14,20,36,0.15) 100%)" }} />

      {/* the gold seam */}
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#8a6514" /><stop offset="0.5" stopColor="#f3dfb2" /><stop offset="1" stopColor="#b8892b" /></linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        {[{ w: 12, f: "url(#glow)", o: 0.7 }, { w: 5, f: undefined, o: 1 }].map((l, i) => (
          <path key={i} d="M -20 600 L 180 560 L 260 590 L 420 520 L 520 548 L 640 470 L 700 495 L 760 430" fill="none" stroke="url(#g)" strokeWidth={l.w} strokeLinecap="round" strokeLinejoin="round" filter={l.f} opacity={l.o} />
        ))}
      </svg>

      {/* the words */}
      <div style={{ position: "absolute", left: 64, top: 58, width: 700 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Logo size={64} />
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 46, color: "#fff" }}>Kintsugi</span>
        </div>
        <div style={{ fontFamily: FONT_SANS, fontWeight: 800, fontSize: 104, lineHeight: 0.98, color: "#fff", marginTop: 30, letterSpacing: -2, textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
          Don't throw<br />it <span style={{ color: C.goldLight }}>out.</span>
        </div>
        <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: 36, color: "rgba(255,255,255,0.92)", marginTop: 22, lineHeight: 1.2 }}>
          Gemini finds every part<br />its next life, nearby
        </div>
      </div>

      {/* Gemini badge */}
      <div style={{ position: "absolute", left: 64, bottom: 44, display: "flex", alignItems: "center", gap: 12, background: "rgba(20,29,51,0.92)", border: `2px solid ${C.gold}`, borderRadius: 999, padding: "10px 22px", fontFamily: FONT_SANS, fontWeight: 700, fontSize: 28, color: "#fff" }}>
        <svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 1C12.6 7.2 16.8 11.4 23 12C16.8 12.6 12.6 16.8 12 23C11.4 16.8 7.2 12.6 1 12C7.2 11.4 11.4 7.2 12 1Z" fill={C.goldLight} /></svg>
        Built with Gemini
      </div>

      {/* the real app: Scout's findings */}
      <div style={{ position: "absolute", right: 150, top: 64, width: cardW, height: cardH, transform: "rotate(4deg)", borderRadius: 22, overflow: "hidden", background: C.porcelain, border: "8px solid #0b1020", boxShadow: "0 30px 70px rgba(0,0,0,0.6)" }}>
        <OffthreadVideo src={staticFile("rec/v1.mp4")} trimBefore={PANEL_AT_S * 30} muted
          style={{ position: "absolute", maxWidth: "none", width: REC_W * k, height: REC_H * k, left: -PANEL.x * k, top: -PANEL.y * k }} />
      </div>

      {/* you */}
      <div style={{ position: "absolute", right: 44, bottom: 40, width: 230, height: 230, borderRadius: "50%", overflow: "hidden", border: `6px solid ${C.goldLight}`, boxShadow: "0 14px 40px rgba(0,0,0,0.55)" }}>
        <Img src={staticFile("rec/thumb-face.png")} style={{ width: "112%", height: "112%", margin: "-6%", objectFit: "cover" }} />
      </div>
    </AbsoluteFill>
  );
}
