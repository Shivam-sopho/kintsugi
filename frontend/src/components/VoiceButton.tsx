import { useState } from "react";
import { api } from "../api";
import { useRecorder } from "../useRecorder";
import type { Transcript } from "../types";
import { problemText, LANG_LABEL } from "../labels";

/** Tap to talk in any language; the transcript goes into the field next to it. */
export default function VoiceButton({ hint, onResult, label = "Speak" }: { hint: string; onResult: (t: Transcript) => void; label?: string }) {
  const { recording, seconds, error, start, stop } = useRecorder();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const toggle = async () => {
    setNote(null);
    if (!recording) return void (await start());
    const blob = await stop();
    if (!blob) return;
    setBusy(true);
    try {
      const t = await api.transcribe(blob, hint);
      onResult(t);
      setNote(t.language && t.language !== "en" ? `Heard in ${LANG_LABEL[t.language] ?? t.language}: ${t.english}` : null);
    } catch (e) {
      setNote(problemText(`Couldn't transcribe: ${(e as Error).message}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="voice">
      <button type="button" className={`mic ${recording ? "rec" : ""}`} onClick={toggle} disabled={busy}
              aria-label={recording ? "Stop recording" : label} aria-pressed={recording}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        {busy ? "Listening…" : recording ? `Stop ${seconds}s` : label}
      </button>
      {(error || note) && <span className="small muted block">{error ?? note}</span>}
    </span>
  );
}
