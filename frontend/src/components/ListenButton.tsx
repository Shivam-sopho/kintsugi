import { useEffect, useRef, useState } from "react";
import { speak, stopSpeaking, voiceRepliesOn } from "../speak";

interface Props {
  text: string;
  lang: string;
  className?: string;
  auto?: boolean; // read it out as soon as it appears (when voice replies are on); the button replays it
}

/** Reads text aloud with Gemini's voice. Gemini takes a few seconds per line, so the button says so. */
export default function ListenButton({ text, lang, className = "secondary", auto = false }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [played, setPlayed] = useState(false);
  const readFor = useRef<string | null>(null);

  const mine = useRef(false); // this button is the one reading
  const play = async (byItself = false) => {
    setError(null);
    setState("loading");
    mine.current = true;
    try {
      await speak(text, lang, { onStart: () => setState("playing") });
      setPlayed(true);
    } catch {
      // Reading by itself can be blocked until the first tap; the button is there for that.
      if (!byItself) setError("This device has no voice for this language. The text is above.");
    }
    mine.current = false;
    setState("idle");
  };

  // Closing the screen stops its reading.
  useEffect(() => () => {
    if (mine.current) void stopSpeaking();
  }, []);

  // Nobody should have to tap Listen: new text is read out on its own, once.
  useEffect(() => {
    const key = `${lang}|${text}`;
    if (!auto || !text || readFor.current === key || !voiceRepliesOn()) return;
    readFor.current = key;
    void play(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, text, lang]);

  const toggle = async () => {
    if (state !== "idle") {
      await stopSpeaking();
      return setState("idle");
    }
    await play();
  };

  return (
    <>
      <button type="button" className={className} onClick={toggle} aria-label={state === "idle" ? (played || auto ? "Play again" : "Listen") : "Stop"}>
        {state === "loading" ? "Preparing the voice…" : state === "playing" ? "Stop" : played || auto ? "Play again" : "Listen"}
      </button>
      {error && <span className="small error block">{error}</span>}
    </>
  );
}
