import { useEffect, useRef, useState } from "react";
import { api, audioFileName } from "../api";
import { speak, voiceRepliesOn } from "../speak";
import type { AppState, AskReply, Job } from "../types";
import { DEMO_CENTER, LANG_LABEL } from "../labels";
import BigMic from "./BigMic";

interface Message {
  from: "you" | "kintsugi";
  text: string;
  en?: string;
  reply?: AskReply;
}

interface Props {
  state: AppState;
  personaId: string;
  onOpenItem: (id: string) => void;
  onJob: (job: Job, onDone?: (j: Job) => void) => void;
  onGoToDeals: () => void;
}

const modelName = (m: string) => m.replace("gemini-", "Gemini ").replace("-flash", " Flash").replace("-pro", " Pro");

/** Ask Kintsugi: a spoken conversation with Gemini about your own items, takers and deals. */
export default function AskPanel({ state, personaId, onOpenItem, onJob, onGoToDeals }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [voice, setVoice] = useState<{ index: number; state: "preparing" | "speaking" } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(0); // messages shown so far, current even inside async handlers
  count.current = messages.length;
  const persona = state.participants.find((p) => p.id === personaId);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy]);

  const send = async (question: string, audio?: Blob) => {
    setNote(null);
    const form = new FormData();
    form.append("persona_id", personaId);
    form.append("question", question);
    form.append("lang", persona?.language ?? "en");
    form.append("history", JSON.stringify(messages.slice(-6).map((m) => ({ role: m.from, text: m.en ?? m.text }))));
    if (audio) form.append("file", new File([audio], audioFileName(audio), { type: audio.type }));
    if (question) setMessages((prev) => [...prev, { from: "you", text: question }]);
    setBusy(audio ? "Listening…" : messages.length ? "Thinking…" : "Looking at your items, deals and takers nearby…");
    try {
      const reply = await api.ask(form);
      const index = count.current + (reply.heard ? 1 : 0);
      setMessages((prev) => [
        ...prev,
        ...(reply.heard ? [{ from: "you" as const, text: reply.heard.text, en: reply.heard.english }] : []),
        { from: "kintsugi" as const, text: reply.answer, en: reply.answer_en, reply },
      ]);
      if (voiceRepliesOn()) void readAloud(reply, index);
    } catch (e) {
      setNote(`Couldn't answer: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const readAloud = async (reply: AskReply, index: number) => {
    setVoice({ index, state: "preparing" });
    try {
      await speak(reply.answer, reply.language, { onStart: () => setVoice({ index, state: "speaking" }) });
    } catch {
      setNote("Tap Listen to hear the answer.");
    } finally {
      setVoice((v) => (v?.index === index ? null : v));
    }
  };

  // Kintsugi speaks first, with one useful suggestion from your own data.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (reply: AskReply) => {
    const a = reply.action;
    setNote(null);
    try {
      if (a.type === "open_item" && a.item_id) return onOpenItem(a.item_id);
      if (a.type === "offer_item" && a.item_id) {
        onJob(await api.offerItem(a.item_id));
        setNote("Offered. The agents are negotiating now.");
        return onGoToDeals();
      }
      if (a.type === "autopilot_on" && a.item_id) {
        const item = state.items.find((i) => i.id === a.item_id);
        if (!item?.has_floor_price) {
          setNote("Set your lowest price on the item first, then turn on Autopilot there.");
          return onOpenItem(a.item_id);
        }
        onJob(await api.itemAutopilot(a.item_id, true));
        return setNote("Autopilot is on. Your agent will sell to matching buyers, never below your lowest price.");
      }
      if (a.type === "keep_looking" && a.query) {
        onJob(await api.createRequest({ buyer_id: personaId, query: a.query, lat: DEMO_CENTER.lat, lng: DEMO_CENTER.lng, radius_km: 10, auto_approve: false }));
        return setNote(`Saved. Kintsugi keeps looking for "${a.query}" and tells you about matches.`);
      }
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  return (
    <section className="ask">
      <p className="small muted">
        Talking as {persona?.name ?? "you"}. Kintsugi answers from your items, deals and the takers near you, in your language.
      </p>
      <div className="chat" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.from}`}>
            <p lang={m.from === "kintsugi" ? m.reply?.language : undefined}>{m.text}</p>
            {m.en && m.en !== m.text && <p className="small muted en">{m.en}</p>}
            {m.reply && (
              <>
                {m.reply.action.type !== "none" && (
                  <button className="primary gold small-btn" onClick={() => act(m.reply!)}>
                    {m.reply.action.label || "Do it"}
                  </button>
                )}
                <button type="button" className="link listen-again" onClick={() => void readAloud(m.reply!, i)}>
                  {voice?.index === i ? (voice.state === "preparing" ? "Preparing the voice…" : "Speaking…") : "Play again"}
                </button>
                <span className="gemini-chip">
                  {modelName(m.reply.used.model)} · looked at {m.reply.used.items} of your items, {m.reply.used.takers} takers nearby
                  {m.reply.heard?.language && m.reply.heard.language !== "en" ? ` · understood ${LANG_LABEL[m.reply.heard.language] ?? m.reply.heard.language}` : ""}
                </span>
              </>
            )}
          </div>
        ))}
        {busy && <div className="bubble kintsugi thinking"><span className="dots" aria-hidden="true"><i /><i /><i /></span> {busy}</div>}
        <div ref={end} />
      </div>
      {note && <p className="small" role="status">{note}</p>}
      <BigMic label="Tap and ask, in any language" busyLabel={busy} onAudio={(blob) => void send("", blob)} />
      <form className="search-row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { void send(text.trim()); setText(""); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type: what should I do with my old fan?" aria-label="Your question" />
        <button className="secondary" disabled={Boolean(busy)}>Ask</button>
      </form>
      <p className="small muted">Try: "Who will take my old cupboard?", "मेरे पास पुराना पंखा है", "ಹತ್ತಿರದಲ್ಲಿ ಇ-ತ್ಯಾಜ್ಯ ಎಲ್ಲಿ ಕೊಡಬಹುದು?"</p>
    </section>
  );
}
