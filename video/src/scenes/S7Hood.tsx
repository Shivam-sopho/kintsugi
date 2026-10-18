import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT_SANS, s } from "../theme";
import { Stage, Title } from "../components/ui";
import { LaptopScene } from "../components/layouts";
import { useCaptions } from "../components/Captions";
import { whenSaid } from "../data/voiceover";

const SCENE_START = 146; // seconds into the video

type Key = "phone" | "run" | "oracle" | "scout" | "architect" | "market" | "ledger" | "pro" | "flash" | "image" | "tts" | "embed" | "firestore" | "storage" | "maps";

const NODES: Record<Key, { x: number; y: number; label: string; sub?: string; kind: "app" | "agent" | "model" | "cloud" }> = {
  phone: { x: 170, y: 560, label: "Phone", sub: "web and Android", kind: "app" },
  run: { x: 490, y: 560, label: "Cloud Run", sub: "FastAPI", kind: "cloud" },
  oracle: { x: 830, y: 300, label: "Oracle", kind: "agent" },
  scout: { x: 830, y: 430, label: "Scout", kind: "agent" },
  architect: { x: 830, y: 560, label: "Architect", kind: "agent" },
  market: { x: 830, y: 690, label: "Market", sub: "two agents over A2A", kind: "agent" },
  ledger: { x: 830, y: 820, label: "Ledger", kind: "agent" },
  pro: { x: 1240, y: 300, label: "Gemini 2.5 Pro", sub: "sees and reads", kind: "model" },
  flash: { x: 1240, y: 430, label: "Gemini 2.5 Flash", sub: "Google Search, negotiation", kind: "model" },
  image: { x: 1240, y: 560, label: "Flash Image", sub: "draws", kind: "model" },
  tts: { x: 1240, y: 690, label: "Flash TTS", sub: "speaks ten languages", kind: "model" },
  embed: { x: 1240, y: 820, label: "Embedding 2", sub: "search by meaning", kind: "model" },
  firestore: { x: 1650, y: 400, label: "Firestore", sub: "vector search", kind: "cloud" },
  storage: { x: 1650, y: 560, label: "Cloud Storage", kind: "cloud" },
  maps: { x: 1650, y: 720, label: "Google Maps", sub: "Places", kind: "cloud" },
};

const EDGES: [Key, Key][] = [
  ["phone", "run"], ["run", "oracle"], ["run", "scout"], ["run", "architect"], ["run", "market"], ["run", "ledger"],
  ["oracle", "pro"], ["scout", "pro"], ["scout", "flash"], ["scout", "embed"], ["architect", "pro"], ["architect", "image"],
  ["market", "flash"], ["market", "tts"], ["ledger", "tts"], ["embed", "firestore"], ["ledger", "storage"], ["scout", "maps"],
];

/** Scene 7 (2:26–2:46): under the hood, each model lighting up as the voiceover names it. */
export default function S7Hood() {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={s(17)}><Diagram /></Sequence>
      <Sequence from={s(17)} durationInFrames={s(3)}>
        <LaptopScene file="07_run_demo.mp4" heading="And it's live today" />
      </Sequence>
    </AbsoluteFill>
  );
}

function Diagram() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const captions = useCaptions();
  // When each part is named (from the voiceover's word timings, else the script's), in this scene's frames.
  const at = (word: string, fallback: number) => Math.round((whenSaid(captions, word, SCENE_START, fallback) - SCENE_START) * fps);
  const cue: Record<Key, number> = {
    phone: 0, run: at("runs", 161.8),
    oracle: at("agents", 147.8), scout: at("agents", 147.8) + 4, architect: at("agents", 147.8) + 8, market: at("agents", 147.8) + 12, ledger: at("agents", 147.8) + 16,
    pro: at("pro", 149.6), flash: at("flash", 151.4), image: at("image", 155.2), tts: at("tts", 156.8), embed: at("embedding", 159.0),
    firestore: at("firestore", 162.6), storage: at("firestore", 162.6) + 6, maps: at("maps", 163.6),
  };
  const lit = (k: Key) => spring({ frame: frame - cue[k], fps, config: { damping: 200 } });
  // The part being named right now glows brightest for a moment.
  const hot = (k: Key) => interpolate(frame - cue[k], [0, 10, 45], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 60 }}>
        <Title size={56}>Under the hood</Title>
      </AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {EDGES.map(([a, b]) => {
          const A = NODES[a], B = NODES[b];
          const on = Math.min(lit(a), lit(b));
          const mx = (A.x + B.x) / 2;
          return (
            <path key={`${a}-${b}`} d={`M ${A.x + 120} ${A.y} C ${mx} ${A.y}, ${mx} ${B.y}, ${B.x - 120} ${B.y}`} fill="none"
              stroke={on > 0.5 ? C.gold : "rgba(255,255,255,0.14)"} strokeWidth={on > 0.5 ? 3 : 2} opacity={0.35 + on * 0.5} />
          );
        })}
      </svg>
      {(Object.keys(NODES) as Key[]).map((k) => <Node key={k} k={k} lit={lit(k)} hot={hot(k)} />)}
    </Stage>
  );
}

function Node({ k, lit, hot }: { k: Key; lit: number; hot: number }) {
  const n = NODES[k];
  const accent = n.kind === "model" ? C.gold : n.kind === "agent" ? C.celadon : C.goldLight;
  return (
    <div style={{
      position: "absolute", left: n.x - 120, top: n.y - 44, width: 240, height: 88, borderRadius: 16,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
      fontFamily: FONT_SANS, color: "#fff",
      background: `rgba(255,255,255,${0.05 + lit * 0.07})`,
      border: `2px solid ${lit > 0.5 ? accent : "rgba(255,255,255,0.18)"}`,
      boxShadow: `0 0 ${10 + hot * 40}px rgba(184,137,43,${0.15 * lit + hot * 0.6})`,
      opacity: 0.4 + lit * 0.6, transform: `scale(${1 + hot * 0.06})`,
    }}>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{n.label}</div>
      {n.sub && <div style={{ fontSize: 17, opacity: 0.75 }}>{n.sub}</div>}
    </div>
  );
}
