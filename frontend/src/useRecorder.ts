import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SECONDS = 30;

/** Record from the microphone (works in browsers and in the Android app's web view). */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const resolver = useRef<((b: Blob | null) => void) | null>(null);
  const timer = useRef<number | null>(null);

  const cleanup = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    rec.current?.stream.getTracks().forEach((t) => t.stop());
    rec.current = null;
    setRecording(false);
  };

  useEffect(() => cleanup, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This device can't record audio here.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const blob = chunks.current.length ? new Blob(chunks.current, { type: r.mimeType || "audio/webm" }) : null;
        cleanup();
        resolver.current?.(blob);
        resolver.current = null;
      };
      rec.current = r;
      r.start();
      setSeconds(0);
      setRecording(true);
      timer.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) rec.current?.state === "recording" && rec.current.stop();
          return s + 1;
        });
      }, 1000);
      return true;
    } catch {
      setError("Microphone access was not allowed.");
      cleanup();
      return false;
    }
  }, []);

  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        if (!rec.current || rec.current.state !== "recording") return resolve(null);
        resolver.current = resolve;
        rec.current.stop();
      }),
    [],
  );

  return { recording, seconds, error, start, stop };
}
