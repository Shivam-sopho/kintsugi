import { useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { api, audioFileName } from "../api";
import { useRecorder } from "../useRecorder";
import type { AppState, Job } from "../types";
import { DEMO_CENTER } from "../labels";
import VoiceButton from "./VoiceButton";

interface Props {
  state: AppState;
  onJob: (job: Job, onDone?: (j: Job) => void) => void;
  onScanned: (siteId: string) => void;
}

export default function ScanPanel({ onJob, onScanned }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<"home" | "building">("home");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [where, setWhere] = useState(DEMO_CENTER);
  const [locNote, setLocNote] = useState("Using the demo location in Bengaluru.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const voiceNote = useRecorder();

  const add = (list: FileList | null) => list && setFiles((prev) => [...prev, ...Array.from(list)]);

  // Native location permission in the Android app; the browser's geolocation on the web.
  const useMyLocation = async () => {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      setWhere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocNote("Using your current location.");
    } catch {
      setLocNote("Location was not shared, so the demo location is used.");
    }
  };

  const toggleVoiceNote = async () => {
    if (!voiceNote.recording) return void (await voiceNote.start());
    const blob = await voiceNote.stop();
    if (blob) setFiles((prev) => [...prev, new File([blob], audioFileName(blob), { type: blob.type })]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length) return setError("Film a walkthrough, add photos, or record a voice note first.");
    setError(null);
    setBusy(true);
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("kind", kind);
    form.append("name", name || (kind === "home" ? "My home" : "My site"));
    form.append("lat", String(where.lat));
    form.append("lng", String(where.lng));
    if (notes) form.append("narration_text", notes);
    try {
      const job = await api.scan(form);
      onJob(job, (done) => {
        setBusy(false);
        if (done.status === "done") {
          setFiles([]);
          onScanned(String(done.result.site_id));
        } else setError(done.error ?? "The scan failed.");
      });
    } catch (err) {
      setBusy(false);
      setError((err as Error).message);
    }
  };

  const readNotice = async (file: File | undefined) => {
    if (!file) return;
    setNotice("Oracle is reading the notice…");
    try {
      const job = await api.oracle(file);
      onJob(job, (done) => {
        const n = ((done.result.prediction_ids as string[]) ?? []).length;
        setNotice(done.status === "done" ? (n ? `Added ${n} future pin${n > 1 ? "s" : ""} to the map.` : "Nothing new: those are already on the map.") : done.error ?? "Couldn't read it.");
      });
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  return (
    <div className="stack">
      <form className="stack" onSubmit={submit}>
        <h2>Scan something</h2>
        <p className="muted">
          Film a slow walkthrough, under a minute. Talk while you film in any language: what it is, what's broken.
          Tap tiles or panels near the microphone if you want Scout to listen for hollow ones.
        </p>
        <fieldset className="segmented">
          <legend>What are you scanning?</legend>
          <label><input type="radio" checked={kind === "home"} onChange={() => setKind("home")} /> Something at home</label>
          <label><input type="radio" checked={kind === "building"} onChange={() => setKind("building")} /> A building or site</label>
        </fieldset>
        <div className="capture">
          <label className="capture-btn">
            <input type="file" accept="video/*" capture="environment" onChange={(e) => add(e.target.files)} />
            Film a walkthrough
          </label>
          <label className="capture-btn quiet">
            <input type="file" accept="image/*,video/*" multiple onChange={(e) => add(e.target.files)} />
            Choose photos or a video
          </label>
        </div>
        <button type="button" className={`secondary ${voiceNote.recording ? "rec-outline" : ""}`} onClick={toggleVoiceNote}>
          {voiceNote.recording ? `Stop voice note (${voiceNote.seconds}s)` : "Record a voice note"}
        </button>
        <p className="small muted">A voice note on its own works too: describe what you have, and Scout lists it for you to confirm later.</p>
        {voiceNote.error && <p className="error small">{voiceNote.error}</p>}
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f, i) => (
              <li key={i}>
                <span>{f.type.startsWith("audio/") ? "Voice note" : f.name}</span>
                <button type="button" className="link" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "home" ? "My home" : "Old office, Koramangala"} />
        </label>
        <label>
          Notes, in any language (optional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="कुर्सी का पैर टूट गया है" />
        </label>
        <VoiceButton hint="notes" label="Say your notes" onResult={(t) => setNotes((n) => (n ? `${n} ${t.text}` : t.text))} />
        <p className="small muted">
          {locNote} <button type="button" className="link" onClick={useMyLocation}>Use my location</button>
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Scout is watching…" : "Scan with Scout"}</button>
      </form>

      <section className="stack notice">
        <h2>Add a notice</h2>
        <p className="muted">A demolition permit, tender or closure notice, in any language. Oracle puts what's coming on the map.</p>
        <label className="capture-btn quiet">
          <input type="file" accept="application/pdf,image/*" onChange={(e) => readNotice(e.target.files?.[0])} />
          Choose a PDF or photo of a notice
        </label>
        {notice && <p className="small" role="status">{notice}</p>}
      </section>
    </div>
  );
}
