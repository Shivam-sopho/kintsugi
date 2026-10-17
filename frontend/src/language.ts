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

/** The language this person picked in their profile, if any; otherwise Kintsugi follows their voice. */
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
