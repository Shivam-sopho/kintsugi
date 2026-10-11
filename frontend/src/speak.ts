import { TextToSpeech } from "@capacitor-community/text-to-speech";

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN", ta: "ta-IN", id: "id-ID", ja: "ja-JP" };

/** Read text aloud in the given language: native speech in the Android app, the browser's elsewhere. */
export async function speak(text: string, lang: string): Promise<void> {
  try {
    await TextToSpeech.stop();
    await TextToSpeech.speak({ text, lang: LOCALE[lang] ?? lang, rate: 0.95 });
  } catch {
    // No voice for this language on this device: fail quietly, the text is on screen.
  }
}
