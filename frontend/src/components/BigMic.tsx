import { useRecorder } from "../useRecorder";

interface Props {
  label: string; // what to say, e.g. "Tap and tell Kintsugi what you have"
  busyLabel?: string | null; // shown while the answer is being worked out
  onAudio: (blob: Blob) => void;
}

/** The main way into Kintsugi: tap, talk in any language, tap again. */
export default function BigMic({ label, busyLabel, onAudio }: Props) {
  const { recording, seconds, error, start, stop } = useRecorder();

  const toggle = async () => {
    if (!recording) return void (await start());
    const blob = await stop();
    if (blob) onAudio(blob);
  };

  const busy = Boolean(busyLabel) && !recording;
  return (
    <div className="big-mic">
      <button
        type="button"
        className={`big-mic-btn ${recording ? "rec" : ""} ${busy ? "busy" : ""}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={recording}
        aria-label={recording ? "Stop and send" : label}
      >
        <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <p className="big-mic-label" role="status">
        {recording ? `Listening… tap to finish (${seconds}s)` : busy ? busyLabel : label}
      </p>
      {error && <p className="small error">{error}</p>}
    </div>
  );
}
