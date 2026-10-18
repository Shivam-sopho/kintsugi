import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import { C, FONT_SANS } from "../theme";
import { has } from "../clips";
import { SUBTITLES, scriptCaptions } from "../data/voiceover";

const CaptionsContext = createContext<Caption[]>([]);
export const useCaptions = () => useContext(CaptionsContext);

/** The voiceover's words: whisper.cpp's timings if public/voiceover.captions.json exists, else the script's. */
export function CaptionsProvider({ children }: { children: ReactNode }) {
  const real = has("voiceover.captions.json");
  const [captions, setCaptions] = useState<Caption[]>(real ? [] : scriptCaptions());
  const [handle] = useState(() => (real ? delayRender("Loading the voiceover captions") : null));
  useEffect(() => {
    if (!real || handle === null) return;
    fetch(staticFile("voiceover.captions.json"))
      .then((r) => r.json())
      .then((c: Caption[]) => {
        setCaptions(c);
        continueRender(handle);
      })
      .catch(() => {
        setCaptions(scriptCaptions());
        continueRender(handle);
      });
  }, [real, handle]);
  return <CaptionsContext.Provider value={captions}>{children}</CaptionsContext.Provider>;
}

/** Burned-in captions: a phrase at a time, the word being said in gold; and the Hindi lines subtitled. */
export function CaptionsOverlay() {
  const captions = useCaptions();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const { pages } = useMemo(() => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 1400 }), [captions]);
  const page = pages.find((p) => ms >= p.startMs && ms < p.startMs + p.durationMs);
  const sub = SUBTITLES.find((x) => ms >= x.start * 1000 && ms < x.end * 1000);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 56, pointerEvents: "none" }}>
      {sub ? (
        <div style={box}>
          {sub.original && <div style={{ fontSize: 36, fontWeight: 600, marginBottom: 6 }}>{sub.original}</div>}
          <div style={{ fontSize: sub.original ? 30 : 36, fontStyle: "italic", color: C.goldLight }}>{sub.english}</div>
        </div>
      ) : page ? (
        <div style={box}>
          {page.tokens.map((t, i) => {
            const now = ms >= t.fromMs && ms < t.toMs;
            return (
              <span key={i} style={{ color: now ? C.goldLight : "#fff", transition: "none" }}>{t.text}</span>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

const box: React.CSSProperties = {
  maxWidth: 1500, textAlign: "center", fontFamily: FONT_SANS, fontSize: 40, fontWeight: 600, lineHeight: 1.35, color: "#fff",
  background: "rgba(12, 17, 32, 0.62)", borderRadius: 14, padding: "10px 26px", whiteSpace: "pre-wrap",
  textShadow: "0 2px 6px rgba(0,0,0,0.45)",
};
