/** The languages Kintsugi speaks and explains in: India first, then Southeast and East Asia. */
export const LANGUAGES: [code: string, name: string][] = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["kn", "ಕನ್ನಡ"],
  ["ta", "தமிழ்"],
  ["id", "Bahasa Indonesia"],
  ["ms", "Bahasa Melayu"],
  ["th", "ไทย"],
  ["vi", "Tiếng Việt"],
  ["fil", "Filipino"],
  ["ja", "日本語"],
];

export const languageName = (code: string) => LANGUAGES.find(([c]) => c === code)?.[1] ?? code;

const KEY = "kintsugi.language";

/** The language this person picked in their profile, if any (Kintsugi answers in English otherwise). */
export function preferredLanguage(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setPreferredLanguage(code: string | null): void {
  try {
    if (code) localStorage.setItem(KEY, code);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: lasts for this visit only */
  }
}

/** "Answer in the language I speak": a profile choice, not the default. */
export const FOLLOW_SPEECH = "auto";

/**
 * The language Kintsugi answers in: English unless the person chose another in their profile, or
 * chose to be answered in whatever language they speak (then `spoken`, if known).
 */
export function replyLanguage(spoken?: string | null): string {
  const pref = preferredLanguage();
  if (pref === FOLLOW_SPEECH) return spoken || "en";
  return pref || "en";
}
