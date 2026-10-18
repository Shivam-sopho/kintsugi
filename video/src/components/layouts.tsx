import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT_SANS } from "../theme";
import { Footage, PhoneFrame, Stage, Title, useIn } from "./ui";

/** A phone recording on the calm stage, with a short heading and lines beside it. */
export function PhoneScene({ file, heading, lines = [], rate = 1, volume = 0, children }: {
  file: string; heading?: string; lines?: { text: string; at: number }[]; rate?: number; volume?: number; children?: ReactNode;
}) {
  return (
    <Stage>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 120, paddingBottom: 110 }}>
        <div style={{ width: 640 }}>
          {heading && <Title size={64}>{heading}</Title>}
          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 22 }}>
            {lines.map((l) => <Point key={l.text} text={l.text} at={l.at} />)}
          </div>
        </div>
        <PhoneFrame height={840}>
          <Footage file={file} playbackRate={rate} volume={volume} />
        </PhoneFrame>
      </AbsoluteFill>
      {children}
    </Stage>
  );
}

/** One point beside the phone, appearing at frame `at`, with a gold bar. */
export function Point({ text, at }: { text: string; at: number }) {
  const t = useIn(at);
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", opacity: t, transform: `translateX(${(1 - t) * -20}px)` }}>
      <span style={{ width: 6, minHeight: 44, background: C.gold, borderRadius: 3, flex: "none" }} />
      <span style={{ fontFamily: FONT_SANS, fontSize: 34, color: "rgba(255,255,255,0.92)", lineHeight: 1.35 }}>{text}</span>
    </div>
  );
}

/** A laptop recording in a clean browser window. */
export function LaptopScene({ file, heading, children }: { file: string; heading?: string; children?: ReactNode }) {
  const t = useIn(0);
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 28, paddingBottom: 60 }}>
        {heading && <Title size={52}>{heading}</Title>}
        <div style={{ width: 1500, borderRadius: 16, overflow: "hidden", boxShadow: "0 40px 90px rgba(10,14,28,0.5)", opacity: t, transform: `scale(${0.97 + t * 0.03})` }}>
          <div style={{ height: 40, background: "#e9ebe7", display: "flex", alignItems: "center", gap: 10, padding: "0 16px" }}>
            {["#e06c5a", "#e8b84a", "#6fbf73"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
            <span style={{ marginLeft: 18, fontFamily: FONT_SANS, fontSize: 16, color: C.slate }}>kintsugi-ai-builder-cup-2026.web.app</span>
          </div>
          <div style={{ position: "relative", height: 800, background: C.porcelain }}>
            <Footage file={file} />
          </div>
        </div>
      </AbsoluteFill>
      {children}
    </Stage>
  );
}
