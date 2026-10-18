import { useEffect, useState } from "react";
import { api } from "../api";
import type { Explanation, Item } from "../types";
import { RUNG_COLOR, RUNG_LABEL, sentence } from "../labels";
import { RungIcon } from "./Icons";
import ListenButton from "./ListenButton";
import Problem from "./Problem";
import { LANGUAGES, languageName, preferredLanguage } from "../language";

const EXPLAIN_VERSION = "v4"; // matches the backend's cache key
const YOU_CAN: Record<string, string> = {
  en: "You can", hi: "आप क्या कर सकते हैं", kn: "ನೀವು ಮಾಡಬಹುದಾದದ್ದು", ta: "நீங்கள் செய்யக்கூடியவை",
  id: "Yang bisa Anda lakukan", ms: "Apa yang anda boleh lakukan", th: "สิ่งที่คุณทำได้", vi: "Bạn có thể",
  fil: "Ang magagawa mo", ja: "あなたにできること",
};
const KNOWN = new Set(LANGUAGES.map(([c]) => c));

/** "What becomes of it": Gemini explains, in plain words and the person's language, where each
 *  part goes and what happens to it there. The routes themselves were decided by the rules. */
export default function ExplainCard({ item }: { item: Item }) {
  const preferred = preferredLanguage();
  const first = preferred ?? (KNOWN.has(item.language) ? item.language : "en");
  // Quick choices: the person's language, the language the item was described in, and English.
  const quick = [...new Set([first, item.language, "en", "hi", "kn"].filter((c) => KNOWN.has(c)))].slice(0, 4);
  const [lang, setLang] = useState(first);
  const cachedFor = (l: string) => item.explanation?.[`${EXPLAIN_VERSION}:${l}`];
  const [data, setData] = useState<Explanation | null>(cachedFor(first) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    const cached = cachedFor(lang);
    if (cached) {
      setData(cached);
      return;
    }
    setData(null);
    api.explain(item.id, lang)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.explanation, lang, attempt]);

  const ideas = data?.afterlives ?? [];
  const readOut = data ? [...ideas.map((a) => `${a.use}.`), data.headline, ...data.parts.map((p) => `${p.part}: ${p.happens}`), data.why].join(" ") : "";
  return (
    <section className="explain" aria-live="polite">
      <div className="explain-head">
        <h3>What a {item.type} can become</h3>
        <div className="lang-chips" role="group" aria-label="Language">
          {quick.map((code) => (
            <button key={code} type="button" className={lang === code ? "on" : ""} aria-pressed={lang === code} onClick={() => setLang(code)}>
              {languageName(code)}
            </button>
          ))}
          <select value={quick.includes(lang) ? "" : lang} onChange={(e) => e.target.value && setLang(e.target.value)} aria-label="More languages">
            <option value="">More…</option>
            {LANGUAGES.filter(([c]) => !quick.includes(c)).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
      </div>
      {!data && !error && (
        <div className="explain-loading">
          <span className="dots" aria-hidden="true"><i /><i /><i /></span> Gemini is working out what each part becomes…
        </div>
      )}
      <Problem text={error} small onRetry={() => setAttempt((n) => n + 1)} />
      {data && (
        <div lang={lang}>
          {ideas.length > 0 && (
            <ol className="afterlives" aria-label="Possible next lives, best first">
              {ideas.map((a, i) => (
                <li key={i} className={a.best ? "best" : ""} style={{ ["--rung" as string]: RUNG_COLOR[a.next_life] }}>
                  <span className="rung-tag"><RungIcon rung={a.next_life} /> {RUNG_LABEL[a.next_life]}</span>
                  <strong>{sentence(a.use)}</strong>
                  <span className="small muted">{a.how}</span>
                  {a.best && <span className="best-note">Best for yours{item.next_life_reason ? `: ${item.next_life_reason}` : ""}</span>}
                </li>
              ))}
            </ol>
          )}
          <h4 className="yours">What becomes of yours</h4>
          <p className="explain-headline">{data.headline}</p>
          <ol className="flow-list">
            {data.parts.map((p, i) => (
              <li key={i}>
                <span className="flow-part">{p.part}</span>
                {p.goes_to && <span className="flow-to">{p.goes_to}</span>}
                <span className="flow-happens">{p.happens}</span>
              </li>
            ))}
          </ol>
          {data.you_can.length > 0 && (
            <>
              <h4>{YOU_CAN[lang] ?? YOU_CAN.en}</h4>
              <ul className="you-can">{data.you_can.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </>
          )}
          <p className="why">{data.why}</p>
          <div className="row between">
            <ListenButton text={readOut} lang={lang} auto />
            <span className="gemini-chip">Written by Gemini 2.5 Flash from the routes the rules chose</span>
          </div>
        </div>
      )}
    </section>
  );
}
