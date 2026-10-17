import { useState } from "react";
import { speak, stopSpeaking } from "../speak";

interface Props {
  text: string;
  lang: string;
  className?: string;
}

/** Reads text aloud with Gemini's voice. Gemini takes a few seconds per line, so the button says so. */
export default function ListenButton({ text, lang, className = "secondary" }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (state !== "idle") {
      await stopSpeaking();
      return setState("idle");
    }
    setError(null);
    setState("loading");
    try {
      await speak(text, lang, () => setState("playing"));
    } catch {
      setError("This device has no voice for this language. The text is above.");
    }
    setState("idle");
  };

  return (
    <>
      <button type="button" className={className} onClick={toggle} aria-label={state === "idle" ? "Listen" : "Stop"}>
        {state === "loading" ? "Preparing audio…" : state === "playing" ? "Stop" : "Listen"}
      </button>
      {error && <span className="small error block">{error}</span>}
    </>
  );
}
