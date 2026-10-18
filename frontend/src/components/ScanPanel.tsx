import { useEffect, useRef, useState } from "react";
import { preferredLanguage } from "../language";
import { api, audioFileName } from "../api";
import { compressForUpload, MAX_UPLOAD_BYTES, megabytes } from "../compress";
import { say } from "../speak";
import type { AppState, Job } from "../types";
import { scanSummary } from "../labels";
import { locateMe, useWhere } from "../where";
import BigMic from "./BigMic";
import Problem from "./Problem";
import ItemCard from "./ItemCard";

interface Props {
  state: AppState;
  sellerId: string;
  situation?: Situation;
  onJob: (job: Job, onDone?: (j: Job) => void) => void;
  onOpenItem: (id: string) => void;
}

export type Situation = "moving" | "renovating" | "demolishing";

/** The three moments when homes and buildings shed the most: each sets up the scan and a tip. */
export const SITUATIONS: Record<Situation, { label: string; kind: "home" | "building"; name: string; tip: string }> = {
  moving: { label: "Moving home", kind: "home", name: "My home",
    tip: "Film each thing you won't take with you: furniture, appliances, utensils. Say what's broken." },
  renovating: { label: "Renovating", kind: "home", name: "My renovation",
    tip: "Film what's coming out: doors, windows, tiles, fittings, wiring. Tap tiles near the mic to check for hollow ones." },
  demolishing: { label: "Demolishing a building", kind: "building", name: "My site",
    tip: "Walk slowly through every room. Scout lists each door, window, fitting and fixture, and flags suspected hazards." },
};

/** Says why location failed: browsers give a numeric code, the Android plugin a message. */
/** "I have something": talk, film or photograph it, and Scout lists it and finds each part's next life. */
export default function ScanPanel({ state, sellerId, situation = "moving", onJob, onOpenItem }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<"home" | "building">("home");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const where = useWhere();
  const [locNote, setLocNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resultSite, setResultSite] = useState<string | null>(null);
  const [spoken, setSpoken] = useState<string | null>(null);
  const announced = useRef<string | null>(null);

  // The situation chosen on Home sets what kind of scan this is.
  useEffect(() => {
    setKind(SITUATIONS[situation].kind);
    setName("");
  }, [situation]);

  const results = resultSite ? state.items.filter((i) => i.site_id === resultSite) : [];

  // Answer out loud once the scan's items have arrived, in the language the person spoke.
  useEffect(() => {
    if (!resultSite || announced.current === resultSite) return;
    announced.current = resultSite;
    const lang = preferredLanguage() ?? (results[0]?.language || "en");
    setSpoken(null);
    void say(scanSummary(results), lang, (t) => lang !== "en" && setSpoken(t));
  }, [resultSite, results]);

  const add = (list: FileList | null) => list && setFiles((prev) => [...prev, ...Array.from(list)]);

  const useMyLocation = async () => {
    setLocNote("Finding your location…");
    try {
      await locateMe();
      setLocNote(null);
    } catch (err) {
      setLocNote(`${(err as Error).message} Using the demo location in Bengaluru for now.`);
    }
  };

  const scan = async (all: File[]) => {
    if (!all.length) return setError("Talk about it, film it or add a photo first.");
    setError(null);
    setResultSite(null);
    // Shrink videos and large photos first: the API takes at most about 30 MB per scan.
    const ready: File[] = [];
    for (const [i, f] of all.entries()) {
      const label = f.type.startsWith("video/") ? "video" : f.type.startsWith("audio/") ? "voice note" : "photo";
      const of = all.length > 1 ? ` ${i + 1} of ${all.length}` : "";
      setBusy(`Making the ${label}${of} smaller…`);
      ready.push(await compressForUpload(f, (p) => setBusy(`Making the ${label}${of} smaller… ${Math.round(p * 100)}%`)));
    }
    const total = ready.reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_UPLOAD_BYTES) {
      setBusy(null);
      return setError(`These files are ${megabytes(total)}, more than the ${megabytes(MAX_UPLOAD_BYTES)} a scan can take. Film a shorter clip or choose fewer photos.`);
    }
    setBusy("Scout is looking…");
    const form = new FormData();
    ready.forEach((f) => form.append("files", f));
    form.append("kind", kind);
    form.append("name", name || SITUATIONS[situation].name);
    form.append("lat", String(where.lat));
    form.append("lng", String(where.lng));
    form.append("seller_id", sellerId);
    if (notes) form.append("narration_text", notes);
    try {
      const job = await api.scan(form);
      onJob(job, (done) => {
        setBusy(null);
        if (done.status === "done") {
          setFiles([]);
          setNotes("");
          setResultSite(String(done.result.site_id));
        } else setError(done.error ?? "The scan failed.");
      });
    } catch (err) {
      setBusy(null);
      setError((err as Error).message);
    }
  };

  // Talking is the quickest way in: the voice note goes straight to Scout with anything already added.
  const onVoice = (blob: Blob) => void scan([...files, new File([blob], audioFileName(blob), { type: blob.type })]);

  const readNotice = async (file: File | undefined) => {
    if (!file) return;
    setNotice("Oracle is reading the notice…");
    try {
      const job = await api.oracle(file);
      onJob(job, (done) => {
        const n = ((done.result.prediction_ids as string[]) ?? []).length;
        setNotice(done.status === "done" ? (n ? `Added ${n} future pin${n > 1 ? "s" : ""} to the map.` : "Nothing new: those are already on the map.") : done.error ?? "Couldn't read it.");
      });
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  return (
    <div className="flow">
      <BigMic label="Tap and tell Kintsugi what you have, in any language" busyLabel={busy} onAudio={onVoice} />
      <p className="tip small">{SITUATIONS[situation].tip}</p>

      <div className="capture">
        <label className="capture-btn">
          <input type="file" accept="video/*" capture="environment" onChange={(e) => add(e.target.files)} />
          Film it
        </label>
        <label className="capture-btn quiet">
          <input type="file" accept="image/*,video/*" multiple onChange={(e) => add(e.target.files)} />
          Add photos
        </label>
      </div>

      {files.length > 0 && (
        <>
          <ul className="file-list">
            {files.map((f, i) => (
              <li key={i}>
                <span>{f.type.startsWith("audio/") ? "Voice note" : f.name}</span>
                <button type="button" className="link" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
              </li>
            ))}
          </ul>
          <p className="small muted">Talk about it with the mic to add what's broken or what it's made of, or scan it now.</p>
          <button type="button" className="primary wide" disabled={Boolean(busy)} onClick={() => scan(files)}>
            {busy ?? "Scan with Scout"}
          </button>
        </>
      )}

      <p className="small muted where">
        {locNote ?? (where.mine ? "Near your current location." : "Near the demo location in Bengaluru.")} <button type="button" className="link" onClick={useMyLocation}>Use my location</button>
      </p>
      <Problem text={error} />

      {resultSite && (
        <section className="results" aria-live="polite">
          <h3>{results.length ? `Scout found ${results.length} ${results.length === 1 ? "item" : "items"}` : "Nothing listed"}</h3>
          {spoken && <p className="spoken">{spoken}</p>}
          {results.length > 0 && <p className="small muted">Tap each one to see what it becomes and where its parts go.</p>}
          <ul className="cards">
            {results.map((i) => <ItemCard key={i.id} item={i} onOpen={() => onOpenItem(i.id)} />)}
          </ul>
        </section>
      )}

      <details className="more">
        <summary>More options</summary>
        <div className="stack">
          <fieldset className="segmented">
            <legend>What are you scanning?</legend>
            <label><input type="radio" checked={kind === "home"} onChange={() => setKind("home")} /> Something at home</label>
            <label><input type="radio" checked={kind === "building"} onChange={() => setKind("building")} /> A building or site</label>
          </fieldset>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "home" ? "My home" : "Old office, Koramangala"} />
          </label>
          <label>
            Typed notes, in any language
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="कुर्सी का पैर टूट गया है" />
          </label>
          <div className="stack notice">
            <strong>Add a notice</strong>
            <p className="small muted">A demolition permit, tender or closure notice, in any language. Oracle puts what's coming on the map.</p>
            <label className="capture-btn quiet slim">
              <input type="file" accept="application/pdf,image/*" onChange={(e) => readNotice(e.target.files?.[0])} />
              Choose a PDF or photo of a notice
            </label>
            {notice && <p className="small" role="status">{notice}</p>}
          </div>
        </div>
      </details>
    </div>
  );
}
