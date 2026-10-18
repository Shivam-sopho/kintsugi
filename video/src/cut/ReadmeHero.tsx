import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { C, FONT_DISPLAY, FONT_SANS } from "../theme";
import { Logo, Stage } from "../components/ui";
import { REC_H, REC_W, type Cam } from "./edl";

// The README's hero image (docs/hero.png): render with `npm run readme-hero`.
// Three moments from the live-app recordings, each cropped above the face cam.
const CARDS: { src: string; at: number; crop: Cam; label: string }[] = [
  { src: "v1", at: 190, crop: { x: 2150, y: 405, w: 874, h: 1035 }, label: "Scout sees each part" },
  { src: "v2", at: 112, crop: { x: 2150, y: 405, w: 874, h: 1035 }, label: "Agents negotiate (A2A)" },
  { src: "v2", at: 137, crop: { x: 990, y: 420, w: 1040, h: 1232 }, label: "Handed over, counted" },
];

const GEMINI = ["Gemini 2.5 Pro", "Gemini 2.5 Flash", "Flash Image", "Gemini TTS", "Gemini Embedding"];

export default function ReadmeHero() {
  const cardW = 370, cardH = (cardW * 1035) / 874;
  const cardX = (i: number) => 690 + i * 265;
  return (
    <Stage>
      <svg width={1600} height={800} style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
        <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#8a6514" /><stop offset="0.5" stopColor="#f3dfb2" /><stop offset="1" stopColor="#b8892b" /></linearGradient></defs>
        <path d="M -20 700 L 160 660 L 240 690 L 380 610 L 470 640 L 600 560 L 680 590 L 820 500" fill="none" stroke="url(#g)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div style={{ position: "absolute", left: 64, top: 90, width: 580, fontFamily: FONT_SANS, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Logo size={78} />
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 76 }}>Kintsugi</span>
        </div>
        <div style={{ fontSize: 32, fontWeight: 600, color: C.goldLight, marginTop: 14 }}>Google Maps for the circular economy</div>
        <div style={{ fontSize: 27, lineHeight: 1.45, marginTop: 30, color: "rgba(255,255,255,0.9)" }}>
          Film anything you'd throw away. Gemini agents find each part's best next life nearby, and negotiate the hand-over in each person's language.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 34 }}>
          {GEMINI.map((g) => (
            <span key={g} style={{ fontSize: 20, fontWeight: 600, padding: "8px 16px", borderRadius: 999, background: "rgba(20,29,51,0.9)", border: `1px solid ${C.gold}`, color: C.goldLight }}>{g}</span>
          ))}
        </div>
        <div style={{ marginTop: 34, display: "inline-block", fontSize: 22, fontWeight: 700, padding: "12px 22px", borderRadius: 999, background: C.gold }}>
          kintsugi-ai-builder-cup-2026.web.app
        </div>
      </div>

      {CARDS.map((c, i) => {
        const k = cardW / c.crop.w;
        return (
          <div key={i} style={{ position: "absolute", left: cardX(i), top: [150, 105, 165][i], transform: `rotate(${[-4, 0, 4][i]}deg)`, zIndex: i === 1 ? 2 : 1 }}>
            <div style={{ width: cardW, height: cardH, borderRadius: 22, overflow: "hidden", position: "relative", background: C.porcelain, border: "7px solid #0b1020", boxShadow: "0 30px 70px rgba(0,0,0,0.6)" }}>
              <OffthreadVideo src={staticFile(`rec/${c.src}.mp4`)} trimBefore={c.at * 30} muted
                style={{ position: "absolute", maxWidth: "none", width: REC_W * k, height: REC_H * k, left: -c.crop.x * k, top: -c.crop.y * k }} />
            </div>
          </div>
        );
      })}
      {CARDS.map((c, i) => (
        <div key={c.label} style={{ position: "absolute", left: cardX(i) + cardW / 2 - 125, top: 655, width: 250, zIndex: 3, textAlign: "center", fontFamily: FONT_SANS, fontSize: 19, fontWeight: 700, color: "#fff" }}>
          <span style={{ color: C.goldLight, marginRight: 8 }}>{i + 1}</span>{c.label}
        </div>
      ))}
      <AbsoluteFill style={{ pointerEvents: "none" }} />
    </Stage>
  );
}
