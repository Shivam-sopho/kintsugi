import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { api } from "./api";

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN", ta: "ta-IN", id: "id-ID", ms: "ms-MY", th: "th-TH",
  vi: "vi-VN", fil: "fil-PH", ja: "ja-JP" };

// An empty WAV. Phones only let a page start sound from a tap, so the first tap anywhere plays
// this on the one shared player; after that, replies that arrive seconds later can play on it.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
const VOICE_KEY = "kintsugi.voiceReplies";

let player: HTMLAudioElement | null = null;
let unlocked = false;
let turn = 0; // each reading gets a number; a newer reading cancels older ones still loading
const fetched = new Map<string, { url: string | null; spoken: string }>(); // Gemini audio already fetched

function shared(): HTMLAudioElement {
  if (!player) player = new Audio();
  return player;
}

/** Call from a tap: unlocks the shared player so later replies can be heard. */
export function unlockAudio(): void {
  if (unlocked) return;
  const a = shared();
  a.src = SILENT_WAV;
  a.play().then(() => (unlocked = true)).catch(() => undefined);
}

/** Whether Kintsugi reads its answers aloud on its own (the speaker switch in the top bar). */
export function voiceRepliesOn(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setVoiceReplies(on: boolean): void {
  try {
    localStorage.setItem(VOICE_KEY, on ? "on" : "off");
  } catch {
    /* private mode: the switch lasts for this visit only */
  }
  if (!on) void stopSpeaking();
}

/** Stop whatever is being read, and anything still loading. */
export async function stopSpeaking(): Promise<void> {
  turn += 1;
  player?.pause();
  try {
    await TextToSpeech.stop();
  } catch {
    /* nothing was speaking */
  }
}

interface Options {
  translate?: boolean; // text is English; read it in `lang`
  onStart?: () => void; // sound begins
  onSpoken?: (text: string) => void; // the words actually read, e.g. the translation
}

/**
 * Read text aloud in the given language with Gemini's voice (from the API), falling back to the
 * device's own voice when the API has no audio, for example in offline mode. Resolves when reading
 * ends or is stopped. Throws if neither voice can play.
 */
export async function speak(text: string, lang: string, opts: Options = {}): Promise<void> {
  unlockAudio(); // when called straight from a tap, this is what lets the sound play later
  await stopSpeaking();
  const mine = turn;

  const key = `${lang}|${opts.translate ? 1 : 0}|${text}`;
  let hit = fetched.get(key);
  if (!hit) {
    const res = await api.speech(text, lang, opts.translate).catch(() => null);
    hit = { url: res?.audio ? URL.createObjectURL(res.audio) : null, spoken: res?.spoken ?? text };
    if (hit.url) fetched.set(key, hit);
  }
  if (mine !== turn) return; // another reading started while this one was loading
  opts.onSpoken?.(hit.spoken);

  if (hit.url) {
    const audio = shared();
    audio.src = hit.url;
    const ended = new Promise<void>((resolve) => {
      audio.onended = audio.onpause = () => resolve();
    });
    await audio.play();
    unlocked = true;
    opts.onStart?.();
    return ended;
  }
  opts.onStart?.();
  // Offline the words stay English, so read them with an English voice.
  const voiceLang = opts.translate && hit.spoken === text ? "en" : lang;
  await TextToSpeech.speak({ text: hit.spoken, lang: LOCALE[voiceLang] ?? voiceLang, rate: 0.95 });
}

/** Kintsugi answering out loud: an English summary read in the person's language, if replies are on. */
export async function say(textEn: string, lang: string, onSpoken?: (text: string) => void): Promise<void> {
  if (!voiceRepliesOn()) return;
  try {
    await speak(textEn, lang, { translate: lang !== "en", onSpoken });
  } catch {
    /* no voice on this device: the summary is on screen */
  }
}
