import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { api } from "./api";

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN", ta: "ta-IN", id: "id-ID", ja: "ja-JP" };

// An empty WAV, played inside the tap so the browser lets the real audio play once it arrives.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

let playing: HTMLAudioElement | null = null;
const audioUrls = new Map<string, string>(); // `${lang}|${text}` -> Gemini audio already fetched

/** Stop whatever Listen is reading. */
export async function stopSpeaking(): Promise<void> {
  playing?.pause();
  playing = null;
  try {
    await TextToSpeech.stop();
  } catch {
    /* nothing was speaking */
  }
}

/**
 * Read text aloud in the given language with Gemini's voice (from the API), falling back to the
 * device's own voice when the API has no audio, for example in offline mode. Resolves when reading
 * ends or is stopped; `onStart` fires when sound begins. Throws if neither voice is available.
 */
export async function speak(text: string, lang: string, onStart?: () => void): Promise<void> {
  const audio = new Audio(SILENT_WAV);
  audio.play().catch(() => undefined);
  await stopSpeaking();
  playing = audio;

  const key = `${lang}|${text}`;
  let url = audioUrls.get(key);
  if (!url) {
    const blob = await api.speech(text, lang).catch(() => null);
    if (blob) audioUrls.set(key, (url = URL.createObjectURL(blob)));
  }
  if (playing !== audio) return; // another Listen started while this one was loading

  if (url) {
    audio.src = url;
    const ended = new Promise<void>((resolve) => {
      audio.onended = audio.onpause = () => resolve();
    });
    await audio.play();
    onStart?.();
    return ended;
  }
  playing = null;
  onStart?.();
  await TextToSpeech.speak({ text, lang: LOCALE[lang] ?? lang, rate: 0.95 });
}
